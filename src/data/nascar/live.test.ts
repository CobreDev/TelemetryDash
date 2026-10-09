import { describe, expect, it } from 'vitest';
import { applySnapshot, toLapTimes, type FeedLiveSnapshot } from './live';

const snap = (lap: number, flag: number, cars: [string, number, number, number][]): FeedLiveSnapshot => ({
  series_id: 3, race_id: 5688, run_id: 1, run_name: 'Race', run_type: 3, lap_number: lap, laps_in_race: 134,
  flag_state: flag, track_name: 'Charlotte Motor Speedway',
  vehicles: cars.map(([num, laps, elapsed, last]) => ({
    vehicle_number: num,
    driver: { driver_id: 1, full_name: `Driver ${num}`, first_name: 'D', last_name: num },
    running_position: 1, laps_completed: laps, last_lap_time: last, last_lap_speed: 175, vehicle_elapsed_time: elapsed, status: 1,
  })),
});

describe('live collector', () => {
  it('records exact laps as they complete and splits missed laps evenly', () => {
    let s = applySnapshot(null, snap(0, 1, [['1', 0, 0, 0]]), 1000);
    s = applySnapshot(s, snap(1, 1, [['1', 1, 31, 31]]), 2000);
    s = applySnapshot(s, snap(1, 1, [['1', 1, 31, 31]]), 3000); // no change
    expect(s.updatedAt).toBe(2000);
    s = applySnapshot(s, snap(4, 2, [['1', 4, 130, 34]]), 4000); // missed laps 2-3
    const laps = toLapTimes(s).laps[0]!.Laps.slice(1);
    expect(laps.map((l) => [l.Lap, l.LapTime, l.Estimated ?? false])).toEqual([
      [1, 31, false], [2, 33, true], [3, 33, true], [4, 33, true],
    ]);
    // Cumulative time stays exact even when laps are estimated.
    expect(laps.reduce((a, l) => a + l.LapTime!, 0)).toBe(130);
  });

  it('carries flags forward and starts over when the session changes', () => {
    let s = applySnapshot(null, snap(0, 1, [['1', 0, 0, 0]]), 1);
    s = applySnapshot(s, snap(1, 1, [['1', 1, 31, 31]]), 2);
    s = applySnapshot(s, snap(2, 2, [['1', 2, 70, 39]]), 3);
    expect(toLapTimes(s).flags.slice(1).map((f) => f.FlagState)).toEqual([1, 1]);
    expect(s.flags[3]).toBe(2);
    const next = applySnapshot(s, { ...snap(0, 1, [['1', 0, 0, 0]]), run_id: 2 }, 4);
    expect(Object.keys(next.cars['1']!.laps)).toHaveLength(0);
  });
});

import { easternToEpoch } from './feed';
describe('easternToEpoch', () => {
  it('reads schedule times as US Eastern, with daylight saving', () => {
    expect(new Date(easternToEpoch('2026-10-11T15:00:00')).toISOString()).toBe('2026-10-11T19:00:00.000Z'); // EDT
    expect(new Date(easternToEpoch('2026-02-15T14:30:00')).toISOString()).toBe('2026-02-15T19:30:00.000Z'); // EST
  });
});
