// Between races: which series to open to, the next race and its schedule, qualifying, the
// last race's results and Chase standings, and team number art.
import type { Hono } from 'hono';
import { buildChaseStandingsView } from '../../src/cards/chase.model';
import { buildQualifyingView, entriesFromLive, entriesFromRun, runHasTimes } from '../../src/cards/qualifying.model';
import { buildResultsView, buildScheduleView } from '../../src/cards/weekend.model';
import { tvNetwork } from '../../src/data/nascar/networks';
import { trackLocation } from '../../src/data/nascar/tracks';
import { homeSeries } from '../../src/data/nascar/weekend';
import { getProfile, raceIsOver, seriesOf } from '../bundle';
import { liveBundle, liveStatus } from '../sources/nascarLive';
import { carBadge, lastRaceResults, nextRace, nextStarts, trackInfo, weekendRuns } from '../sources/nascarReplay';

export function weekendRoutes(api: Hono) {
  /** The series to open to: the live race's; Friday-Sunday the next race's; else Cup (days in ET). */
  api.get('/home', async (c) => {
    const status = liveStatus();
    const liveSeriesId = status?.active && status.isRace ? status.seriesId : null;
    const starts = await nextStarts(Date.now(), raceIsOver).catch(() => []);
    return c.json(homeSeries({ now: Date.now(), liveSeriesId, nextStarts: starts }));
  });

  /** The series' next race, for the header when nothing is live. */
  api.get('/series/:id/upcoming', async (c) => {
    const s = seriesOf(c);
    if (!s) return c.json({ error: 'unknown series' }, 404);
    const race = await nextRace(s.feedSeries, new Date(), raceIsOver).catch(() => undefined);
    if (!race) return c.json({ error: 'no upcoming race on the schedule' }, 404);
    const track = await trackInfo(race.track_id);
    const stageLaps = [race.stage_1_laps, race.stage_2_laps, race.stage_3_laps, race.stage_4_laps].filter((n): n is number => !!n && n > 0);
    return c.json({
      raceName: race.race_name,
      venue: race.track_name,
      location: track ? trackLocation(track) : undefined,
      logoUrl: track?.track_logo ?? undefined,
      startsET: race.race_date,
      laps: race.scheduled_laps,
      miles: race.scheduled_distance ?? null,
      stageLaps: stageLaps.reduce((a, n) => a + n, 0) === race.scheduled_laps ? stageLaps : [],
      tv: tvNetwork(race.television_broadcaster) ?? null,
      radio: race.radio_broadcaster ?? null,
    });
  });

  /** The next race weekend's on-track sessions, in ET. */
  api.get('/series/:id/schedule', async (c) => {
    const s = seriesOf(c);
    if (!s) return c.json({ error: 'unknown series' }, 404);
    const race = await nextRace(s.feedSeries, new Date(), raceIsOver).catch(() => undefined);
    if (!race) return c.json({ error: 'no upcoming race on the schedule' }, 404);
    const runs = await weekendRuns(s.feedSeries, race).catch(() => undefined);
    return c.json(buildScheduleView(s.profile.id, race, Date.now(), runs));
  });

  /**
   * Qualifying for the next race: live best laps during the session, the official order once it
   * has times, or the rulebook lineup when it didn't run (no times an hour past its start).
   */
  api.get('/series/:id/qualifying', async (c) => {
    const s = seriesOf(c);
    if (!s) return c.json({ error: 'unknown series' }, 404);
    const race = await nextRace(s.feedSeries, new Date(), raceIsOver).catch(() => undefined);
    if (!race) return c.json({ error: 'no-qualifying' }, 404);
    const chaseCars = await lastRaceResults(s.profile.id)
      .then(({ livePoints }) => new Set((livePoints ?? []).filter((d) => d.is_in_chase).map((d) => d.car_number)))
      .catch(() => new Set<string>());

    const live = await liveBundle(s.profile.id);
    if (live && live.runType === 2 && live.race.race_id === race.race_id) {
      return c.json(buildQualifyingView(s.profile, 'live', entriesFromLive(live.lapTimes), chaseCars));
    }
    const run = (await weekendRuns(s.feedSeries, race).catch(() => [])).find((r) => r.run_type === 2 && r.results?.length);
    if (!run) return c.json({ error: 'no-qualifying' }, 404);
    if (runHasTimes(run)) return c.json(buildQualifyingView(s.profile, 'final', entriesFromRun(run), chaseCars));
    const start = race.schedule?.find((e) => e.run_type === 2)?.start_time_utc;
    const past = start ? Date.now() > Date.parse(`${start}Z`) + 3600_000 : false;
    return past ? c.json(buildQualifyingView(s.profile, 'rulebook', entriesFromRun(run), chaseCars)) : c.json({ error: 'no-qualifying' }, 404);
  });

  /** Chase standings after the series' last race. */
  api.get('/series/:id/chase/standings', async (c) => {
    const profile = getProfile(c.req.param('id'));
    if (!profile) return c.json({ error: 'unknown series' }, 404);
    try {
      const { race, livePoints } = await lastRaceResults(profile.id);
      if (!livePoints?.some((d) => d.is_in_chase)) return c.json({ error: 'no Chase data for this series' }, 404);
      return c.json(buildChaseStandingsView(livePoints, race.results, race.race_name, profile));
    } catch (e) {
      return c.json({ error: `standings unavailable: ${(e as Error).message}` }, 503);
    }
  });

  /** Final results of the series' most recent race. */
  api.get('/series/:id/results', async (c) => {
    const profile = getProfile(c.req.param('id'));
    if (!profile) return c.json({ error: 'unknown series' }, 404);
    try {
      const { race, livePoints } = await lastRaceResults(profile.id);
      return c.json(buildResultsView(profile, race, livePoints));
    } catch (e) {
      return c.json({ error: `results unavailable: ${(e as Error).message}` }, 503);
    }
  });

  api.get('/series/:id/car-badges/:file', async (c) => {
    const png = await carBadge(c.req.param('id'), c.req.param('file').replace(/\.png$/, ''));
    if (!png) return c.json({ error: 'no badge' }, 404);
    return c.body(new Uint8Array(png), 200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
  });
}
