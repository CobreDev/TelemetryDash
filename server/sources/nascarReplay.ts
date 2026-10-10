import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { easternToEpoch, withRaceLength, type FeedLapNotes, type FeedLapTimes, type FeedPitStop, type FeedRace, type FeedWeekendRace } from '../../src/data/nascar/feed';
import { withChaseMarkers } from '../../src/data/nascar/names';
import { halfwayLap, replayPaceDataset } from '../../src/data/nascar/replay';
import { weekendEndsAt } from '../../src/data/nascar/weekend';
import type { FeedTrack } from '../../src/data/nascar/tracks';
import type { FeedLivePoints, FeedResult } from '../../src/data/nascar/points';
import type { PaceDataset } from '../../src/data/types';
import { config } from '../config';

// NASCAR's public (unofficial) replay files. Completed races never change, so each file is
// fetched once and kept under DATA_DIR; only the schedule is refreshed, at most hourly.
export const BASE = 'https://cf.nascar.com/cacher';
export const FEED_SERIES: Record<string, number> = { cup: 1, oreilly: 2, craftsman: 3 };
const SCHEDULE_TTL_MS = 60 * 60 * 1000;
// Teams restyle numbers occasionally (new sponsors, paint schemes); weekly is plenty.
const BADGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const UA = { 'User-Agent': 'TelemetryDash (personal, unofficial)' };

export async function cachedJson<T>(path: string, url: string, maxAgeMs = Infinity): Promise<T> {
  const file = join(config.dataDir, 'nascar', path);
  try {
    const s = await stat(file);
    if (Date.now() - s.mtimeMs < maxAgeMs) return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    /* not cached yet */
  }
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
  return JSON.parse(text) as T;
}

/** A race from the season schedule (refreshed hourly), by id. */
export async function raceById(feedSeries: number, raceId: number, now = new Date()): Promise<FeedRace | undefined> {
  for (const year of [now.getFullYear(), now.getFullYear() - 1]) {
    const list = await cachedJson<Record<string, FeedRace[]>>(
      `${year}/race_list_basic.json`,
      `${BASE}/${year}/race_list_basic.json`,
      SCHEDULE_TTL_MS,
    );
    const race = (list[`series_${feedSeries}`] ?? []).find((r) => r.race_id === raceId);
    if (race) return race;
  }
  return undefined;
}

/** The series' next race that hasn't run yet, for "no live session" messages. */
export async function nextRace(feedSeries: number, now = new Date()): Promise<FeedRace | undefined> {
  const list = await cachedJson<Record<string, FeedRace[]>>(
    `${now.getFullYear()}/race_list_basic.json`,
    `${BASE}/${now.getFullYear()}/race_list_basic.json`,
    SCHEDULE_TTL_MS,
  );
  return (list[`series_${feedSeries}`] ?? [])
    // actual_laps is filled in ahead of time, so only the start time tells what's upcoming.
    .filter((r) => easternToEpoch(r.race_date) >= now.getTime() - 6 * 3600_000)
    .sort((a, b) => a.race_date.localeCompare(b.race_date))[0];
}

async function latestCompletedRace(feedSeries: number, now: Date): Promise<FeedRace | undefined> {
  // Early in a season the latest finished race is in last year's schedule.
  for (const year of [now.getFullYear(), now.getFullYear() - 1]) {
    const list = await cachedJson<Record<string, FeedRace[]>>(
      `${year}/race_list_basic.json`,
      `${BASE}/${year}/race_list_basic.json`,
      SCHEDULE_TTL_MS,
    );
    const done = (list[`series_${feedSeries}`] ?? [])
      // A race counts as done 5 hours after its start (actual_laps is pre-filled, so no help).
      .filter((r) => (r.actual_laps ?? 0) > 0 && easternToEpoch(r.race_date) + 5 * 3600_000 < now.getTime())
      .sort((a, b) => b.race_date.localeCompare(a.race_date));
    if (done[0]) return done[0];
  }
  return undefined;
}

/** Location and logo for a track; optional, so a failure never blocks the dashboard. */
export async function trackInfo(trackId: number | undefined): Promise<FeedTrack | undefined> {
  if (trackId === undefined) return undefined;
  try {
    const list = await cachedJson<{ items: FeedTrack[] }>('tracks.json', `${BASE}/tracks.json`, BADGE_TTL_MS);
    return list.items.find((t) => t.track_id === trackId);
  } catch {
    return undefined;
  }
}

