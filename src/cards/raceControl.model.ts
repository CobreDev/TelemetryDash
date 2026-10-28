// Race control card: NASCAR's lap notes plus flag changes (caution, red, restart, white,
// checkered) taken from the lap-by-lap flags. Newest first. Strings are built here so the web
// UI and API clients match.
import type { TrackFlag } from '../data/types';
import { flagFromFeed, NOTE_INFO, type FeedLapNotes } from '../data/nascar/feed';
import { plural } from '../format/format';

export type RaceControlKind = 'note' | 'info' | 'flag' | 'stage';

/** A stage's top finishers and the stage points they scored. */
export interface StageResult {
  stage: number;
  /** The lap the stage ended on. */
  lap: number;
  results: { carNumber: string; name: string; points: number }[];
}

export interface RaceControlEntry {
  id: string;
  lap: number;
  /** "Lap 81", or "Pre-race" for notes before the green flag. */
  lapLabel: string;
  kind: RaceControlKind;
  /** Flag the note was written under; drives the entry's color. */
  flag: TrackFlag;
  text: string;
  /** Stage entries: the top 10 and their stage points. */
  stage?: StageResult;
}

export interface RaceControlView {
  title: string;
  /** "2 cautions · 11 laps" (NASCAR's count live; counted from the lap flags otherwise). */
  cautions: string;
  entries: RaceControlEntry[];
}

/** Caution periods and caution laps from the lap flags (a red within a caution is the same period). */
export function countCautions(lapFlags: TrackFlag[]): { count: number; laps: number } {
  let count = 0;
  let laps = 0;
  let inCaution = false;
  for (const f of lapFlags) {
    const caution = f === 'yellow' || f === 'red';
    if (caution && !inCaution) count++;
    if (f === 'yellow') laps++;
    // Unknown laps (recording gaps) don't end a caution.
    if (f !== 'none') inCaution = caution;
  }
  return { count, laps };
}

/** NASCAR's notes call it out: "competition caution" / "competition yellow". */
const COMPETITION = /competition (caution|yellow)/i;

const FLAG_TEXT: Partial<Record<TrackFlag, string>> = {
  yellow: 'Caution',
  red: 'Red flag',
  green: 'Green flag',
  white: 'White flag',
  checkered: 'Checkered flag',
};

/**
 * `lapFlags[i]` is the flag lap i+1 ran under (as in PaceDataset); live callers add the lap in
 * progress so a caution shows the moment it's thrown. Notes after `notesUpToLap` are left out,
 * so a replay never shows what happens later.
 */
