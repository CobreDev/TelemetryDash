import { parseDriverName } from '../data/nascar/names';
import type { FeedRaceResult } from '../data/nascar/feed';
import type { ChaseEntry, FeedLivePoints } from '../data/nascar/points';
import { positionChange } from '../format/format';
import type { SeriesProfile } from '../series/types';

export interface ChaseRow {
  /** Chase position entering this race (the sort order). */
  rank: number;
  /** Position if the race ended now. */
  liveRank: number;
  /** Projected move: "+2", "−1", "–" from `rank` to `liveRank`. */
  change: string;
  changeDir: 'up' | 'down' | 'same';
  carNumber: string;
  carBadge: string;
  firstName: string;
  lastName: string;
  points: string;
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
  hints: { change: string; running: string; points: string };
  rows: ChaseRow[];
  columns: { rank: string; change: string; car: string; name: string; running: string; points: string; live: string };
  notes: string[];
}

export function buildChaseView(entries: ChaseEntry[], profile: SeriesProfile, stagesComplete: number): ChaseView {
  return {
    title: 'Chase standings',
    mode: 'live',
    hints: { change: 'Projected move if the race ended now', running: 'Current running position', points: 'Points entering this race' },
    columns: { rank: 'Pos', change: '±', car: 'Car', name: 'Driver', running: 'Currently', points: 'Pts', live: 'Live' },
    rows: [...entries].sort((a, b) => a.rankBefore - b.rankBefore).map((e) => {
      const name = parseDriverName(e.name);
      const delta = e.rankBefore - e.rankLive;
      return {
        rank: e.rankBefore,
        liveRank: e.rankLive,
        change: positionChange(delta),
        changeDir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
        carNumber: e.carNumber,
        carBadge: `/api/v1/series/${profile.id}/car-badges/${e.carNumber}.png`,
        firstName: name.firstName,
        lastName: name.lastName,
        points: String(e.pointsBefore),
        livePoints: String(e.pointsLive),
        earned: `+${e.pointsLive - e.pointsBefore}`,
        running: e.running ? `P${e.running}` : '–',
      };
    }),
    notes: [
      'Pos and Pts: entering this race. ± is the projected move if the race ended now.',
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
    hints: { change: `Move in the ${raceName}`, running: `Finish in the ${raceName}`, points: 'Current points' },
    columns: { rank: 'Pos', change: '±', car: 'Car', name: 'Driver', running: 'Last race', points: 'Pts', live: 'Live' },
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
    notes: [`Points after the ${raceName}. ± is the move in that race; Last race is where they finished.`],
  };
}
