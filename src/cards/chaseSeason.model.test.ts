import { describe, expect, it } from 'vitest';
import type { FeedLivePoints } from '../data/nascar/points';
import { cup } from '../series/profiles';
import { buildChaseSeasonView, shortTrack, type ChaseRaceInput } from './chaseSeason.model';

const pts = (car: string, last: string, points: number, earned: number, extra: Partial<FeedLivePoints> = {}): FeedLivePoints =>
  ({ car_number: car, driver_id: Number(car), first_name: 'D', last_name: last, points, points_earned_this_race: earned, is_in_chase: true, stage_1_points: 0, stage_2_points: 0, stage_3_points: 0, wins: 1, top_5: 2, top_10: 3, poles: 0, ...extra }) as FeedLivePoints;
const res = (car: string, finish: number, earned: number) => ({ car_number: car, finishing_position: finish, points_earned: earned }) as ChaseRaceInput['results'] extends (infer R)[] | undefined ? R : never;
const race = (id: number, track: string, date: string) => ({ race_id: id, race_name: `Race ${id}`, track_name: track, race_date: `${date}T15:00:00` });

const races: ChaseRaceInput[] = [
  { race: race(1, 'Darlington Raceway', '2026-09-06'), livePoints: [pts('5', 'Larson', 2050, 50), pts('11', 'Hamlin', 2060, 40)], results: [res('5', 1, 50), res('11', 4, 40)] },
  { race: race(2, 'World Wide Technology Raceway', '2026-09-13'), livePoints: [pts('5', 'Larson', 2080, 30), pts('11', 'Hamlin', 2115, 55)], results: [res('5', 9, 30), res('11', 1, 55)] },
  { race: race(3, 'Charlotte Motor Speedway', '2026-10-11') },
  { race: race(4, 'Phoenix Raceway', '2026-11-08') },
];

describe('buildChaseSeasonView', () => {
  it('shortens track names', () => {
    expect(['Charlotte Motor Speedway', 'Darlington Raceway', 'Talladega Superspeedway', 'World Wide Technology Raceway', 'Homestead-Miami Speedway'].map(shortTrack)).toEqual([
      'Charlotte',
      'Darlington',
      'Talladega',
      'Gateway',
      'Homestead',
    ]);
  });

  it('builds standings, results and the points trail after the last race', () => {
    const v = buildChaseSeasonView(cup, races);
    expect(v.status).toBe('running');
    expect(v.races.map((r) => r.state)).toEqual(['done', 'done', 'next', 'upcoming']);
    expect(v.drivers.map((d) => [d.rank, d.carNumber, d.points, d.gap, d.change, d.chaseWins, d.chaseAvg])).toEqual([
      [1, '11', '2115', '–', '–', '1', '2.5'],
      [2, '5', '2080', '−35', '–', '1', '5.0'],
    ]);
    // Start = first race's points less what it earned.
    expect(v.drivers[1]!.trail).toEqual([2000, 2050, 2080, null, null]);
    expect(v.drivers[1]!.results.map((r) => r?.finish ?? null)).toEqual(['1', '9', null, null]);
    expect(v.summary[0]).toMatchObject({ value: '2 of 4' });
  });

  it('runs the live race as they run', () => {
    const v = buildChaseSeasonView(cup, races, {
      raceId: 3,
      livePoints: [pts('5', 'Larson', 2140, 60), pts('11', 'Hamlin', 2135, 20)],
      entries: [
        { driverId: 5, carNumber: '5', name: 'D Larson', pointsBefore: 2080, rankBefore: 2, pointsLive: 2140, rankLive: 1, running: 1 },
        { driverId: 11, carNumber: '11', name: 'D Hamlin', pointsBefore: 2115, rankBefore: 1, pointsLive: 2135, rankLive: 2, running: 12 },
      ],
    });
    expect(v.races.map((r) => r.state)).toEqual(['done', 'done', 'live', 'upcoming']);
    expect(v.drivers.map((d) => [d.carNumber, d.change, d.earned, d.running, d.gap])).toEqual([
      ['5', '+1', '+60', 'P1', '–'],
      ['11', '−1', '+20', 'P12', '−5'],
    ]);
    expect(v.drivers[0]!.results[2]).toMatchObject({ finish: 'P1', state: 'live', tone: 'win' });
    expect(v.drivers[0]!.trail).toEqual([2000, 2050, 2080, 2140, null]);
  });

  it('says when the Chase starts before any Chase race has run', () => {
    const v = buildChaseSeasonView(cup, races.map((r) => ({ race: r.race })));
    expect(v.status).toBe('not-started');
    expect(v.drivers).toEqual([]);
    expect(v.notes[0]).toContain('Darlington Raceway');
  });
});
