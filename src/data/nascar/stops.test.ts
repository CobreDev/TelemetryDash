import { describe, expect, it } from 'vitest';
import type { FeedLapTimes, FeedPitStop } from './feed';
import { crewAverages, stints, stopsUpTo } from './stops';

const lapTimes: FeedLapTimes = {
  laps: [],
  flags: Array.from({ length: 60 }, (_, i) => ({ LapsCompleted: i + 1, FlagState: i + 1 === 30 ? 2 : 1 })),
};
const stop = (car: string, lap: number, tires: number, box: number): FeedPitStop => ({
  vehicle_number: car,
  driver_name: `Driver ${car}`,
  lap_count: lap,
  leader_lap: lap,
  pit_stop_type: tires === 4 ? 'FOUR_WHEEL_CHANGE' : tires === 2 ? 'TWO_WHEEL_CHANGE_RIGHT' : 'OTHER',
  left_front_tire_changed: tires === 4,
  left_rear_tire_changed: tires === 4,
  right_front_tire_changed: tires >= 2,
  right_rear_tire_changed: tires >= 2,
  pit_stop_duration: box,
  total_duration: box + 25,
  pit_in_race_time: lap * 30,
  positions_gained_lost: 0,
});

describe('stops', () => {
  const pits = [stop('1', 20, 4, 9.5), stop('1', 30, 2, 5.2), stop('2', 30, 4, 10.5), stop('2', 45, 4, 70), stop('3', 50, 0, 3)];
  const all = stopsUpTo(lapTimes, pits, 48);

  it('keeps stops up to the lap and classifies them', () => {
    expect(all.map((s) => [s.carNumber, s.kind, s.underGreen])).toEqual([
      ['1', 'four', true], ['1', 'two', false], ['2', 'four', false], ['2', 'four', true],
    ]);
  });
  it('averages normal four-tire stops, dropping repair-length ones', () => {
    expect(crewAverages(all, 'four').map((a) => [a.carNumber, a.stops, a.average])).toEqual([
      ['1', 1, 9.5], ['2', 1, 10.5],
    ]);
  });
  it('splits a car into stints at each stop', () => {
    expect(stints(all, '1', 48)).toEqual([
      { fromLap: 1, toLap: 20, start: 'start' },
      { fromLap: 21, toLap: 30, start: 'four' },
      { fromLap: 31, toLap: 48, start: 'two' },
    ]);
  });
});
