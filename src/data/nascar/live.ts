import type { FeedLapTimes } from './feed';

// NASCAR's live feed (cf.nascar.com/live/feeds/live-feed.json) is a snapshot of the current
// session, not a history. The collector turns successive snapshots into the same lap-by-lap
// shape as the replay files, so every view runs unchanged on live data.

export interface FeedLiveVehicle {
  vehicle_number: string;
  driver: { driver_id: number; full_name: string; first_name: string; last_name: string; is_in_chase?: boolean };
  running_position: number;
  /** Starting spot (0 or missing in practice). */
  starting_position?: number;
  laps_completed: number;
  /** The car's fastest lap so far, per NASCAR: lap number, seconds and mph. */
  best_lap?: number;
  best_lap_time?: number;
  best_lap_speed?: number;
  last_lap_time: number;
  last_lap_speed: number;
  /** Seconds since the session started, as of the car's latest timing line. */
  vehicle_elapsed_time: number;
  /** Undocumented: 1 running, 2 seen briefly on pit road, 3 and up out of the race. */
  status: number;
  /** False while on pit road. */
  is_on_track?: boolean;
  /** On the damaged vehicle policy clock. */
  is_on_dvp?: boolean;
  /** NASCAR's gap to the leader: seconds, or minus the laps down (-2 = two laps down). */
  delta?: number;
  /** "Chv", "Frd", "Tyt" */
  vehicle_manufacturer?: string;
  /** This race's stops; the last is the one in progress while the car is on pit road. */
  pit_stops?: { pit_in_rank: number; pit_out_rank: number; pit_in_lap_count: number; pit_in_elapsed_time: number }[];
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
  laps_to_go?: number;
  number_of_caution_segments?: number;
  number_of_caution_laps?: number;
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
  /** `start`: running position before the car's first lap (the starting order). */
  cars: Record<string, LiveCar>;
  /** NASCAR's own race counters, as of the last snapshot. */
  lapsToGo?: number;
  cautions?: { count: number; laps: number };
  /** ms epoch of the last snapshot that changed anything. */
  updatedAt: number;
}

export interface LiveCar {
  fullName: string;
  inChase?: boolean;
  start?: number;
  laps: RecordedLap[];
  /** Feed status (1 = running), pit road, DVP clock and make, as of the last snapshot. */
  status?: number;
  onTrack?: boolean;
  dvp?: boolean;
  make?: string;
  /** NASCAR's running position and gap to the leader now, and where it ran entering pit road. */
  pos?: number;
  delta?: number;
  pitInRank?: number;
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
  state.lapsToGo = snap.laps_to_go;
  state.cautions =
    snap.number_of_caution_segments === undefined ? undefined : { count: snap.number_of_caution_segments, laps: snap.number_of_caution_laps ?? 0 };
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
    // NASCAR's own best lap fixes a lap we only estimated (run while the server was down).
    const bi = v.best_lap ? laps.findIndex((l) => l.lap === v.best_lap && l.estimated) : -1;
    if (bi >= 0 && v.best_lap_time! > 0) {
      laps[bi] = { ...laps[bi]!, time: v.best_lap_time!, speed: v.best_lap_speed || null, estimated: false };
      changed = true;
    }
    // The starting spot; before the green the running order is the same thing.
    const start = v.starting_position || (laps.length ? prevCar?.start : v.running_position || prevCar?.start);
    const car: LiveCar = { fullName: v.driver.full_name, inChase: v.driver.is_in_chase, start, laps, status: v.status, onTrack: v.is_on_track, dvp: v.is_on_dvp, make: v.vehicle_manufacturer,
      pos: v.running_position, delta: v.delta, pitInRank: v.pit_stops?.at(-1)?.pit_in_rank || undefined };
    if (prevCar && prevCar.pos !== car.pos && car.onTrack === false) changed = true;
    // A car leaving pit road, going out or onto the DVP clock is news even without a lap.
    if (prevCar && (prevCar.status !== car.status || prevCar.onTrack !== car.onTrack || prevCar.dvp !== car.dvp || prevCar.pos !== car.pos)) changed = true;
    state.cars[v.vehicle_number] = car;
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
        { Lap: 0, LapTime: null, RunningPos: c.start ?? c.laps[0]?.pos ?? 0 },
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
