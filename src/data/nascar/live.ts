import type { FeedLapTimes } from './feed';

// NASCAR's live feed (cf.nascar.com/live/feeds/live-feed.json) is a snapshot of the current
// session, not a history. The collector turns successive snapshots into the same lap-by-lap
// shape as the replay files, so every view runs unchanged on live data.

export interface FeedLiveVehicle {
  vehicle_number: string;
  driver: { driver_id: number; full_name: string; first_name: string; last_name: string; is_in_chase?: boolean };
  running_position: number;
  laps_completed: number;
  last_lap_time: number;
  last_lap_speed: number;
  /** Seconds since the session started, as of the car's latest timing line. */
  vehicle_elapsed_time: number;
  status: number;
}

export interface FeedLiveSnapshot {
  series_id: number;
  race_id: number;
  run_id: number;
  run_name: string;
  /** 1 practice, 2 qualifying, 3 race (observed: 1 for practice). */
  run_type: number;
  lap_number: number;
  laps_in_race: number;
  flag_state: number;
  track_name: string;
  stage?: { stage_num: number; finish_at_lap: number; laps_in_stage: number };
  vehicles: FeedLiveVehicle[];
}

interface RecordedLap {
  lap: number;
  time: number;
  speed: number | null;
  pos: number;
  /** Session clock at this crossing. */
  at: number;
  /** True when filled in for laps missed between polls (time is an even split). */
  estimated: boolean;
}

export interface LiveState {
  key: string;
  seriesId: number;
  raceId: number;
  runId: number;
  runName: string;
  runType: number;
  lapsInRace: number;
  trackName: string;
  /** Leader's completed laps at the last snapshot. */
  lap: number;
  flag: number;
  /** Flag state per lap number (the lap being run), recorded as seen. */
  flags: Record<number, number>;
  cars: Record<string, { fullName: string; inChase?: boolean; laps: RecordedLap[] }>;
  /** ms epoch of the last snapshot that changed anything. */
  updatedAt: number;
}

export const sessionKey = (s: Pick<FeedLiveSnapshot, 'series_id' | 'race_id' | 'run_id'>) =>
  `${s.series_id}-${s.race_id}-${s.run_id}`;

export const isRace = (s: Pick<LiveState, 'runType'>) => s.runType === 3;

/** Folds one snapshot into the session state (starting fresh when the session changes). */
export function applySnapshot(prev: LiveState | null, snap: FeedLiveSnapshot, now: number): LiveState {
  const key = sessionKey(snap);
  const state: LiveState =
    prev && prev.key === key
      ? { ...prev, flags: { ...prev.flags }, cars: { ...prev.cars } }
      : {
          key,
          seriesId: snap.series_id,
          raceId: snap.race_id,
          runId: snap.run_id,
          runName: snap.run_name,
          runType: snap.run_type,
          lapsInRace: snap.laps_in_race,
          trackName: snap.track_name,
          lap: 0,
          flag: snap.flag_state,
          flags: {},
          cars: {},
          updatedAt: now,
        };

  let changed = !prev || prev.key !== key || prev.flag !== snap.flag_state || prev.lap !== snap.lap_number;
  state.lap = snap.lap_number;
  state.flag = snap.flag_state;
  state.lapsInRace = snap.laps_in_race;
  // The lap being run now is lap_number + 1; keep the first flag seen for a lap unless it
  // goes from green to caution (a caution during the lap marks the whole lap). A red flag
  // sticks: the caution that resumes after it on the same lap must not erase it.
  const current = snap.lap_number + 1;
  const RED = 3;
  if (state.flags[current] === undefined || (snap.flag_state !== 1 && state.flags[current] !== RED)) state.flags[current] = snap.flag_state;

  for (const v of snap.vehicles) {
    const prevCar = state.cars[v.vehicle_number];
    const laps = prevCar ? [...prevCar.laps] : [];
    const last = laps.at(-1);
    const done = last?.lap ?? 0;
    if (v.laps_completed > done && v.vehicle_elapsed_time > (last?.at ?? 0)) {
      const missed = v.laps_completed - done;
      const span = v.vehicle_elapsed_time - (last?.at ?? 0);
      // Exactly one new lap with a known previous crossing: the feed's lap time is exact.
      const exact = missed === 1 && (last !== undefined || done === 0);
      for (let i = 1; i <= missed; i++) {
        const isLast = i === missed;
        laps.push({
          lap: done + i,
          time: exact ? v.last_lap_time || span : span / missed,
          speed: exact && isLast ? v.last_lap_speed || null : null,
          pos: v.running_position,
          at: (last?.at ?? 0) + (span * i) / missed,
          estimated: !exact,
        });
      }
      changed = true;
    }
    state.cars[v.vehicle_number] = { fullName: v.driver.full_name, inChase: v.driver.is_in_chase, laps };
  }
  if (changed) state.updatedAt = now;
  return state;
}

