import { describe, expect, it } from 'vitest';
import { chaseStandings, finishPointsTable, type FeedLivePoints } from './points';

const lp = (o: Partial<FeedLivePoints>): FeedLivePoints => ({
  driver_id: 0, car_number: '0', first_name: 'A', last_name: 'B', is_in_chase: true, is_points_eligible: true,
  is_fastest_lap_point: false, points: 0, points_position: 0, points_earned_this_race: 0, bonus_points: 0,
  stage_1_points: 0, stage_2_points: 0, stage_3_points: 0, ...o,
});

describe('finishPointsTable', () => {
  it('reads points per position from results and fills ineligible gaps', () => {
    const live = [
      lp({ driver_id: 1, points_earned_this_race: 75, stage_1_points: 10, stage_2_points: 10 }), // P1: 55
      lp({ driver_id: 2, points_earned_this_race: 36, stage_2_points: 1 }), // P2: 35
      lp({ driver_id: 3, is_points_eligible: false }), // P3: ineligible
      lp({ driver_id: 4, points_earned_this_race: 34, is_fastest_lap_point: true }), // P4: 33
    ];
    const table = finishPointsTable(live, [1, 2, 3, 4].map((id) => ({ driver_id: id, finishing_position: id })));
    expect(table.slice(1)).toEqual([55, 35, 34, 33]);
  });
});

describe('chaseStandings', () => {
  it('projects points from completed stages and running position', () => {
    const table = [0, 55, 35, 34, 33];
    const live = [
      lp({ driver_id: 1, car_number: '5', points: 2318, points_earned_this_race: 36, stage_1_points: 0 }), // before 2282
      lp({ driver_id: 2, car_number: '19', points: 2234, points_earned_this_race: 75, stage_1_points: 10 }), // before 2159
      lp({ driver_id: 3, car_number: '99', is_in_chase: false, points: 9999 }),
    ];
    const rows = chaseStandings(live, table, new Map([['5', 4], ['19', 1]]), 1);
    expect(rows.map((r) => [r.carNumber, r.pointsBefore, r.pointsLive, r.rankBefore, r.rankLive])).toEqual([
      ['5', 2282, 2282 + 33, 1, 1],
      ['19', 2159, 2159 + 10 + 55, 2, 2],
    ]);
  });
});
