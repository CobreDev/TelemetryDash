import { FLAG_GREEN, type FeedLapTimes, type FeedPitStop } from './feed';

/** Fuel burned on a caution lap relative to a green lap. An assumption, not published data. */
export const CAUTION_BURN = 0.35;

export interface FuelModel {
  /** Green-equivalent laps the field's longest run used; taken as one full tank. 0 = unknown. */
  tankLaps: number;
  /** Green-equivalent laps between two laps inclusive (caution laps count CAUTION_BURN). */
  greenEquivalent(from: number, to: number): number;
}

/**
 * NASCAR publishes no fuel data, so fuel is modeled: every stop fills the tank, and the
 * longest run any car has made between stops so far is assumed to have used one full tank.
 */
export function fuelModel(lapTimes: FeedLapTimes, pits: FeedPitStop[], atLap: number): FuelModel {
  const flagAt = new Map(lapTimes.flags.map((f) => [f.LapsCompleted, f.FlagState]));
  const greenEquivalent = (from: number, to: number) => {
    let n = 0;
    for (let lap = from; lap <= to; lap++) n += flagAt.get(lap) === FLAG_GREEN ? 1 : CAUTION_BURN;
    return n;
  };
  let tankLaps = 0;
  for (const car of lapTimes.laps) {
    const stops = pits
      .filter((p) => p.vehicle_number === car.Number && p.lap_count > 0 && p.lap_count <= atLap)
      .map((p) => p.lap_count)
      .sort((a, b) => a - b);
    let prev = 0;
    for (const s of stops) {
      tankLaps = Math.max(tankLaps, greenEquivalent(prev + 1, s));
      prev = s;
    }
  }
  return { tankLaps, greenEquivalent };
}

/** 0..1 of a tank left after running from the lap after `lastStop` through `ownLap`. */
export function fuelLeft(m: FuelModel, lastStop: number, ownLap: number): number | null {
  if (m.tankLaps <= 0) return null;
  return Math.max(0, 1 - m.greenEquivalent(lastStop + 1, ownLap) / m.tankLaps);
}
