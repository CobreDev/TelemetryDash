import { FLAG_GREEN, type FeedLapTimes, type FeedPitStop } from './feed';

/**
 * Tire-age-adjusted pace, using only laps 1..upToLap.
 *
 * Clean laps: green flag, not a restart lap, not a pit-in or pit-out lap, and within 7% of
 * the driver's own median (drops traffic, spins and damage laps). Tire age is laps since the
 * last stop that changed any tire; fuel-only stops don't reset it. One field-wide falloff
 * rate is fitted within stints, and each driver's pace is their mean lap with that falloff
 * removed: their expected lap on fresh tires.
 */
export interface PaceResult {
  carNumber: string;
  fullName: string;
  paceScore: number | null;
  cleanLaps: number;
  excluded?: string;
}

const OUTLIER = 1.07;
const MIN_STINT_LAPS = 5;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const tiresChanged = (p: FeedPitStop) =>
  p.left_front_tire_changed || p.left_rear_tire_changed || p.right_front_tire_changed || p.right_rear_tire_changed;

export function computePace(
  lapTimes: FeedLapTimes,
  pits: FeedPitStop[],
  upToLap: number,
): { results: PaceResult[]; falloffPerLap: number } {
  const flagAt = new Map(lapTimes.flags.map((f) => [f.LapsCompleted, f.FlagState]));
  const isGreen = (lap: number) => flagAt.get(lap) === FLAG_GREEN;
  // A lap counts only if it and the lap before were green (drops restarts and the start).
  const clean = (lap: number) => isGreen(lap) && isGreen(lap - 1);

  type Lap = { t: number; age: number; stint: number };
  const perCar = lapTimes.laps.map((car) => {
    const stops = pits.filter((p) => p.vehicle_number === car.Number && p.lap_count > 0 && p.lap_count <= upToLap);
    const pitLaps = new Set(stops.flatMap((p) => [p.lap_count, p.lap_count + 1]));
    const tireStops = stops.filter(tiresChanged).map((p) => p.lap_count).sort((a, b) => a - b);

    const laps: Lap[] = [];
    for (const l of car.Laps) {
      if (l.Lap < 1 || l.Lap > upToLap || !l.LapTime || l.Estimated || pitLaps.has(l.Lap) || !clean(l.Lap)) continue;
      const lastStop = tireStops.filter((s) => s < l.Lap).at(-1) ?? 0;
      laps.push({ t: l.LapTime, age: l.Lap - lastStop, stint: lastStop });
    }
    const med = laps.length ? median(laps.map((l) => l.t)) : 0;
    return { car, laps: laps.filter((l) => l.t <= med * OUTLIER) };
  });

  // Pooled within-stint regression of lap time on tire age.
  let sxy = 0;
  let sxx = 0;
  for (const { laps } of perCar) {
    const stints = Map.groupBy(laps, (l) => l.stint);
    for (const s of stints.values()) {
      if (s.length < MIN_STINT_LAPS) continue;
      const ma = s.reduce((a, l) => a + l.age, 0) / s.length;
      const mt = s.reduce((a, l) => a + l.t, 0) / s.length;
      for (const l of s) {
        sxy += (l.age - ma) * (l.t - mt);
        sxx += (l.age - ma) ** 2;
      }
    }
  }
  const falloffPerLap = sxx > 0 ? sxy / sxx : 0;

  // Cars need at least half the typical clean-lap count to be ranked fairly.
  const typical = median(perCar.map((c) => c.laps.length).filter((n) => n > 0));
  const minLaps = Math.max(10, Math.ceil(typical / 2));

  const results = perCar.map(({ car, laps }): PaceResult => {
    const base = { carNumber: car.Number, fullName: car.FullName, cleanLaps: laps.length };
    if (laps.length < minLaps) return { ...base, paceScore: null, excluded: 'too few green-flag laps' };
    const adjusted = laps.reduce((a, l) => a + (l.t - falloffPerLap * l.age), 0) / laps.length;
    return { ...base, paceScore: adjusted };
  });
  return { results, falloffPerLap };
}
