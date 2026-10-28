// Views of a race (live, finished, or a sample replay): header and pace, running order, Chase,
// the data tabs, race control and penalties, and the season's Chase.
import type { Hono } from 'hono';
import { buildChaseView } from '../../src/cards/chase.model';
import { buildChaseSeasonView } from '../../src/cards/chaseSeason.model';
import { buildOverviewView, buildPracticeView } from '../../src/cards/overview.model';
import { buildPaceRankings } from '../../src/cards/paceRankings.model';
import { buildPenaltiesView } from '../../src/cards/penalties.model';
import { buildRaceControlView } from '../../src/cards/raceControl.model';
import { buildFuelView, buildLapsView, buildPitRoadView, buildStrategyView, buildTopSpeedView, type Inputs } from '../../src/cards/tabs.model';
import { flagFromFeed } from '../../src/data/nascar/feed';
import { chaseStandings, finishPointsTable } from '../../src/data/nascar/points';
import { replayPaceDataset } from '../../src/data/nascar/replay';
import { etDateKey } from '../../src/data/nascar/weekend';
import { samplePace } from '../../src/data/sample/pace';
import { isTemplateEnabled } from '../../src/series/profiles';
import {
  getProfile,
  isLive,
  lapFlagsOf,
  liveChaseEntries,
  orderOf,
  raceLength,
  runningOrder,
  sourceOf,
  stageEndsOf,
  stageResults,
  stagesComplete,
  withBundle,
} from '../bundle';
import { config } from '../config';
import { liveBundle } from '../sources/nascarLive';
import { chaseRaces, replayPace } from '../sources/nascarReplay';

/** Data tabs that share one input set: Pit road, Strategy, Fuel, Compare (laps), Fastest driver. */
const TAB_VIEWS = {
  'pit-road': buildPitRoadView,
  strategy: buildStrategyView,
  fuel: buildFuelView,
  laps: buildLapsView,
  'top-speed': (i: Inputs) => buildTopSpeedView(i),
} satisfies Record<string, (i: Inputs) => unknown>;

export function raceRoutes(api: Hono) {
  /** The header and Pace tab. `?limit=10` gives a top-N list. */
  api.get('/series/:id/cards/pace-rankings', async (c) => {
    const profile = getProfile(c.req.param('id'));
    if (!profile) return c.json({ error: 'unknown series' }, 404);
    if (!isTemplateEnabled(profile, 'pace-rankings')) return c.json({ error: 'template disabled for series' }, 404);
    const limit = Number(c.req.query('limit'));
    const opts = limit > 0 ? { limit } : {};
    if (sourceOf(c) === 'sample') {
      // The replay if NASCAR is reachable, else the fictional sample, so the header always has something.
      const data = await replayPace(profile.id).catch(() => samplePace[profile.id]!);
      return c.json({ ...buildPaceRankings(data, profile, config.attributionHandle, opts), updatedAt: null });
    }
    return withBundle((cc, p, b) => {
      const data = replayPaceDataset(p.id, b.race, b.lapTimes, b.pits, b.atLap, b.track, {
        source: 'live',
        session: isLive(b) && !b.isRace ? b.runName : undefined,
        currentFlag: isLive(b) ? b.currentFlag : undefined,
        lapsToGo: isLive(b) ? b.lapsToGo : undefined,
      });
      // From the day after a finished race (ET), the Overview also shows the next race.
      const showNextRace = !!b.finished && etDateKey(Date.now()) > b.race.race_date.slice(0, 10);
      return cc.json({
        ...buildPaceRankings(data, p, config.attributionHandle, opts),
        updatedAt: isLive(b) ? b.updatedAt : null,
        final: !!b.finished,
        showNextRace,
      });
    })(c);
  });

  api.get(
    '/series/:id/overview',
    withBundle((c, profile, b) =>
      c.json(isLive(b) && !b.isRace ? buildPracticeView(b.lapTimes, profile, b.carInfo) : buildOverviewView(orderOf(b), profile, b.atLap, b.carInfo)),
    ),
  );

  api.get(
    '/series/:id/chase',
    withBundle((c, profile, b) => {
      if (!b.livePoints?.some((d) => d.is_in_chase)) return c.json({ error: 'no Chase data for this race' }, 404);
      if (isLive(b)) return c.json(buildChaseView(liveChaseEntries(b), profile));
      if (!b.results) return c.json({ error: 'no results for this race' }, 404);
      const entries = chaseStandings(b.livePoints, finishPointsTable(b.livePoints, b.results), runningOrder(b), stagesComplete(b));
      return c.json(buildChaseView(entries, profile));
    }),
  );

  for (const [path, build] of Object.entries(TAB_VIEWS)) {
    api.get(
      `/series/:id/${path}`,
      withBundle((c, profile, b) =>
        c.json(
          build({
            profile,
            lapTimes: b.lapTimes,
            pits: b.pits,
            atLap: b.atLap,
            totalLaps: raceLength(b),
            stageEnds: stageEndsOf(b),
            order: orderOf(b),
            carInfo: b.carInfo,
            live: isLive(b) && b.isRace,
          }),
        ),
      ),
    );
  }

  /** Race notes and flag changes, newest first. Races only. */
  api.get(
    '/series/:id/race-control',
    withBundle((c, _profile, b) => {
      if (isLive(b) && !b.isRace) return c.json({ error: 'not a race' }, 404);
      const finished = b.atLap >= raceLength(b);
      const lapFlags = lapFlagsOf(b);
      // Live, the lap in progress counts too, so a caution shows the moment it's thrown.
      if (isLive(b) && !finished) lapFlags.push(flagFromFeed(b.currentFlag));
      return c.json(
        buildRaceControlView(b.lapNotes, lapFlags, isLive(b) ? Infinity : b.atLap, finished ? b.atLap : undefined, {
          cautions: isLive(b) ? b.cautions : undefined,
          stages: stageResults(b),
        }),
      );
    }),
  );

  /** Penalties read from the race notes, newest first. Races only. */
  api.get(
    '/series/:id/penalties',
    withBundle((c, profile, b) => {
      if (isLive(b) && !b.isRace) return c.json({ error: 'not a race' }, 404);
      const names = new Map(b.lapTimes.laps.map((car) => [car.Number, car.FullName]));
      return c.json(buildPenaltiesView(profile.id, b.lapNotes, lapFlagsOf(b, b.atLap + 1), names, isLive(b) ? Infinity : b.atLap));
    }),
  );

  /** The whole Chase: standings (as they run during a Chase race), results by race, points by race. */
  api.get('/series/:id/chase/season', async (c) => {
    const profile = getProfile(c.req.param('id'));
    if (!profile) return c.json({ error: 'unknown series' }, 404);
    try {
      const races = await chaseRaces(profile.id);
      const b = sourceOf(c) === 'live' ? await liveBundle(profile.id) : null;
      const running = b?.isRace && b.atLap < raceLength(b) && races.some((r) => r.race.race_id === b.race.race_id) && b.livePoints?.some((d) => d.is_in_chase);
      const live = running ? { raceId: b.race.race_id, livePoints: b.livePoints!, entries: liveChaseEntries(b) } : undefined;
      return c.json(buildChaseSeasonView(profile, races, live));
    } catch (e) {
      return c.json({ error: `Chase data unavailable: ${(e as Error).message}` }, 503);
    }
  });
}
