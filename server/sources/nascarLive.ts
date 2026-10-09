import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FeedLapNotes, FeedLapTimes, FeedPitStop } from '../../src/data/nascar/feed';
import { applySnapshot, backfillFromLapTimes, isRace as isRaceState, needsBackfill, toLapTimes, type FeedLiveSnapshot, type LiveState } from '../../src/data/nascar/live';
import { withChaseMarkers } from '../../src/data/nascar/names';
import type { FeedLivePoints } from '../../src/data/nascar/points';
import { config } from '../config';
import { BASE, FEED_SERIES, raceById, trackInfo, UA, type ReplayBundle } from './nascarReplay';

// Polls NASCAR's live feed and keeps the current session's laps on disk (DATA_DIR/live), so a
// restart mid-race loses nothing. Rates stay at or below what nascar.com itself uses.
const FEED_URL = 'https://cf.nascar.com/live/feeds/live-feed.json';
const ACTIVE_MS = 5_000; // DESIGN.md: poll every 5-10 s during a session
const IDLE_MS = 60_000; // feed unchanged for a while: check once a minute
const IDLE_AFTER_MS = 10 * 60_000;
const EXTRAS_MS = 15_000; // pit detail, live points, lap notes
const BACKFILL_MS = 60_000; // official lap times, only while laps are estimated or flags unseen
/** A finished race is kept this long after the feed goes quiet, then deleted from disk. */
const CLEAR_AFTER_MS = 60 * 60_000;

let state: LiveState | null = null;
let lastModified: string | null = null;
let pits: FeedPitStop[] = [];
let points: FeedLivePoints[] | undefined;
/** Lap notes and the race they belong to (so a new session never shows the last one's). */
let notes: { raceId: number; data: FeedLapNotes } | undefined;
let extrasAt = 0;
let backfillAt = 0;
let lastFeedChange = 0;
/** Last time NASCAR answered (a fresh copy, or 304 = unchanged). */
let lastPolledOk = 0;
let started = false;

const stateFile = () => join(config.dataDir, 'live', 'current.json');

async function save() {
  if (!state) return;
  const file = stateFile();
  await mkdir(join(config.dataDir, 'live'), { recursive: true });
  // Write-then-rename so a crash mid-write never leaves a corrupt file.
  await writeFile(`${file}.tmp`, JSON.stringify({ state, pits, points, notes }));
  await rename(`${file}.tmp`, file);
}

/** Deletes the saved race once it's over and the feed has been quiet for CLEAR_AFTER_MS. */
async function clearIfFinished() {
  if (!state || !isRaceState(state) || state.lap < state.lapsInRace) return;
  if (Date.now() - lastFeedChange < CLEAR_AFTER_MS) return;
  console.log(`live: race ${state.raceId} finished; clearing the saved session`);
  state = null;
  pits = [];
  points = undefined;
  notes = undefined;
  await rm(stateFile(), { force: true });
}

async function load() {
  try {
    const saved = JSON.parse(await readFile(stateFile(), 'utf8'));
    state = saved.state;
    pits = saved.pits ?? [];
    points = saved.points;
    notes = saved.notes;
    lastFeedChange = state?.updatedAt ?? 0;
  } catch {
    /* first run */
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: UA });
  return res.ok ? ((await res.json()) as T) : null;
}

async function refreshExtras(s: LiveState) {
  const year = new Date().getFullYear();
  const [p, lp, ln] = await Promise.all([
    fetchJson<FeedPitStop[]>(`${BASE}/${year}/${s.seriesId}/${s.raceId}/live-pit-data.json`).catch(() => null),
    fetchJson<FeedLivePoints[]>(`https://cf.nascar.com/live/feeds/series_${s.seriesId}/${s.raceId}/live_points.json`).catch(
      () => null,
    ),
    fetchJson<FeedLapNotes>(`${BASE}/${year}/${s.seriesId}/${s.raceId}/lap-notes.json`).catch(() => null),
  ]);
  if (p) pits = p;
  if (lp) points = lp;
  if (ln?.laps) notes = { raceId: s.raceId, data: ln };
  // After a restart (or joining late), swap estimated laps for NASCAR's official ones.
  if (isRaceState(s) && needsBackfill(s) && Date.now() - backfillAt > BACKFILL_MS) {
    backfillAt = Date.now();
    const official = await fetchJson<FeedLapTimes>(`${BASE}/${year}/${s.seriesId}/${s.raceId}/lap-times.json`).catch(() => null);
    if (official?.laps && state?.key === s.key) state = backfillFromLapTimes(state, official);
  }
}