export function buildRaceControlView(
  notes: FeedLapNotes | undefined,
  lapFlags: TrackFlag[],
  notesUpToLap = Infinity,
  /** The race's last lap once it's complete: adds the checkered flag on that lap. */
  finishedAt?: number,
  extras: {
    /** Live: NASCAR's caution count and laps (else counted from `lapFlags`). */
    cautions?: { count: number; laps: number };
    /** Stages completed so far, each shown on its last lap. */
    stages?: StageResult[];
  } = {},
): RaceControlView {
  const entries: RaceControlEntry[] = [];
  const label = (lap: number) => (lap === 0 ? 'Pre-race' : `Lap ${lap}`);

  for (const [key, list] of Object.entries(notes?.laps ?? {})) {
    const lap = Number(key);
    if (!Number.isFinite(lap) || lap > notesUpToLap) continue;
    for (const n of list) {
      const text = n.Note.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const info = n.FlagState === NOTE_INFO;
      entries.push({ id: `n${n.NoteID}`, lap, lapLabel: label(lap), kind: info ? 'info' : 'note', flag: info ? 'none' : flagFromFeed(n.FlagState), text });
    }
  }

  // An entry wherever the flag changes, labelled like the header's lap counter: laps completed
  // when it came out (white at 133 in a 134-lap race; the opening green is "Start"). After an
  // unknown stretch (a recording gap) the change could be anywhere in it, so it's left to the notes.
  let prev: TrackFlag | undefined;
  lapFlags.forEach((flag, lap) => {
    if (flag !== prev && FLAG_TEXT[flag] && prev !== 'none') {
      const restart = flag === 'green' && (prev === 'yellow' || prev === 'red');
      const lifted = flag === 'yellow' && prev === 'red';
      // A planned caution (after rain, or early to check tires).
      const competition =
        flag === 'yellow' && !lifted && [lap, lap + 1, lap + 2].some((l) => notes?.laps[l]?.some((n) => COMPETITION.test(n.Note)));
      const text = restart ? 'Green flag: restart' : lifted ? 'Red flag lifted: caution' : competition ? 'Competition Caution' : FLAG_TEXT[flag]!;
      entries.push({ id: `f${lap}`, lap, lapLabel: lap === 0 ? 'Start' : label(lap), kind: 'flag', flag, text });
    }
    prev = flag;
  });

  // The checkered waves as the leader completes the last lap (newest entry of that lap).
  if (finishedAt) entries.push({ id: `z${finishedAt}`, lap: finishedAt, lapLabel: label(finishedAt), kind: 'flag', flag: 'checkered', text: FLAG_TEXT.checkered! });

  // A red flag can come and go within a lap. NASCAR's notes mark it (FlagState 3), so the first
  // note of each red stretch adds the entry unless the lap flags already have one nearby.
  const redLaps = new Set(entries.filter((e) => e.kind === 'flag' && e.flag === 'red').map((e) => e.lap));
  let lastRedNote = -Infinity;
  const redNoteLaps = new Set(entries.filter((x) => x.kind === 'note' && x.flag === 'red').map((x) => x.lap));
  for (const e of [...entries].filter((x) => x.kind === 'note' && x.flag === 'red').sort((a, b) => a.lap - b.lap)) {
    // Flag entries sit at laps completed, so a recorded red can be up to two laps before the note.
    const nearFlag = [e.lap - 2, e.lap - 1, e.lap, e.lap + 1].some((l) => redLaps.has(l));
    if (!nearFlag && e.lap - lastRedNote > 1) {
      entries.push({ id: `r${e.lap}`, lap: e.lap, lapLabel: e.lapLabel, kind: 'flag', flag: 'red', text: FLAG_TEXT.red! });
      // Then back to yellow on the first lap after the red stretch, if it's still a caution.
      let after = e.lap + 1;
      while (redNoteLaps.has(after)) after++;
      if (lapFlags[after - 1] === 'yellow') {
        entries.push({ id: `s${after - 1}`, lap: after - 1, lapLabel: label(after - 1), kind: 'flag', flag: 'yellow', text: 'Red flag lifted: caution' });
      }
    }
    lastRedNote = e.lap;
  }

  for (const st of extras.stages ?? []) {
    const winner = st.results[0];
    if (!winner) continue;
    entries.push({ id: `t${st.stage}`, lap: st.lap, lapLabel: label(st.lap), kind: 'stage', flag: 'none', text: `Stage ${st.stage} winner: #${winner.carNumber} ${winner.name}`, stage: st });
  }

  // Newest first. Within a lap the flag change came first (it sorts below the lap's notes) and a
  // stage result last; at the start, the green flag follows the pre-race notes.
  const order = (e: RaceControlEntry) => (e.kind === 'flag' ? (e.lap === 0 ? -1 : 1) : e.kind === 'stage' ? -0.5 : 0);
  entries.sort((a, b) => b.lap - a.lap || order(a) - order(b) || b.id.localeCompare(a.id, undefined, { numeric: true }));
  const c = extras.cautions ?? countCautions(lapFlags);
  return { title: 'Race control', cautions: `${plural(c.count, 'caution')} · ${plural(c.laps, 'lap')}`, entries };
}
