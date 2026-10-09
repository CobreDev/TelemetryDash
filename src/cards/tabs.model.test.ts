import { describe, expect, it } from 'vitest';
import type { FeedLapTimes, FeedPitStop } from '../data/nascar/feed';
import { buildOverview } from '../data/nascar/overview';
import { cup } from '../series/profiles';
import { buildFuelView, buildTopSpeedView, type Inputs } from './tabs.model';

// Two cars, 40 green laps; car 1 stops for four tires on lap 30, car 2 never stops.
const N = 40;
const lapTimes: FeedLapTimes = {
  flags: Array.from({ length: N + 1 }, (_, i) => ({ LapsCompleted: i, FlagState: i === 0 ? 8 : 1 })),
  laps: ['1', '2'].map((num, k) => ({
    Number: num,
    FullName: `Driver ${num}${num === '1' ? ' (C)' : ''}`,
    Laps: Array.from({ length: N + 1 }, (_, lap) => ({
      Lap: lap,
      LapTime: lap ? 30 + k * 0.1 + (lap === 5 ? -0.5 : 0) : null,
      LapSpeed: lap ? String(180 - k + (lap === 5 ? 3 : 0)) : null,
      RunningPos: k + 1,
    })),
  })),
};
const pits: FeedPitStop[] = [
  {
    vehicle_number: '1', lap_count: 30, leader_lap: 30, pit_stop_type: 'FOUR_WHEEL_CHANGE',
    left_front_tire_changed: true, left_rear_tire_changed: true, right_front_tire_changed: true, right_rear_tire_changed: true,
  },
];
const inputs = (): Inputs => ({
  profile: cup, lapTimes, pits, atLap: N, totalLaps: 100, stageEnds: [50], order: buildOverview(lapTimes, pits, N),
});

describe('tab view models', () => {
  it('ranks top speed by fastest lap and highlights Chase drivers', () => {
    const v = buildTopSpeedView(inputs());
    expect(v.rows.map((r) => [r.rank, r.carNumber, r.speed, r.lap, r.highlight])).toEqual([
      [1, '1', '183.000', '5', true],
      [2, '2', '182.000', '5', false],
    ]);
  });

  it('projects fuel from the longest run (30 laps = one tank)', () => {
    const v = buildFuelView(inputs());
    const car1 = v.rows.find((r) => r.carNumber === '1')!;
    // 10 laps since the stop of a 30-lap tank: 67% left, ~20 laps, makes the stage end (10 to go).
    expect([car1.fuel, car1.lapsLeft, car1.reachesStatus]).toEqual(['67%', '~20', 'mid']);
    const car2 = v.rows.find((r) => r.carNumber === '2')!;
    expect([car2.fuel, car2.reachesStatus]).toEqual(['0%', 'bad']);
  });
});
