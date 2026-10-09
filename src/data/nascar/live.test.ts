import { describe, expect, it } from 'vitest';
import { applySnapshot, backfillFromLapTimes, needsBackfill, toLapTimes, type FeedLiveSnapshot } from './live';

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
  it('swaps estimated laps and unseen flags for the official lap times', () => {
    let s = applySnapshot(null, snap(0, 1, [['1', 0, 0, 0]]), 1);
    s = applySnapshot(s, snap(1, 1, [['1', 1, 31, 31]]), 2);
    s = applySnapshot(s, snap(4, 2, [['1', 4, 130, 34]]), 3); // laps 2-4 missed (restart)
    expect(needsBackfill(s)).toBe(true);
    const official = {
      flags: [{ LapsCompleted: 0, FlagState: 8 }, { LapsCompleted: 1, FlagState: 1 }, { LapsCompleted: 2, FlagState: 1 }, { LapsCompleted: 3, FlagState: 2 }, { LapsCompleted: 4, FlagState: 2 }],
      laps: [{ Number: '1', FullName: 'Driver 1', Laps: [{ Lap: 0, LapTime: null, RunningPos: 1 }, { Lap: 1, LapTime: 31.2, RunningPos: 1 }, { Lap: 2, LapTime: 31.5, LapSpeed: '171.4', RunningPos: 1 }, { Lap: 3, LapTime: 33, RunningPos: 2 }, { Lap: 4, LapTime: 34.5, RunningPos: 2 }] }],
    };
    const filled = backfillFromLapTimes(s, official);
    const laps = toLapTimes(filled).laps[0]!.Laps.slice(1);
    // Lap 1 was recorded exactly, so it stays; 2-4 become official and exact.
    expect(laps.map((l) => [l.Lap, l.LapTime, l.Estimated ?? false])).toEqual([[1, 31, false], [2, 31.5, false], [3, 33, false], [4, 34.5, false]]);
    expect(toLapTimes(filled).flags.slice(1).map((f) => f.FlagState)).toEqual([1, 1, 2, 2]);
    expect(needsBackfill(filled)).toBe(false);
  });

  it('keeps a red flag on its lap when the caution resumes', () => {
    let s = applySnapshot(null, snap(10, 2, [['1', 10, 400, 60]]), 1);
    s = applySnapshot(s, snap(10, 3, [['1', 10, 400, 60]]), 2); // red during lap 11
    s = applySnapshot(s, snap(10, 2, [['1', 10, 400, 60]]), 3); // lifted, still lap 11
    expect(s.flags[11]).toBe(3);
  });

  it('marks flags unknown across a recording gap when the flag changed during it', () => {
    let s = applySnapshot(null, snap(0, 2, [['1', 0, 0, 0]]), 1); // lap 1 seen yellow
    s = applySnapshot(s, snap(5, 1, [['1', 5, 160, 31]]), 2); // back at lap 6, green: laps 2-5 unseen
    expect(toLapTimes(s).flags.slice(1).map((f) => f.FlagState)).toEqual([2, 8, 8, 8, 8]);
    s = applySnapshot(null, snap(0, 1, [['1', 0, 0, 0]]), 1);
    s = applySnapshot(s, snap(3, 1, [['1', 3, 93, 31]]), 2); // same flag both sides: carried
    expect(toLapTimes(s).flags.slice(1).map((f) => f.FlagState)).toEqual([1, 1, 1]);
  });

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
