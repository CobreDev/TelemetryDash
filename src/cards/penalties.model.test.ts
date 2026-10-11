import { describe, expect, it } from 'vitest';
import type { TrackFlag } from '../data/types';
import { buildPenaltiesView } from './penalties.model';

const note = (NoteID: number, FlagState: number, Note: string) => ({ NoteID, FlagState, Note });
const names = new Map([
  ['12', 'Ryan Blaney'],
  ['11', 'Denny Hamlin'],
  ['42', 'John Hunter Nemechek'],
  ['66', 'Josh Bilicki'],
  ['3', 'Austin Dillon'],
  ['41', 'Cole Custer'],
]);
const green = (n: number): TrackFlag[] => Array<TrackFlag>(n).fill('green');

describe('buildPenaltiesView', () => {
  it('reads penalties from NASCAR\'s notes, with the standard punishment for the flag', () => {
    const v = buildPenaltiesView('cup', {
      laps: {
        '37': [note(1, 2, 'All lead lap cars pit.  #5 gets off pit road first.  #12 too fast entering.  #11 gets boxed in and has to back up before leaving.  #11 safety violation')],
        '97': [note(2, 1, 'Penalties include: #41 uncontrolled tire, #42, #66 and #3 speeding.')],
      },
    }, green(100), names);
    expect(v.rows.map((r) => [r.lap, r.carNumber, r.lastName, r.penalty, r.punishment])).toEqual([
      [97, '41', 'Custer', 'Uncontrolled tire', 'Pass-through'],
      [97, '42', 'Nemechek', 'Speeding', 'Pass-through'],
      [97, '66', 'Bilicki', 'Speeding', 'Pass-through'],
      [97, '3', 'Dillon', 'Speeding', 'Pass-through'],
      [37, '12', 'Blaney', 'Speeding', 'Tail of the field'],
      [37, '11', 'Hamlin', 'Safety violation', 'Tail of the field'],
    ]);
    expect(v.notes).toHaveLength(1);
  });

  it('uses a punishment the note states, and skips mentions of one already served', () => {
    const v = buildPenaltiesView('cup', {
      laps: {
        '400': [note(3, 1, '#12 is given a commitment line violation from the aborted stop and must restart at the rear')],
        '426': [note(4, 1, '#12, who restarted at the rear following his commitment line violation, has moved up to 7th')],
      },
    }, green(430), names);
    expect(v.rows.map((r) => [r.lap, r.carNumber, r.penalty, r.punishment, r.punishmentStated])).toEqual([
      [400, '12', 'Commitment line violation', 'Tail of the field', true],
    ]);
    expect(v.notes).toEqual([]);
  });

  it('leaves out notes after the replay lap', () => {
    const v = buildPenaltiesView('cup', { laps: { '50': [note(5, 1, '#3 speeding')] } }, green(60), names, 40);
    expect(v.rows).toEqual([]);
  });
});