/** The session so far in the replay files' shape. Estimated laps carry no speed and are marked. */
export function toLapTimes(state: LiveState): FeedLapTimes {
  const maxLap = Math.max(state.lap, ...Object.values(state.cars).map((c) => c.laps.at(-1)?.lap ?? 0));
  const flags = [{ LapsCompleted: 0, FlagState: 8 }];
  // A lap with no flag seen (laps run faster than a poll, or the server was down) takes the
  // flag around it only when the flags on both sides agree; otherwise it's unknown (8), so a
  // recording gap never reads as a caution or a restart.
  // Flags are also kept for the lap in progress (lap + 1), and the current flag is known.
  const lastFlagged = Math.max(maxLap + 1, ...Object.keys(state.flags).map(Number));
  const nextSeen = (from: number) => {
    for (let lap = from; lap <= lastFlagged; lap++) if (state.flags[lap] !== undefined) return state.flags[lap];
    return state.flag;
  };
  let carry = 1;
  for (let lap = 1; lap <= maxLap; lap++) {
    const seen = state.flags[lap];
    if (seen !== undefined) carry = seen;
    const next = seen ?? nextSeen(lap + 1);
    flags.push({ LapsCompleted: lap, FlagState: seen ?? (next === undefined || next === carry ? carry : 8) });
  }
  return {
    flags,
    laps: Object.entries(state.cars).map(([num, c]) => ({
      Number: num,
      FullName: c.fullName,
      Laps: [
        { Lap: 0, LapTime: null, RunningPos: c.laps[0]?.pos ?? 0 },
        ...c.laps.map((l) => ({
          Lap: l.lap,
          LapTime: l.time,
          LapSpeed: l.speed === null ? null : String(l.speed),
          RunningPos: l.pos,
          Estimated: l.estimated || undefined,
        })),
      ],
    })),
  };
}

/**
 * Swaps estimated laps (time split evenly over a recording gap, e.g. a server restart) for
 * NASCAR's official lap-times.json, which is published live during races, and fills in flags
 * for laps the collector never saw. Laps recorded exactly are left as they are.
 */
export function backfillFromLapTimes(state: LiveState, official: FeedLapTimes): LiveState {
  const flags = { ...state.flags };
  for (const f of official.flags) if (f.LapsCompleted > 0 && flags[f.LapsCompleted] === undefined) flags[f.LapsCompleted] = f.FlagState;

  const cars = { ...state.cars };
  for (const c of official.laps) {
    const mine = cars[c.Number];
    if (!mine?.laps.some((l) => l.estimated)) continue;
    const byLap = new Map(c.Laps.map((l) => [l.Lap, l]));
    let prevAt = 0;
    const laps = mine.laps.map((l) => {
      const o = byLap.get(l.lap);
      if (!l.estimated || !o || o.LapTime == null || !(o.LapTime > 0)) {
        prevAt = l.at;
        return l;
      }
      // Crossing times rebuilt from the official lap times, chained from the last known one.
      prevAt += o.LapTime;
      return { ...l, time: o.LapTime, speed: o.LapSpeed ? Number(o.LapSpeed) || null : null, pos: o.RunningPos || l.pos, at: prevAt, estimated: false };
    });
    cars[c.Number] = { ...mine, laps };
  }
  return { ...state, flags, cars };
}

/** Whether the collector is missing anything lap-times.json could supply. */
export const needsBackfill = (s: LiveState) =>
  Object.values(s.cars).some((c) => c.laps.some((l) => l.estimated)) ||
  Array.from({ length: s.lap }, (_, i) => s.flags[i + 1]).some((f) => f === undefined);
