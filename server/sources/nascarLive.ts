import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { easternToEpoch, withRaceLength, type FeedLapNotes, type FeedLapTimes, type FeedPitStop } from '../../src/data/nascar/feed';
import { applySnapshot, backfillFromLapTimes, isRace as isRaceState, needsBackfill, toLapTimes, type FeedLiveSnapshot, type LiveState } from '../../src/data/nascar/live';
import { makeOf, type CarInfo } from '../../src/data/nascar/cars';
import { withChaseMarkers } from '../../src/data/nascar/names';
import { weekendEndsAt } from '../../src/data/nascar/weekend';
import type { FeedLivePoints } from '../../src/data/nascar/points';
import { config } from '../config';
import { BASE, FEED_SERIES, raceById, trackInfo, UA, type RaceBundle } from './nascarReplay';

// Polls NASCAR's live feed and keeps the current session's laps on disk (DATA_DIR/live), so a
// restart mid-race loses nothing. Rates stay at or below what nascar.com itself uses.
const FEED_URL = 'https://cf.nascar.com/live/feeds/live-feed.json';
const ACTIVE_MS = 5_000; // DESIGN.md: poll every 5-10 s during a session
/**
 * NASCAR's CDN refreshes the live feed every 30 s (`Age` counts up to 30, then a new copy).
 * During a session the next poll is timed to land just after the next copy instead of on a
 * blind timer, then retries every ACTIVE_RETRY_MS until it changes.
 */
const FEED_CYCLE_S = 30;
const ACTIVE_RETRY_MS = 2_000;
const IDLE_MS = 60_000; // feed unchanged for a while: check once a minute
const IDLE_AFTER_MS = 10 * 60_000;
/** An unfinished race counts as live from this long before its scheduled start... */
const PRE_RACE_MS = 90 * 60_000;
/** ...until this long after (pre-race and pace laps leave the feed unchanged for a while). */
const RACE_WINDOW_MS = 6 * 3600_000;
const EXTRAS_MS = 15_000; // pit detail, live points, lap notes
const BACKFILL_MS = 60_000; // official lap times, only while laps are estimated or flags unseen

let state: LiveState | null = null;
let lastModified: string | null = null;
let pits: FeedPitStop[] = [];
let points: FeedLivePoints[] | undefined;
/** Lap notes and the race they belong to (so a new session never shows the last one's). */
let notes: { raceId: number; data: FeedLapNotes } | undefined;
let extrasAt = 0;
let backfillAt = 0;
let lastFeedChange = 0;
/** Scheduled start of the race being recorded (from the schedule; ms epoch). */
let scheduled: { raceId: number; startsAt: number } | undefined;
/** Last time NASCAR answered (a fresh copy, or 304 = unchanged). */
let lastPolledOk = 0;
/** Last time anything served changed: laps, flags, car status, pits, points or notes. */
let dataAt = 0;
let started = false;
const seenStatus = new Set<number>([1]);

const stateFile = () => join(config.dataDir, 'live', 'current.json');

async function save() {
  if (!state) return;
  const file = stateFile();
  await mkdir(join(config.dataDir, 'live'), { recursive: true });
  // Write-then-rename so a crash mid-write never leaves a corrupt file.
  await writeFile(`${file}.tmp`, JSON.stringify({ state, pits, points, notes }));
  await rename(`${file}.tmp`, file);
}

