// Penalties card: NASCAR publishes no penalty feed, but its race notes call penalties out
// ("#12 too fast entering", "Penalties include: #42 and #66 speeding"). This reads them from
// the notes. The notes rarely say what the punishment was, so unless they do, it follows
// NASCAR's standard for pit road penalties: a pass-through under green, the tail of the field
// under caution.
import type { FeedLapNotes } from '../data/nascar/feed';
import { parseDriverName } from '../data/nascar/names';
import type { TrackFlag } from '../data/types';

export interface PenaltyRow {
  id: string;
  lap: number;
  carNumber: string;
  carBadge: string;
  firstName: string;
  lastName: string;
  /** "Speeding", "Uncontrolled tire", ... */
  penalty: string;
  /** "Pass-through", "Tail of the field", ... */
  punishment: string;
  /** False when the punishment comes from the standard rule rather than NASCAR's note. */
  punishmentStated: boolean;
}

export interface PenaltiesView {
  title: string;
  rows: PenaltyRow[];
  notes: string[];
}

/** Infractions as NASCAR's notes word them, most specific first. */
const INFRACTIONS: [RegExp, string][] = [
  [/too fast (entering|exiting|on pit road)|speeding/i, 'Speeding'],
  [/uncontrolled tire/i, 'Uncontrolled tire'],
  [/commitment (line|cone)/i, 'Commitment line violation'],
  [/vehicle interference/i, 'Vehicle interference'],
  [/too many (men|crew( members)?) over the wall|over the wall too soon/i, 'Crew over the wall too soon'],
  [/(removing|removed|left the pit box with) equipment|equipment (out of|left|leaving) the (pit )?box/i, 'Removing equipment'],
  [/(outside|out of) (his|her|their|the) (pit )?box/i, 'Pitting outside the box'],
  [/blend line/i, 'Blend line violation'],
  [/(jump(ed|ing)?|beat(ing)?) the restart|restart violation|lane change (before|violation)/i, 'Restart violation'],
  [/safety violation/i, 'Safety violation'],
];

/** Punishments the notes sometimes spell out. */
const PUNISHMENTS: [RegExp, string][] = [
  [/stop[- ]and[- ]go/i, 'Stop-and-go'],
  [/pass[- ]through|drive[- ]through/i, 'Pass-through'],
  [/(tail|rear|back) (of|end of) the (field|line)|restart (at|from) the (rear|tail|back)/i, 'Tail of the field'],
  [/(held|penalized|docked) (one|1|two|2|\d+) laps?/i, 'Lap penalty'],
  [/black[- ]flag(ged)?|parked/i, 'Black flag'],
];

/** Mentions of a penalty already given ("restarted at the rear following his ..."), not a new one. */
const PAST = /\b(following|served|after (his|her|their|the)|who (restarted|served|had))\b/i;

/**
 * `lapFlags[i]` is the flag lap i+1 ran under; it decides the standard punishment. Notes after
 * `upToLap` are left out (replays).
 */
export function buildPenaltiesView(
  seriesId: string,
  notes: FeedLapNotes | undefined,
  lapFlags: TrackFlag[],
  names: ReadonlyMap<string, string>,
  upToLap = Infinity,
): PenaltiesView {
  const rows: PenaltyRow[] = [];
  for (const [key, list] of Object.entries(notes?.laps ?? {})) {
    const lap = Number(key);
    if (!Number.isFinite(lap) || lap > upToLap) continue;
    for (const n of list) {
      // Items: each sentence split at commas, "Penalties include:" dropped. Items that are only
      // car numbers ("#42, #66 and #3 speeding") carry over to the next item's infraction.
      const items = n.Note.replace(/\s+/g, ' ').replace(/penalties include:/gi, '').split(/[.;]/).flatMap((x) => x.split(','));
      let carried: string[] = [];
      items.forEach((item, ii) => {
        const hit = INFRACTIONS.find(([re]) => re.test(item));
        if (!hit || PAST.test(item)) {
          carried = /^\s*(#\d+\s*(and\s*)?)+$/i.test(item) ? [...carried, ...[...item.matchAll(/#(\d+)/g)].map((m) => m[1]!)] : [];
          return;
        }
        // The cars named before the infraction ("#42 and #66 speeding").
        const cars = [...carried, ...[...item.slice(0, item.search(hit[0])).matchAll(/#(\d+)/g)].map((m) => m[1]!)];
        carried = [];
        const stated = PUNISHMENTS.find(([re]) => re.test(item));
        // The note's own flag (1 green, 2 caution, 3 red), else the lap's.
        const flag = n.FlagState === 2 || n.FlagState === 3 ? 'yellow' : n.FlagState === 1 ? 'green' : (lapFlags[lap - 1] ?? 'green');
        const standard = flag === 'yellow' || flag === 'red' ? 'Tail of the field' : 'Pass-through';
        for (const car of cars) {
          const name = parseDriverName(names.get(car) ?? `#${car}`);
          rows.push({
            id: `${n.NoteID}-${ii}-${car}`,
            lap,
            carNumber: car,
            carBadge: `/api/v1/series/${seriesId}/car-badges/${car}.png`,
            firstName: name.firstName,
            lastName: name.lastName,
            penalty: hit[1],
            punishment: stated?.[1] ?? standard,
            punishmentStated: !!stated,
          });
        }
      });
    }
  }
  // Newest lap first; within a lap, in the order the notes name them (the sort is stable).
  rows.sort((a, b) => b.lap - a.lap);
  return {
    title: 'Penalties',
    rows,
    notes: rows.some((r) => !r.punishmentStated)
      ? ['From NASCAR\'s race notes. Unless a note says otherwise, the punishment is NASCAR\'s standard for pit road penalties: a pass-through under green, the tail of the field under caution.']
      : [],
  };
}
