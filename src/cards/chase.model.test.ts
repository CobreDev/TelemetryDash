import { describe, expect, it } from 'vitest';
import type { FeedRaceResult } from '../data/nascar/feed';
import type { FeedLivePoints } from '../data/nascar/points';
import { craftsman } from '../series/profiles';
import { buildChaseStandingsView } from './chase.model';

const driver = (id: number, car: string, last: string, points: number, earned: number, inChase = true) =>
  ({ driver_id: id, car_number: car, first_name: 'A', last_name: last, points, points_earned_this_race: earned, is_in_chase: inChase }) as FeedLivePoints;
const finished = (id: number, pos: number) => ({ driver_id: id, finishing_position: pos }) as FeedRaceResult;

describe('buildChaseStandingsView', () => {
  const view = buildChaseStandingsView(
    [driver(1, '11', 'Honeycutt (C)', 2197, 60), driver(2, '34', 'Riggs (C)', 2160, 10), driver(3, '1', 'Crews', 900, 40, false)],
    [finished(1, 1), finished(2, 19), finished(3, 2)],
    'Race to Stop Suicide 200',
    craftsman,
  );

  it('ranks the Chase field by points after the race, with the move in that race', () => {
    expect(view.rows.map((r) => [r.rank, r.lastName, r.change, r.running, r.points])).toEqual([
      [1, 'Honeycutt', '+1', 'P1', '2197'],
      [2, 'Riggs', '−1', 'P19', '2160'],
    ]);
    expect(view.mode).toBe('standings');
  });
});
