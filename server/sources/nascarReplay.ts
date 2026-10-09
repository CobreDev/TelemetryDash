import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { easternToEpoch, type FeedLapTimes, type FeedPitStop, type FeedRace } from '../../src/data/nascar/feed';
import { halfwayLap, replayPaceDataset } from '../../src/data/nascar/replay';
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
  /** The lap the replay is "live" at: halfway. */
  atLap: number;
}

const bundles = new Map<string, Promise<ReplayBundle>>();
const datasets = new Map<string, PaceDataset>();

/** Raw files for the series' most recent completed race, replayed at its halfway lap. */
export async function replayBundle(seriesId: string, now = new Date()): Promise<ReplayBundle> {
  const feedSeries = FEED_SERIES[seriesId];
  if (!feedSeries) throw new Error(`no NASCAR feed for ${seriesId}`);
  const race = await latestCompletedRace(feedSeries, now);
  if (!race) throw new Error(`no completed ${seriesId} race found`);

  const key = `${seriesId}/${race.race_id}`;
  let hit = bundles.get(key);
  if (!hit) {
    hit = (async () => {
      const dir = `${race.race_season}/${feedSeries}/${race.race_id}`;
      const lapTimes = await cachedJson<FeedLapTimes>(`${dir}/lap-times.json`, `${BASE}/${dir}/lap-times.json`);
      const pits = await cachedJson<FeedPitStop[]>(`${dir}/live-pit-data.json`, `${BASE}/${dir}/live-pit-data.json`);
      const track = await trackInfo(race.track_id);
      // Points data is optional: the timing views still work without it.
      const livePoints = await cachedJson<FeedLivePoints[]>(
        `${dir}/live_points.json`,
        `https://cf.nascar.com/live/feeds/series_${feedSeries}/${race.race_id}/live_points.json`,
      ).catch(() => undefined);
      const results = await cachedJson<{ weekend_race: { results: FeedResult[] }[] }>(
        `${dir}/weekend-feed.json`,
        `${BASE}/${dir}/weekend-feed.json`,
      )
        .then((w) => w.weekend_race[0]?.results)
        .catch(() => undefined);
      return { race, lapTimes, pits, track, livePoints, results, atLap: halfwayLap(race) };
    })();
    hit.catch(() => bundles.delete(key)); // retry on the next request after a failure
    bundles.set(key, hit);
  }
  return hit;
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