export interface ReplayBundle {
  race: FeedRace;
  lapTimes: FeedLapTimes;
  pits: FeedPitStop[];
  track?: FeedTrack;
  /** Final points file and results, for rebuilding points as they ran (optional). */
  livePoints?: FeedLivePoints[];
  results?: FeedResult[];
  /** True for a race shown after it ended (final lap, official files). */
  finished?: boolean;
  /** Race notes by lap (optional); replays show only notes up to `atLap`. */
  lapNotes?: FeedLapNotes;
  /** The lap the replay is "live" at: halfway. */
  atLap: number;
}

const bundles = new Map<string, Promise<ReplayBundle>>();
const datasets = new Map<string, PaceDataset>();

/** One race's files (lap times, pits, points, results, notes). `maxAgeMs` re-fetches stale copies. */
async function loadRaceFiles(feedSeries: number, race: FeedRace, maxAgeMs = Infinity): Promise<Omit<ReplayBundle, 'atLap'>> {
  const dir = `${race.race_season}/${feedSeries}/${race.race_id}`;
  const lapTimes = await cachedJson<FeedLapTimes>(`${dir}/lap-times.json`, `${BASE}/${dir}/lap-times.json`, maxAgeMs);
  const pits = await cachedJson<FeedPitStop[]>(`${dir}/live-pit-data.json`, `${BASE}/${dir}/live-pit-data.json`, maxAgeMs);
  const track = await trackInfo(race.track_id);
  // Points data is optional: the timing views still work without it.
  const livePoints = await cachedJson<FeedLivePoints[]>(
    `${dir}/live_points.json`,
    `https://cf.nascar.com/live/feeds/series_${feedSeries}/${race.race_id}/live_points.json`,
    maxAgeMs,
  ).catch(() => undefined);
  const results = await cachedJson<{ weekend_race: { results: FeedResult[] }[] }>(`${dir}/weekend-feed.json`, `${BASE}/${dir}/weekend-feed.json`, maxAgeMs)
    .then((w) => w.weekend_race[0]?.results)
    .catch(() => undefined);
  const lapNotes = await cachedJson<FeedLapNotes>(`${dir}/lap-notes.json`, `${BASE}/${dir}/lap-notes.json`, maxAgeMs).catch(() => undefined);
  const chaseCars = livePoints && new Set(livePoints.filter((d) => d.is_in_chase).map((d) => d.car_number));
  return { race, lapTimes: withChaseMarkers(lapTimes, chaseCars), pits, track, livePoints, results, lapNotes };
}

/** Raw files for the series' most recent completed race, replayed at its halfway lap. */
export async function replayBundle(seriesId: string, now = new Date()): Promise<ReplayBundle> {
  const feedSeries = FEED_SERIES[seriesId];
  if (!feedSeries) throw new Error(`no NASCAR feed for ${seriesId}`);
  const race = await latestCompletedRace(feedSeries, now);
  if (!race) throw new Error(`no completed ${seriesId} race found`);

  const key = `${seriesId}/${race.race_id}`;
  let hit = bundles.get(key);
  if (!hit) {
    hit = loadRaceFiles(feedSeries, race).then((files) => ({ ...files, atLap: halfwayLap(race) }));
    hit.catch(() => bundles.delete(key)); // retry on the next request after a failure
    bundles.set(key, hit);
  }
  return hit;
}

/** Re-check a just-finished race's files this often (NASCAR settles them over the first hours). */
const FINAL_TTL_MS = 10 * 60_000;
const finals = new Map<number, { at: number; bundle: Promise<ReplayBundle | undefined> }>();

/**
 * The series' race from this weekend once it's over, at its final lap, until Monday 00:00 ET
 * (see weekendEndsAt). `isFinished` decides whether a race that has started is done. Built
 * from NASCAR's official files, so it survives restarts and other series' sessions.
 */
export async function finishedRaceBundle(seriesId: string, isFinished: (race: FeedRace) => boolean, now = Date.now()): Promise<ReplayBundle | undefined> {
  const feedSeries = FEED_SERIES[seriesId];
  if (!feedSeries) return undefined;
  const year = new Date(now).getFullYear();
  const list = await cachedJson<Record<string, FeedRace[]>>(`${year}/race_list_basic.json`, `${BASE}/${year}/race_list_basic.json`, SCHEDULE_TTL_MS);
  const race = (list[`series_${feedSeries}`] ?? [])
    .filter((r) => easternToEpoch(r.race_date) <= now && now < weekendEndsAt(r.race_date))
    .sort((a, b) => b.race_date.localeCompare(a.race_date))[0];
  if (!race || !isFinished(race)) return undefined;

  const cached = finals.get(race.race_id);
  if (cached && now - cached.at < FINAL_TTL_MS) return cached.bundle;
  const fresh = now - easternToEpoch(race.race_date) < 8 * 3600_000;
  const bundle = loadRaceFiles(feedSeries, race, fresh ? FINAL_TTL_MS : Infinity)
    .then((files) => {
      // The laps actually run (the schedule's length can be wrong; overtime adds laps).
      const laps = Math.max(0, ...files.lapTimes.laps.map((c) => c.Laps.at(-1)?.Lap ?? 0));
      if (!laps) return undefined;
      return { ...files, race: { ...withRaceLength(race, laps), actual_laps: laps }, atLap: laps, finished: true };
    })
    .catch(() => undefined);
  finals.set(race.race_id, { at: now, bundle });
  return bundle;
}

