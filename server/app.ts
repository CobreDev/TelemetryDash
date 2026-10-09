import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { buildChaseStandingsView, buildChaseView } from '../src/cards/chase.model';
import { buildOverviewView, buildPracticeView } from '../src/cards/overview.model';
import { buildPaceRankings } from '../src/cards/paceRankings.model';
import { buildRaceControlView } from '../src/cards/raceControl.model';
import { flagFromFeed } from '../src/data/nascar/feed';
import { buildResultsView, buildScheduleView } from '../src/cards/weekend.model';
import { buildFuelView, buildLapsView, buildPitRoadView, buildStrategyView, buildTopSpeedView, type Inputs } from '../src/cards/tabs.model';
import { buildOverview } from '../src/data/nascar/overview';
import { chaseStandings, finishPointsTable } from '../src/data/nascar/points';
import { replayPaceDataset } from '../src/data/nascar/replay';
import { samplePace } from '../src/data/sample/pace';
import { isTemplateEnabled, profiles, seriesList } from '../src/series/profiles';
import type { SeriesProfile } from '../src/series/types';
import { config } from './config';
import { liveBundle, liveStatus, type LiveBundle } from './sources/nascarLive';
import { carBadge, FEED_SERIES, lastRaceResults, nextRace, replayBundle, replayPace, trackInfo, type ReplayBundle } from './sources/nascarReplay';
import { trackLocation } from '../src/data/nascar/tracks';
import { tvNetwork } from '../src/data/nascar/networks';

// Versioned so a future mobile app can rely on /api/v1 while the web UI moves on.
export const api = new Hono();
api.use('*', cors());

api.get('/health', (c) => c.json({ ok: true }));

api.get('/meta', (c) => c.json({ attribution: config.attributionHandle, sources: ['live', 'sample'] }));

/** What's live right now (any series), for the top bar's status and data age. */
api.get('/live', (c) => c.json({ live: liveStatus(), now: Date.now() }));

api.get('/series', (c) => c.json(seriesList));

const getProfile = (id: string): SeriesProfile | undefined => (profiles as Record<string, SeriesProfile>)[id];

api.get('/series/:id', (c) => {
  const profile = getProfile(c.req.param('id'));
  return profile ? c.json(profile) : c.json({ error: 'unknown series' }, 404);
});

type Source = 'live' | 'sample';
const sourceOf = (c: Context): Source => (c.req.query('source') === 'sample' ? 'sample' : 'live');

/**
 * Data for a series from the requested source. `?source=sample` replays the last completed
 * race at halfway; the default is live. When nothing is live for this series the response
 * says so (409) with what is live and the series' next race, so clients can explain it.
 */
async function bundleFor(c: Context, profile: SeriesProfile): Promise<ReplayBundle | LiveBundle | Response> {
  if (sourceOf(c) === 'sample') return replayBundle(profile.id);
  const b = await liveBundle(profile.id);
  if (b) return b;
  const next = await nextRace(FEED_SERIES[profile.id]!).catch(() => undefined);
  return c.json(
    {
      error: 'no-live-session',
      live: liveStatus(),
      next: next && { raceName: next.race_name, track: next.track_name, startsET: next.race_date },
    },
    409,
  );
}

const isLive = (b: ReplayBundle | LiveBundle): b is LiveBundle => 'live' in b;

function stageEndsOf(b: ReplayBundle) {
  const lengths = [b.race.stage_1_laps, b.race.stage_2_laps, b.race.stage_3_laps, b.race.stage_4_laps].filter(
    (n): n is number => !!n && n > 0,
  );
  const total = b.race.actual_laps ?? b.race.scheduled_laps;
  return lengths.reduce((a, n) => a + n, 0) === total
    ? lengths.slice(0, -1).map((_, i) => lengths.slice(0, i + 1).reduce((a, n) => a + n, 0))
    : [];
}

/** Wraps a series route: resolves the profile and the source's data, maps failures to 503. */
const withBundle =
  (build: (c: Context, profile: SeriesProfile, b: ReplayBundle | LiveBundle) => Response | Promise<Response>) =>
  async (c: Context) => {
    const profile = getProfile(c.req.param('id') ?? '');
    if (!profile) return c.json({ error: 'unknown series' }, 404);
    try {
      const b = await bundleFor(c, profile);
      return b instanceof Response ? b : await build(c, profile, b);
    } catch (e) {
      // No fictional fallback for timing views: a made-up running order would be misleading.
      return c.json({ error: `timing data unavailable: ${(e as Error).message}` }, 503);
    }
  };

api.get('/series/:id/cards/pace-rankings', async (c) => {
  const profile = getProfile(c.req.param('id'));
  if (!profile) return c.json({ error: 'unknown series' }, 404);
  if (!isTemplateEnabled(profile, 'pace-rankings')) return c.json({ error: 'template disabled for series' }, 404);
  // Full field by default; ?limit=10 gives a top-N list (e.g. for a future card or app widget).
  const limit = Number(c.req.query('limit'));
  const opts = limit > 0 ? { limit } : {};
  if (sourceOf(c) === 'sample') {
    // The replay if reachable, else the fictional sample, so the header always has something.
    const data = await replayPace(profile.id).catch(() => samplePace[profile.id]!);
    return c.json({ ...buildPaceRankings(data, profile, config.attributionHandle, opts), updatedAt: null });
  }
  return withBundle((cc, p, b) => {
    const data = replayPaceDataset(p.id, b.race, b.lapTimes, b.pits, b.atLap, b.track, {
      source: 'live',
      session: isLive(b) && !b.isRace ? b.runName : undefined,
      currentFlag: isLive(b) ? b.currentFlag : undefined,
    });
    return cc.json({ ...buildPaceRankings(data, p, config.attributionHandle, opts), updatedAt: isLive(b) ? b.updatedAt : null });
  })(c);
});

