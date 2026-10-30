// Picks the data a series view is built from: the live session, or a finished race from
// NASCAR's official files. Plus the derived pieces several routes share: running order, stage
// ends, stage results, lap flags.
import type { Context } from 'hono';
import type { StageResult } from '../src/cards/raceControl.model';
import { easternToEpoch, flagFromFeed, type FeedRace } from '../src/data/nascar/feed';
import { parseDriverName } from '../src/data/nascar/names';
import { buildOverview } from '../src/data/nascar/overview';
import { chaseStandings } from '../src/data/nascar/points';
import type { TrackFlag } from '../src/data/types';
import { profiles } from '../src/series/profiles';
import type { SeriesProfile } from '../src/series/types';
import { liveBundle, liveStatus, raceFinishedLive, type LiveBundle } from './sources/nascarLive';
import { FEED_SERIES, finishedRaceBundle, nextRace, type RaceBundle } from './sources/nascarReplay';

export type Bundle = RaceBundle | LiveBundle;
export const getProfile = (id: string): SeriesProfile | undefined => (profiles as Record<string, SeriesProfile>)[id];

/** The route's series and its NASCAR feed number, or undefined (answer 404). */
export function seriesOf(c: Context): { profile: SeriesProfile; feedSeries: number } | undefined {
  const profile = getProfile(c.req.param('id') ?? '');
  const feedSeries = profile && FEED_SERIES[profile.id];
  return profile && feedSeries ? { profile, feedSeries } : undefined;
}

export const isLive = (b: Bundle): b is LiveBundle => 'live' in b;
export const raceLength = (b: Bundle) => b.race.actual_laps ?? b.race.scheduled_laps;

/** The collector saw the finish, or (it wasn't recording that race) 5 hours have passed. */
export function raceIsOver(race: FeedRace): boolean {
  const seen = raceFinishedLive(race.race_id);
  if (seen !== undefined) return seen;
  const status = liveStatus();
  const runningNow = status?.active && status.raceId === race.race_id;
  return !runningNow && Date.now() > easternToEpoch(race.race_date) + 5 * 3600_000;
}

/**
 * Data for a series. A running session wins; a finished race is shown from the official files
 * until its weekend ends (Monday 00:00 ET). Otherwise a 409 saying what is live and when the
 * series races next, so clients can explain it.
 */
async function bundleFor(c: Context, profile: SeriesProfile): Promise<Bundle | Response> {
  const b = await liveBundle(profile.id);
  if (b && !(b.isRace && b.atLap >= raceLength(b))) return b;
  const fin = await finishedRaceBundle(profile.id, raceIsOver).catch(() => undefined);
  if (fin) return fin;
  if (b) return b; // official files not out yet: keep the recorded finish
  const next = await nextRace(FEED_SERIES[profile.id]!, new Date(), raceIsOver).catch(() => undefined);
  return c.json(
    { error: 'no-live-session', live: liveStatus(), next: next && { raceName: next.race_name, track: next.track_name, startsET: next.race_date } },
    409,
  );
}

/** Wraps a series route: resolves the profile and its data, and maps failures to 503. */
export const withBundle =
  (build: (c: Context, profile: SeriesProfile, b: Bundle) => Response | Promise<Response>) => async (c: Context) => {
    const profile = getProfile(c.req.param('id') ?? '');
    if (!profile) return c.json({ error: 'unknown series' }, 404);
    try {
      const b = await bundleFor(c, profile);
      return b instanceof Response ? b : await build(c, profile, b);
    } catch (e) {
      // No made-up fallback for timing views: a fictional running order would mislead.
      return c.json({ error: `timing data unavailable: ${(e as Error).message}` }, 503);
    }
  };

/** Running order at the bundle's lap. Live, it's NASCAR's: its order, gaps and who's out. */
export const orderOf = (b: Bundle) => {
  const info = Object.entries(b.carInfo ?? {});
  const out = new Set(info.filter(([, c]) => c.out).map(([n]) => n));
  const feed = new Map(isLive(b) ? info.filter(([, c]) => c.position).map(([n, c]) => [n, { position: c.position!, gap: c.gap }]) : []);
  return buildOverview(b.lapTimes, b.pits, b.atLap, isLive(b), out, feed);
};

/** Running position by car number, for cars still running. */
export const runningOrder = (b: Bundle) => new Map(orderOf(b).filter((r) => !r.out).map((r) => [r.carNumber, r.position]));

/** Laps each stage (but the last) ends on; empty unless the stage lengths add up to the race. */
export function stageEndsOf(b: Bundle): number[] {
  const lengths = [b.race.stage_1_laps, b.race.stage_2_laps, b.race.stage_3_laps, b.race.stage_4_laps].filter((n): n is number => !!n && n > 0);
  if (lengths.reduce((a, n) => a + n, 0) !== raceLength(b)) return [];
  return lengths.slice(0, -1).map((_, i) => lengths.slice(0, i + 1).reduce((a, n) => a + n, 0));
}

export const stagesComplete = (b: Bundle) => stageEndsOf(b).filter((end) => end <= b.atLap).length;

/** Flag each lap ran under (index 0 = lap 1), through `upTo`. */
export const lapFlagsOf = (b: Bundle, upTo = b.atLap): TrackFlag[] =>
  Array.from({ length: upTo }, (_, i) => flagFromFeed(b.lapTimes.flags.find((f) => f.LapsCompleted === i + 1)?.FlagState));

/** Chase standings as they run, from NASCAR's live points file. */
export const liveChaseEntries = (b: Bundle) => chaseStandings(b.livePoints ?? [], [], runningOrder(b), stagesComplete(b), { asTheyRun: true });

/**
 * Each finished stage's point scorers, from the points file (live: NASCAR fills them in as
 * the stage ends; replays: only stages ended by `atLap`).
 */
export function stageResults(b: Bundle): StageResult[] {
  const ends = stageEndsOf(b);
  const out: StageResult[] = [];
  for (const n of [1, 2, 3] as const) {
    const lap = ends[n - 1] ?? (isLive(b) ? b.atLap : undefined);
    if (lap === undefined || lap > b.atLap) continue;
    const scored = (b.livePoints ?? [])
      .map((d) => ({ d, points: d[`stage_${n}_points`] ?? 0 }))
      .filter((x) => x.points > 0)
      .sort((x, y) => Number(!!y.d[`stage_${n}_winner`]) - Number(!!x.d[`stage_${n}_winner`]) || y.points - x.points);
    if (!scored.length) continue;
    out.push({
      stage: n,
      lap,
      results: scored.map(({ d, points }) => {
        const name = parseDriverName(`${d.first_name} ${d.last_name}`);
        return { carNumber: d.car_number, name: `${name.firstName} ${name.lastName}`.trim(), points };
      }),
    });
  }
  return out;
}
