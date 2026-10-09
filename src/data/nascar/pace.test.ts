import { describe, expect, it } from 'vitest';
import type { FeedLapTimes, FeedPitStop } from './feed';
import { computePace } from './pace';

const FALLOFF = 0.05;
const N = 60;

// Two cars, green all race except a caution on laps 30-31. Both pit for four tires on lap 30.
// Car "1" is 0.2s faster on fresh tires; car "2" never pitted so its tires are older.
function feed(): { lapTimes: FeedLapTimes; pits: FeedPitStop[] } {
  const flags = [{ LapsCompleted: 0, FlagState: 8 }];
  for (let lap = 1; lap <= N; lap++) flags.push({ LapsCompleted: lap, FlagState: lap === 30 || lap === 31 ? 2 : 1 });
  const laps = (num: string, base: number, stopLap: number | null) => ({
    Number: num,
    FullName: `Driver ${num}`,
    Laps: Array.from({ length: N + 1 }, (_, lap) => {
      const age = stopLap && lap > stopLap ? lap - stopLap : lap;
      return { Lap: lap, LapTime: lap === 0 ? null : base + FALLOFF * age, RunningPos: 1 };
    }),
  });
  const stop = (num: string, lap: number, tires: boolean): FeedPitStop => ({
    vehicle_number: num,
    lap_count: lap,
    pit_stop_type: tires ? 'FOUR_WHEEL_CHANGE' : 'OTHER',
    left_front_tire_changed: tires,
    left_rear_tire_changed: tires,
    right_front_tire_changed: tires,
    right_rear_tire_changed: tires,
  });
  return {
    lapTimes: { flags, laps: [laps('1', 30, 30), laps('2', 30.2, null)] },
    pits: [stop('1', 30, true), stop('2', 30, false)],
  };
}

describe('computePace', () => {
  it('recovers the falloff rate and fresh-tire pace', () => {
    const { lapTimes, pits } = feed();
    const { results, falloffPerLap } = computePace(lapTimes, pits, N);
    expect(falloffPerLap).toBeCloseTo(FALLOFF, 6);
    expect(results[0]!.paceScore).toBeCloseTo(30, 6);
    // Fuel-only stop doesn't reset tire age, so car 2 is still judged on fresh-tire pace.
    expect(results[1]!.paceScore).toBeCloseTo(30.2, 6);
  });

  it('ignores laps after the cutoff', () => {
    const { lapTimes, pits } = feed();
    lapTimes.laps[0]!.Laps[50]!.LapTime = 99;
    const { results } = computePace(lapTimes, pits, 45);
    expect(results[0]!.paceScore).toBeCloseTo(30, 6);
  });

  it('skips caution, restart and pit laps', () => {
    const { lapTimes, pits } = feed();
    for (const lap of [1, 30, 31, 32]) lapTimes.laps[0]!.Laps[lap]!.LapTime = 99; // start, caution, restart
    expect(computePace(lapTimes, pits, N).results[0]!.paceScore).toBeCloseTo(30, 6);
  });

  it('excludes cars with too few clean laps', () => {
    const { lapTimes, pits } = feed();
    lapTimes.laps[1]!.Laps = lapTimes.laps[1]!.Laps.slice(0, 8);
    expect(computePace(lapTimes, pits, N).results[1]).toMatchObject({ paceScore: null, excluded: 'too few green-flag laps' });
  });
});
