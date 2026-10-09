import { describe, expect, it } from 'vitest';
import type { TrackFlag } from '../data/types';
import { buildRaceControlView } from './raceControl.model';

const notes = {
  laps: {
    '0': [{ FlagState: 1, Note: 'To the rear: #17', NoteID: 1 }],
    '30': [{ FlagState: 2, Note: '#34 wins stage 1', NoteID: 2 }],
    '31': [{ FlagState: 1000, Note: '12th stage win for #34', NoteID: 3 }],
    '38': [{ FlagState: 1, Note: 'Restart: #11 leads', NoteID: 4 }],
  },
};
const flags = (spec: [number, TrackFlag][]) => spec.flatMap(([n, f]) => Array<TrackFlag>(n).fill(f));

describe('buildRaceControlView', () => {
  const view = buildRaceControlView(notes, flags([[30, 'green'], [7, 'yellow'], [3, 'green']]));

  it('mixes notes and flag changes, newest first', () => {
    expect(view.entries.map((e) => [e.lapLabel, e.kind, e.text])).toEqual([
      ['Lap 38', 'note', 'Restart: #11 leads'],
      ['Lap 38', 'flag', 'Green flag: restart'],
      ['Lap 31', 'info', '12th stage win for #34'],
      ['Lap 31', 'flag', 'Caution'],
      ['Lap 30', 'note', '#34 wins stage 1'],
      ['Lap 1', 'flag', 'Green flag'],
      ['Pre-race', 'note', 'To the rear: #17'],
    ]);
  });

  it('skips flag changes that follow a recording gap', () => {
    const gap = buildRaceControlView(undefined, flags([[5, 'green'], [3, 'none'], [2, 'yellow']]));
    expect(gap.entries.map((e) => e.text)).toEqual(['Green flag']);
  });

  it('leaves out notes after the replay lap', () => {
    const replay = buildRaceControlView(notes, flags([[30, 'green']]), 30);
    expect(replay.entries.map((e) => e.lapLabel)).toEqual(['Lap 30', 'Lap 1', 'Pre-race']);
  });
});
