import { FLAG_GREEN, type FeedLapTimes, type FeedPitStop } from './feed';

export type StopKind = 'four' | 'two' | 'fuel';

export interface Stop {
  carNumber: string;
  driverName: string;
  /** Leader's lap when the car pitted (for "when"), and the car's own lap (for its stints). */
  leaderLap: number;
  ownLap: number;
  kind: StopKind;
  underGreen: boolean;
  /** Seconds stopped in the box; null when the feed has no value (-1). */
  boxTime: number | null;
  /** Seconds from pit entry to exit; null when missing. */
  laneTime: number | null;
  positionsGained: number;
  raceTime: number;
}

const tiresChanged = (p: FeedPitStop) =>
  [p.left_front_tire_changed, p.left_rear_tire_changed, p.right_front_tire_changed, p.right_rear_tire_changed].filter(
    Boolean,
  ).length;

/**
 * Stops made by the time the leader completed `atLap`. Green vs. caution comes from the
 * lap flags (the pit feed's own flag codes don't match the lap feed's).
 */
export function stopsUpTo(lapTimes: FeedLapTimes, pits: FeedPitStop[], atLap: number): Stop[] {
  const flagAt = new Map(lapTimes.flags.map((f) => [f.LapsCompleted, f.FlagState]));
  return pits
    .filter((p) => p.lap_count > 0 && (p.leader_lap ?? p.lap_count) <= atLap)
    .map((p) => {
      const tires = tiresChanged(p);
      const leaderLap = p.leader_lap ?? p.lap_count;
      return {
        carNumber: p.vehicle_number,
        driverName: p.driver_name ?? '',
        leaderLap,
        ownLap: p.lap_count,
        kind: tires >= 4 ? 'four' : tires > 0 ? 'two' : 'fuel',
        underGreen: flagAt.get(leaderLap) === FLAG_GREEN,
        boxTime: (p.pit_stop_duration ?? -1) > 0 ? p.pit_stop_duration! : null,
        laneTime: (p.total_duration ?? -1) > 0 ? p.total_duration! : null,
        positionsGained: p.positions_gained_lost ?? 0,
        raceTime: p.pit_in_race_time ?? 0,
      };
    });
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

/**
 * Box times that represent a normal service of this kind: drops repairs, penalties and
 * other long stops (over 1.5x the field median for the same kind).
 */
export function normalStops(stops: Stop[], kind: StopKind): Stop[] {
  const withTime = stops.filter((s) => s.kind === kind && s.boxTime !== null);
  const cap = median(withTime.map((s) => s.boxTime!)) * 1.5;
  return withTime.filter((s) => s.boxTime! <= cap);
}

export interface CrewAverage {
  carNumber: string;
  driverName: string;
  stops: number;
  average: number;
  best: number;
}

/** Average box time per car for normal stops of `kind`, fastest first. */
export function crewAverages(stops: Stop[], kind: StopKind): CrewAverage[] {
  const byCar = Map.groupBy(normalStops(stops, kind), (s) => s.carNumber);
  return [...byCar.values()]
    .map((list) => ({
      carNumber: list[0]!.carNumber,
      driverName: list[0]!.driverName,
      stops: list.length,
      average: list.reduce((a, s) => a + s.boxTime!, 0) / list.length,
      best: Math.min(...list.map((s) => s.boxTime!)),
    }))
    .sort((a, b) => a.average - b.average);
}

export interface Stint {
  fromLap: number;
  toLap: number;
  /** How the stint started: 'start' for the green flag, else the stop that began it. */
  start: 'start' | StopKind;
}

/** A car's stints over its own laps 1..ownLaps, split at each stop. */
export function stints(stops: Stop[], carNumber: string, ownLaps: number): Stint[] {
  const mine = stops.filter((s) => s.carNumber === carNumber && s.ownLap < ownLaps).sort((a, b) => a.ownLap - b.ownLap);
  const out: Stint[] = [];
  let from = 1;
  let start: Stint['start'] = 'start';
  for (const s of mine) {
    if (s.ownLap >= from) out.push({ fromLap: from, toLap: s.ownLap, start });
    from = s.ownLap + 1;
    start = s.kind;
  }
  if (ownLaps >= from) out.push({ fromLap: from, toLap: ownLaps, start });
  return out;
}
