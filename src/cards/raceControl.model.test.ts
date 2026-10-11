import { describe, expect, it } from 'vitest';
import type { TrackFlag } from '../data/types';
import { buildRaceControlView, countCautions } from './raceControl.model';

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
      ['Lap 37', 'flag', 'Green flag: restart'],
      ['Lap 31', 'info', '12th stage win for #34'],
      ['Lap 30', 'note', '#34 wins stage 1'],
      ['Lap 30', 'flag', 'Caution'],
      ['Start', 'flag', 'Green flag'],
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
      ['Lap 120', 'note', 'red', 'Red flag displayed for cleanup'],
      ['Lap 120', 'flag', 'yellow', 'Red flag lifted: caution'],
      ['Lap 120', 'flag', 'red', 'Red flag'],
      ['Lap 100', 'flag', 'yellow', 'Caution'],
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

  it('labels flags by laps completed, like the header: white at 133, checkered at 134', () => {
    const done = buildRaceControlView(undefined, flags([[133, 'green'], [1, 'white']]), Infinity, 134);
    expect(done.entries.slice(0, 2).map((e) => [e.lapLabel, e.text])).toEqual([['Lap 134', 'Checkered flag'], ['Lap 133', 'White flag']]);
  });

  it('skips flag changes that follow a recording gap', () => {
    const gap = buildRaceControlView(undefined, flags([[5, 'green'], [3, 'none'], [2, 'yellow']]));
    expect(gap.entries.map((e) => e.text)).toEqual(['Green flag']);
  });

  it('leaves out notes after the replay lap', () => {
    const replay = buildRaceControlView(notes, flags([[30, 'green']]), 30);
    expect(replay.entries.map((e) => e.lapLabel)).toEqual(['Lap 30', 'Start', 'Pre-race']);
  });

  it('counts cautions and caution laps, or takes NASCAR\'s', () => {
    expect(view.cautions).toBe('1 caution · 7 laps');
    expect(countCautions(flags([[5, 'green'], [2, 'yellow'], [1, 'red'], [2, 'yellow'], [3, 'green'], [1, 'yellow']]))).toEqual({ count: 2, laps: 5 });
    expect(buildRaceControlView(notes, flags([[3, 'green']]), Infinity, undefined, { cautions: { count: 2, laps: 9 } }).cautions).toBe('2 cautions · 9 laps');
  });

  it('calls a caution NASCAR notes as a competition caution "Competition Caution"', () => {
    const comp = { laps: { '21': [{ FlagState: 2, Note: 'Competition caution to check tire wear', NoteID: 9 }] } };
    const v = buildRaceControlView(comp, flags([[20, 'green'], [4, 'yellow'], [1, 'green']]));
    expect(v.entries.find((e) => e.kind === 'flag' && e.flag === 'yellow')?.text).toBe('Competition Caution');
  });

  it('puts the stage result on the stage\'s last lap, above that lap\'s notes', () => {
    const v = buildRaceControlView(notes, flags([[30, 'green'], [7, 'yellow'], [3, 'green']]), Infinity, undefined, {
      stages: [{ stage: 1, lap: 30, results: [{ carNumber: '34', name: 'Todd Gilliland', points: 10 }, { carNumber: '11', name: 'Denny Hamlin', points: 9 }] }],
    });
    const lap30 = v.entries.filter((e) => e.lap === 30).map((e) => [e.kind, e.text]);
    expect(lap30).toEqual([
      ['stage', 'Stage 1 winner: #34 Todd Gilliland'],
      ['note', '#34 wins stage 1'],
      ['flag', 'Caution'],
    ]);
  });
});
