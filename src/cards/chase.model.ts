import { parseDriverName } from '../data/nascar/names';
import type { ChaseEntry } from '../data/nascar/points';
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
  rows: ChaseRow[];
  columns: { rank: string; change: string; car: string; name: string; running: string; points: string; live: string };
  notes: string[];
}

export function buildChaseView(entries: ChaseEntry[], profile: SeriesProfile, stagesComplete: number): ChaseView {
  return {
    title: 'Chase standings',
    columns: { rank: 'Pos', change: '±', car: 'Car', name: 'Driver', running: 'Run', points: 'Pts', live: 'Live' },
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
