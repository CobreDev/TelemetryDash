// Race control card: NASCAR's lap notes plus flag changes (caution, red, restart, white,
// checkered) taken from the lap-by-lap flags. Newest first. Strings are built here so the web
// UI and API clients match.
import type { TrackFlag } from '../data/types';
import { flagFromFeed, NOTE_INFO, type FeedLapNotes } from '../data/nascar/feed';

export type RaceControlKind = 'note' | 'info' | 'flag';

export interface RaceControlEntry {
  id: string;
  lap: number;
  /** "Lap 81", or "Pre-race" for notes before the green flag. */
  lapLabel: string;
  kind: RaceControlKind;
  /** Flag the note was written under; drives the entry's color. */
  flag: TrackFlag;
  text: string;
}

export interface RaceControlView {
  title: string;
  entries: RaceControlEntry[];
}

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
export function buildRaceControlView(notes: FeedLapNotes | undefined, lapFlags: TrackFlag[], notesUpToLap = Infinity): RaceControlView {
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

  // A flag entry where the flag changes, on the lap it was first shown. Green only counts as
  // a restart after a caution or red; the opening green is "Green flag" on lap 1. Unknown
  // laps ('none') come from recording gaps.
  let prev: TrackFlag | undefined;
  lapFlags.forEach((flag, i) => {
    const lap = i + 1;
    // After an unknown stretch (a recording gap) the change could have happened anywhere in
    // it, so no entry: the notes still cover it.
    if (flag !== prev && FLAG_TEXT[flag] && prev !== 'none') {
      const restart = flag === 'green' && (prev === 'yellow' || prev === 'red');
      const lifted = flag === 'yellow' && prev === 'red';
      const text = restart ? 'Green flag: restart' : lifted ? 'Red flag lifted: caution' : FLAG_TEXT[flag]!;
      entries.push({ id: `f${lap}`, lap, lapLabel: label(lap), kind: 'flag', flag, text });
    }
    prev = flag;
  });

  // A red flag can come and go within a lap, and older recordings may have missed it; NASCAR's
  // notes mark it (FlagState 3), so add the red flag entry from the first note of each red
  // stretch unless the lap flags already have one nearby.
  const redLaps = new Set(entries.filter((e) => e.kind === 'flag' && e.flag === 'red').map((e) => e.lap));
  let lastRedNote = -Infinity;
  const redNoteLaps = new Set(entries.filter((x) => x.kind === 'note' && x.flag === 'red').map((x) => x.lap));
  for (const e of [...entries].filter((x) => x.kind === 'note' && x.flag === 'red').sort((a, b) => a.lap - b.lap)) {
    const nearFlag = [e.lap - 1, e.lap, e.lap + 1].some((l) => redLaps.has(l));
    if (!nearFlag && e.lap - lastRedNote > 1) {
      entries.push({ id: `r${e.lap}`, lap: e.lap, lapLabel: e.lapLabel, kind: 'flag', flag: 'red', text: FLAG_TEXT.red! });
      // Then back to yellow: the next lap after the red stretch still under caution.
      let after = e.lap + 1;
      while (redNoteLaps.has(after)) after++;
      if (lapFlags[after - 1] === 'yellow') {
        entries.push({ id: `l${after}`, lap: after, lapLabel: label(after), kind: 'flag', flag: 'yellow', text: 'Red flag lifted: caution' });
      }
    }
    lastRedNote = e.lap;
  }

  // Newest first; within a lap the flag change is the oldest entry (shown at the start of the
  // lap), so it sorts below that lap's notes.
  const order = (e: RaceControlEntry) => (e.kind === 'flag' ? 1 : 0);
  entries.sort((a, b) => b.lap - a.lap || order(a) - order(b) || b.id.localeCompare(a.id, undefined, { numeric: true }));
  return { title: 'Race control', entries };
}