/** The soonest race start per series that hasn't started yet (for choosing the home series). */
export async function nextStarts(now = Date.now()): Promise<{ seriesId: string; startsAt: number }[]> {
  const year = new Date(now).getFullYear();
  const out: { seriesId: string; startsAt: number }[] = [];
  for (const y of [year, year + 1]) {
    const list = await cachedJson<Record<string, FeedRace[]>>(`${y}/race_list_basic.json`, `${BASE}/${y}/race_list_basic.json`, SCHEDULE_TTL_MS).catch(() => ({}) as Record<string, FeedRace[]>);
    for (const [seriesId, feed] of Object.entries(FEED_SERIES)) {
      if (out.some((o) => o.seriesId === seriesId)) continue;
      const starts = (list[`series_${feed}`] ?? []).map((r) => easternToEpoch(r.race_date)).filter((t) => t > now).sort((a, b) => a - b);
      if (starts[0]) out.push({ seriesId, startsAt: starts[0] });
    }
  }
  return out;
}

/**
 * Final results of the series' most recent completed race, with its points file when
 * NASCAR has one (for rookie / ineligible / Chase markers). Independent of the lap files.
 */
export async function lastRaceResults(
  seriesId: string,
  now = new Date(),
): Promise<{ race: FeedWeekendRace; livePoints?: FeedLivePoints[] }> {
  const feedSeries = FEED_SERIES[seriesId];
  if (!feedSeries) throw new Error(`no NASCAR feed for ${seriesId}`);
  const race = await latestCompletedRace(feedSeries, now);
  if (!race) throw new Error(`no completed ${seriesId} race found`);
  const dir = `${race.race_season}/${feedSeries}/${race.race_id}`;
  const weekend = await cachedJson<{ weekend_race: FeedWeekendRace[] }>(`${dir}/weekend-feed.json`, `${BASE}/${dir}/weekend-feed.json`);
  const result = weekend.weekend_race.find((r) => r.race_id === race.race_id) ?? weekend.weekend_race[0];
  if (!result?.results?.length) throw new Error('no results published yet');
  const livePoints = await cachedJson<FeedLivePoints[]>(
    `${dir}/live_points.json`,
    `https://cf.nascar.com/live/feeds/series_${feedSeries}/${race.race_id}/live_points.json`,
  ).catch(() => undefined);
  return { race: result, livePoints };
}

/** Pace at the halfway lap of the series' most recent completed race. */
export async function replayPace(seriesId: string, now = new Date()): Promise<PaceDataset> {
  const b = await replayBundle(seriesId, now);
  const key = `${seriesId}/${b.race.race_id}`;
  let data = datasets.get(key);
  if (!data) {
    data = replayPaceDataset(seriesId, b.race, b.lapTimes, b.pits, b.atLap, b.track);
    datasets.set(key, data);
  }
  return data;
}

/**
 * A team's stylized car number (transparent PNG) as NASCAR's site shows it, or null when
 * NASCAR has none for that number. Served stale if a refresh fails.
 */
export async function carBadge(seriesId: string, carNumber: string): Promise<Buffer | null> {
  const feedSeries = FEED_SERIES[seriesId];
  if (!feedSeries || !/^\d{1,3}$/.test(carNumber)) return null;
  const file = join(config.dataDir, 'nascar', 'badges', String(feedSeries), `${carNumber}.png`);
  let cached: Buffer | null = null;
  try {
    const s = await stat(file);
    cached = await readFile(file);
    if (Date.now() - s.mtimeMs < BADGE_TTL_MS) return cached;
  } catch {
    /* not cached yet */
  }
  try {
    const res = await fetch(`https://cf.nascar.com/data/images/carbadges/${feedSeries}/${carNumber}.png`, { headers: UA });
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/png')) return cached;
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, buf);
    return buf;
  } catch {
    return cached;
  }
}