async function poll(): Promise<number> {
  const headers: Record<string, string> = { ...UA };
  if (lastModified) headers['If-Modified-Since'] = lastModified;
  const res = await fetch(FEED_URL, { headers });
  if (res.status === 200 || res.status === 304) lastPolledOk = Date.now();
  if (res.status === 200) {
    lastModified = res.headers.get('last-modified');
    const snap = (await res.json()) as FeedLiveSnapshot;
    // Don't start recording a race that has already finished (e.g. the saved copy was cleared,
    // or the server came up after the checkered): the replay files cover it.
    if (!state && snap.run_type === 3 && snap.lap_number >= snap.laps_in_race) return IDLE_MS;
    const next = applySnapshot(state, snap, Date.now());
    if (next !== state && next.updatedAt !== state?.updatedAt) lastFeedChange = Date.now();
    state = next;
    if (Date.now() - extrasAt > EXTRAS_MS) {
      extrasAt = Date.now();
      await refreshExtras(state);
    }
    await save();
  } else if (res.status !== 304) {
    throw new Error(`live feed ${res.status}`);
  }
  await clearIfFinished();
  return Date.now() - lastFeedChange > IDLE_AFTER_MS ? IDLE_MS : ACTIVE_MS;
}

/** Starts polling once; safe to call more than once. */
export async function startLiveCollector() {
  if (started) return;
  started = true;
  await load();
  const loop = async () => {
    let wait = IDLE_MS;
    try {
      wait = await poll();
    } catch (e) {
      console.warn('live feed poll failed:', (e as Error).message);
    }
    setTimeout(loop, wait).unref();
  };
  void loop();
}

const SERIES_BY_FEED = Object.fromEntries(Object.entries(FEED_SERIES).map(([id, n]) => [n, id]));

export interface LiveStatus {
  seriesId: string;
  raceId: number;
  runName: string;
  isRace: boolean;
  lap: number;
  lapsInRace: number;
  flag: number;
  /** ms epoch of the last change seen in the feed (a lap completed, flag change). */
  updatedAt: number;
  /** ms epoch of the server's last successful check of the feed. */
  polledAt: number;
  /** True while the feed is still changing (not idle). */
  active: boolean;
}

export function liveStatus(): LiveStatus | null {
  if (!state) return null;
  const seriesId = SERIES_BY_FEED[state.seriesId];
  if (!seriesId) return null;
  return {
    seriesId,
    raceId: state.raceId,
    runName: state.runName,
    isRace: state.runType === 3,
    lap: state.lap,
    lapsInRace: state.lapsInRace,
    flag: state.flag,
    updatedAt: state.updatedAt,
    polledAt: lastPolledOk,
    active: Date.now() - lastFeedChange < IDLE_AFTER_MS,
  };
}

export interface LiveBundle extends ReplayBundle {
  live: true;
  /** Feed flag code right now (the lap in progress), not the last completed lap's. */
  currentFlag: number;
  runName: string;
  isRace: boolean;
  updatedAt: number;
}

/** The current live session for this series, in the same shape as a replay bundle; or null. */
export async function liveBundle(seriesId: string): Promise<LiveBundle | null> {
  const s = state;
  if (!s || SERIES_BY_FEED[s.seriesId] !== seriesId) return null;
  const race = await raceById(s.seriesId, s.raceId);
  if (!race) return null;
  const isRace = s.runType === 3;
  return {
    live: true,
    currentFlag: s.flag,
    runName: s.runName,
    isRace,
    updatedAt: s.updatedAt,
    // Practice/qualifying have no lap count or stages; the race uses the schedule's.
    race: isRace ? { ...race, actual_laps: null } : { ...race, actual_laps: null, scheduled_laps: 0, stage_1_laps: null, stage_2_laps: null, stage_3_laps: null, stage_4_laps: null },
    // The points file is the Chase authority in a race; practice has only the snapshot's flag.
    lapTimes: withChaseMarkers(
      toLapTimes(s),
      new Set(
        isRace && points?.length
          ? points.filter((d) => d.is_in_chase).map((d) => d.car_number)
          : Object.entries(s.cars).filter(([, c]) => c.inChase).map(([num]) => num),
      ),
    ),
    pits: pits.filter((p) => p.lap_count > 0),
    track: await trackInfo(race.track_id),
    livePoints: isRace ? points : undefined,
    lapNotes: notes?.raceId === s.raceId ? notes.data : undefined,
    results: undefined,
    atLap: s.lap,
  };
}