api.get(
  '/series/:id/overview',
  withBundle((c, profile, b) =>
    c.json(
      isLive(b) && !b.isRace
        ? buildPracticeView(b.lapTimes, profile, b.runName)
        : buildOverviewView(buildOverview(b.lapTimes, b.pits, b.atLap), profile, b.atLap),
    ),
  ),
);

api.get(
  '/series/:id/chase',
  withBundle((c, profile, b) => {
    if (!b.livePoints?.some((d) => d.is_in_chase)) return c.json({ error: 'no Chase data for this race' }, 404);
    const running = new Map(buildOverview(b.lapTimes, b.pits, b.atLap).filter((r) => !r.out).map((r) => [r.carNumber, r.position]));
    const stagesComplete = stageEndsOf(b).filter((end) => end <= b.atLap).length;
    if (isLive(b)) {
      return c.json(buildChaseView(chaseStandings(b.livePoints, [], running, stagesComplete, { asTheyRun: true }), profile, stagesComplete));
    }
    if (!b.results) return c.json({ error: 'no results for this race' }, 404);
    const entries = chaseStandings(b.livePoints, finishPointsTable(b.livePoints, b.results), running, stagesComplete);
    return c.json(buildChaseView(entries, profile, stagesComplete));
  }),
);

// Pit road, Strategy, Fuel, Compare and Top speed share one input set.
const TAB_VIEWS = {
  'pit-road': buildPitRoadView,
  strategy: buildStrategyView,
  fuel: buildFuelView,
  laps: buildLapsView,
  'top-speed': (i: Inputs) => buildTopSpeedView(i),
} satisfies Record<string, (i: Inputs) => unknown>;

for (const [path, build] of Object.entries(TAB_VIEWS)) {
  api.get(
    `/series/:id/${path}`,
    withBundle((c, profile, b) => {
      const totalLaps = b.race.actual_laps ?? b.race.scheduled_laps;
      const order = buildOverview(b.lapTimes, b.pits, b.atLap);
      return c.json(build({ profile, lapTimes: b.lapTimes, pits: b.pits, atLap: b.atLap, totalLaps, stageEnds: stageEndsOf(b), order }));
    }),
  );
}

/** Race notes and flag changes, newest first. Races only (practice has no flags or notes). */
api.get(
  '/series/:id/race-control',
  withBundle((c, _profile, b) => {
    if (isLive(b) && !b.isRace) return c.json({ error: 'not a race' }, 404);
    const flagAt = (lap: number) => flagFromFeed(b.lapTimes.flags.find((f) => f.LapsCompleted === lap)?.FlagState);
    const lapFlags = Array.from({ length: b.atLap }, (_, i) => flagAt(i + 1));
    // Live: the lap in progress counts too, so a caution appears as soon as it's thrown.
    if (isLive(b)) lapFlags.push(flagFromFeed(b.currentFlag));
    return c.json(buildRaceControlView(b.lapNotes, lapFlags, isLive(b) ? Infinity : b.atLap));
  }),
);

/** The series' next race, for the header when nothing is live. */
api.get('/series/:id/upcoming', async (c) => {
  const profile = getProfile(c.req.param('id'));
  const feedSeries = profile && FEED_SERIES[profile.id];
  if (!profile || !feedSeries) return c.json({ error: 'unknown series' }, 404);
  const race = await nextRace(feedSeries).catch(() => undefined);
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
    // Only meaningful when they add up to the race length.
    stageLaps: stageLaps.reduce((a, n) => a + n, 0) === race.scheduled_laps ? stageLaps : [],
    tv: tvNetwork(race.television_broadcaster) ?? null,
    radio: race.radio_broadcaster ?? null,
  });
});

/** On-track sessions of the series' next race weekend (practice, qualifying, race) in ET. */
api.get('/series/:id/schedule', async (c) => {
  const profile = getProfile(c.req.param('id'));
  const feedSeries = profile && FEED_SERIES[profile.id];
  if (!profile || !feedSeries) return c.json({ error: 'unknown series' }, 404);
  const race = await nextRace(feedSeries).catch(() => undefined);
  if (!race) return c.json({ error: 'no upcoming race on the schedule' }, 404);
  return c.json(buildScheduleView(profile.id, race, Date.now()));
});

/** Chase standings after the series' last race, for weeks with nothing live. */
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

/** Final results of the series' most recent completed race. */
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
  const number = c.req.param('file').replace(/\.png$/, '');
  const png = await carBadge(c.req.param('id'), number);
  if (!png) return c.json({ error: 'no badge' }, 404);
  return c.body(new Uint8Array(png), 200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
});

api.notFound((c) => c.json({ error: 'not found' }, 404));

export const app = new Hono();
app.route('/api/v1', api);