/** Deletes the saved race once it's over and its race weekend has ended (Monday 00:00 ET). */
async function clearIfFinished() {
  if (!state || !isRaceState(state) || state.lap < state.lapsInRace) return;
  const race = await raceById(state.seriesId, state.raceId).catch(() => undefined);
  if (race && Date.now() < weekendEndsAt(race.race_date)) return;
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
  const before = JSON.stringify([pits, points, notes?.data]);
  if (p) pits = p;
  if (lp) points = lp;
  if (ln?.laps) notes = { raceId: s.raceId, data: ln };
  if (JSON.stringify([pits, points, notes?.data]) !== before) dataAt = Date.now();
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
  const age = Number(res.headers.get('age'));
  if (res.status === 200 || res.status === 304) lastPolledOk = Date.now();
  if (res.status === 200) {
    lastModified = res.headers.get('last-modified');
    const snap = (await res.json()) as FeedLiveSnapshot;
    // Don't start recording a race that has already finished (e.g. the saved copy was cleared,
    // or the server came up after the checkered): the replay files cover it.
    if (!state && snap.run_type === 3 && snap.lap_number >= snap.laps_in_race) return IDLE_MS;
    // The feed's car status codes aren't documented; log new ones so they can be mapped.
    for (const v of snap.vehicles) {
      if (!seenStatus.has(v.status)) {
        seenStatus.add(v.status);
        console.log(`live: car status ${v.status} first seen (#${v.vehicle_number}, lap ${snap.lap_number}, on track ${v.is_on_track}, DVP ${v.is_on_dvp})`);
      }
    }
    const next = applySnapshot(state, snap, Date.now());
    if (next !== state && next.updatedAt !== state?.updatedAt) lastFeedChange = dataAt = Date.now();
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
  if (state && isRaceState(state) && scheduled?.raceId !== state.raceId) {
    const race = await raceById(state.seriesId, state.raceId).catch(() => undefined);
    if (race) scheduled = { raceId: race.race_id, startsAt: easternToEpoch(race.race_date) };
  }
  if (!isActive()) return IDLE_MS;
  // Just after the CDN's next copy (age 30), or the plain rate if it doesn't say.
  if (!res.headers.has('age') || !Number.isFinite(age)) return ACTIVE_MS;
  return Math.min(15_000, Math.max(ACTIVE_RETRY_MS, (FEED_CYCLE_S - age + 1) * 1000));
}

/**
 * The session is live while the feed keeps changing, and for a race not yet finished, for its
 * whole window around the scheduled start (the field can sit on lap 0 for a long time).
 */
function isActive(now = Date.now()): boolean {
  if (now - lastFeedChange < IDLE_AFTER_MS) return true;
  if (!state || !isRaceState(state) || state.lap >= state.lapsInRace || scheduled?.raceId !== state.raceId) return false;
  return now > scheduled.startsAt - PRE_RACE_MS && now < scheduled.startsAt + RACE_WINDOW_MS;
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
  /** ms epoch of the last change to anything the views show; clients refresh when it moves. */
  dataAt: number;
}

/**
 * Whether the recorded session for this race has reached its finish: true / false, or
 * undefined when the collector isn't holding that race.
 */
export function raceFinishedLive(raceId: number): boolean | undefined {
  if (!state || state.raceId !== raceId || !isRaceState(state)) return undefined;
  return state.lap >= state.lapsInRace;
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
    active: isActive(),
    dataAt: Math.max(dataAt, state.updatedAt),
  };
}

export interface LiveBundle extends RaceBundle {
  live: true;
  /** Feed flag code right now (the lap in progress), not the last completed lap's. */
  currentFlag: number;
  runName: string;
  /** Feed run type: 1 practice, 2 qualifying, 3 race. */
  runType: number;
  isRace: boolean;
  updatedAt: number;
  /** NASCAR's laps to go (races). */
  lapsToGo?: number;
  /** NASCAR's caution count and caution laps so far (races). */
  cautions?: { count: number; laps: number };
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
    runType: s.runType,
    isRace,
    updatedAt: s.updatedAt,
    // Practice/qualifying have no lap count or stages; the race uses the schedule's.
    race: isRace ? { ...withRaceLength(race, s.lapsInRace), actual_laps: null } : { ...race, actual_laps: null, scheduled_laps: 0, stage_1_laps: null, stage_2_laps: null, stage_3_laps: null, stage_4_laps: null },
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
    lapsToGo: isRace ? s.lapsToGo : undefined,
    cautions: isRace ? s.cautions : undefined,
    carInfo: Object.fromEntries(
      Object.entries(s.cars).map(([num, c]): [string, CarInfo] => [
        num,
        { make: makeOf(c.make), out: (c.status ?? 1) >= 3, dvp: !!c.dvp, pit: c.onTrack === false, position: c.pos, gap: c.delta, pitInRank: c.pitInRank },
      ]),
    ),
    results: undefined,
    atLap: s.lap,
  };
}
