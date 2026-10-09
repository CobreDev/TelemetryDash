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

  it('adds the red flag from NASCAR\'s notes when the lap flags missed it', () => {
    const red = buildRaceControlView(
      { laps: { '120': [{ FlagState: 3, Note: 'Red flag displayed for cleanup', NoteID: 9 }] } },
      flags([[100, 'green'], [22, 'yellow']]),
    );
    // Caution, red flag, back to caution (then green, once it comes), each kept in the history.
    expect(red.entries.slice(0, 4).map((e) => [e.lapLabel, e.kind, e.flag, e.text])).toEqual([
      ['Lap 121', 'flag', 'yellow', 'Red flag lifted: caution'],
      ['Lap 120', 'note', 'red', 'Red flag displayed for cleanup'],
      ['Lap 120', 'flag', 'red', 'Red flag'],
      ['Lap 101', 'flag', 'yellow', 'Caution'],
    ]);
  });

  it('calls the caution after a red flag "lifted", and never doubles the red entry', () => {
    const view = buildRaceControlView(
      { laps: { '120': [{ FlagState: 3, Note: 'Red flag displayed', NoteID: 9 }] } },
      flags([[118, 'yellow'], [2, 'red'], [2, 'yellow']]),
    );
    const flagsOnly = view.entries.filter((e) => e.kind === 'flag').map((e) => e.text);
    expect(flagsOnly).toEqual(['Red flag lifted: caution', 'Red flag', 'Caution']);
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
