import { parseDriverName } from '../data/nascar/names';
import type { FeedRaceResult } from '../data/nascar/feed';
import type { ChaseEntry, FeedLivePoints } from '../data/nascar/points';
import { positionChange } from '../format/format';
import type { SeriesProfile } from '../series/types';

export interface ChaseRow {
  /** Chase position shown and sorted on: as they run (live), or after the last race (off-week). */
  rank: number;
  /** Same as `rank` (kept for API clients). */
  liveRank: number;
  /** Position and points entering this race (live) or before the last race (off-week). */
  rankBefore: number;
  pointsBefore: string;
  /** Move from `rankBefore` to `rank`: "+2", "−1", "–". */
  change: string;
  changeDir: 'up' | 'down' | 'same';
  carNumber: string;
  carBadge: string;
  firstName: string;
  lastName: string;
  /** Points shown: as they run (live), or current (off-week). */
  points: string;
  /** Same as `points` (kept for API clients). */
  livePoints: string;
  /** Points gained so far this race, e.g. "+43". */
  earned: string;
  /** Current running position, e.g. "P14", or "–". */
  running: string;
}

export interface ChaseView {
  title: string;
  /** 'live': entering this race and as they run. 'standings': after the last race (off-week). */
  mode: 'live' | 'standings';
  /** Hover text per column. */
  hints: { change: string; running: string; points: string; gain: string };
  rows: ChaseRow[];
  columns: { rank: string; change: string; car: string; name: string; running: string; points: string; gain: string };
  notes: string[];
}

export function buildChaseView(entries: ChaseEntry[], profile: SeriesProfile, stagesComplete: number): ChaseView {
  return {
    title: 'Chase standings',
    mode: 'live',
    hints: { change: 'Move from where they entered this race', running: 'Current running position', points: 'Points as they run', gain: 'Points gained so far as they run (stages plus current position)' },
    columns: { rank: 'Pos', change: '±', car: 'Car', name: 'Driver', running: 'Current', points: 'Pts', gain: 'Gain' },
    // As they run: the order the standings would be in if the race ended now.
    rows: [...entries].sort((a, b) => a.rankLive - b.rankLive).map((e) => {
      const name = parseDriverName(e.name);
      const delta = e.rankBefore - e.rankLive;
      return {
        rank: e.rankLive,
        liveRank: e.rankLive,
        rankBefore: e.rankBefore,
        pointsBefore: String(e.pointsBefore),
        change: positionChange(delta),
        changeDir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
        carNumber: e.carNumber,
        carBadge: `/api/v1/series/${profile.id}/car-badges/${e.carNumber}.png`,
        firstName: name.firstName,
        lastName: name.lastName,
        points: String(e.pointsLive),
        livePoints: String(e.pointsLive),
        earned: `+${e.pointsLive - e.pointsBefore}`,
        running: e.running ? `P${e.running}` : '–',
      };
    }),
    notes: [
      'As they run: Pos and Pts are the standings if the race ended now. ± is the move from where they entered the race; Gain is the points picked up so far.',
      `As they run counts finishing points for the current running position${stagesComplete ? ` plus points from ${stagesComplete === 1 ? 'stage 1' : `stages 1–${stagesComplete}`}` : ''}; fastest-lap and bonus points are added at the finish.`,
    ],
  };
}

/**
 * Off-week standings: the Chase field after the series' last race, from that race's final
 * points file. ± is each driver's move in that race; Last race is where they finished.
 */
export function buildChaseStandingsView(
  livePoints: FeedLivePoints[],
  results: FeedRaceResult[],
  raceName: string,
  profile: SeriesProfile,
): ChaseView {
  const finish = new Map(results.map((r) => [r.driver_id, r.finishing_position]));
  const field = livePoints.filter((d) => d.is_in_chase).map((d) => ({ d, after: d.points, before: d.points - d.points_earned_this_race }));
  const rankBy = (key: 'after' | 'before') =>
    new Map(
      [...field]
        .sort((a, b) => b[key] - a[key] || (finish.get(a.d.driver_id) ?? 99) - (finish.get(b.d.driver_id) ?? 99))
        .map((e, i) => [e.d.driver_id, i + 1]),
    );
  const after = rankBy('after');
  const before = rankBy('before');
  return {
    title: 'Chase standings',
    mode: 'standings',
    hints: { change: `Move in the ${raceName}`, running: `Finish in the ${raceName}`, points: 'Current points', gain: `Points earned in the ${raceName}` },
    columns: { rank: 'Pos', change: '±', car: 'Car', name: 'Driver', running: 'Finish', points: 'Pts', gain: 'Gain' },
    rows: field
      .map(({ d }) => {
        const rank = after.get(d.driver_id)!;
        const delta = before.get(d.driver_id)! - rank;
        const pos = finish.get(d.driver_id);
        // The points file's names carry markers too ("Larson (C)").
        const name = parseDriverName(`${d.first_name} ${d.last_name}`);
        return {
          rank,
          liveRank: rank,
          rankBefore: before.get(d.driver_id)!,
          pointsBefore: String(d.points - d.points_earned_this_race),
          change: positionChange(delta),
          changeDir: (delta > 0 ? 'up' : delta < 0 ? 'down' : 'same') as ChaseRow['changeDir'],
          carNumber: d.car_number,
          carBadge: `/api/v1/series/${profile.id}/car-badges/${d.car_number}.png`,
          firstName: name.firstName,
          lastName: name.lastName,
          points: String(d.points),
          livePoints: String(d.points),
          earned: `+${d.points_earned_this_race}`,
          running: pos ? `P${pos}` : '–',
        };
      })
      .sort((a, b) => a.rank - b.rank),
    notes: [`Points after the ${raceName}. ± is the move in that race, Finish where they finished and Gain the points they earned.`],
  };
}
