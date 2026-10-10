import { describe, expect, it } from 'vitest';
import { cup } from '../series/profiles';
import { buildQualifyingView, entriesFromRun, runHasTimes, type FeedWeekendRun } from './qualifying.model';

const run = (times: [string, string, number, number, string?][]): FeedWeekendRun => ({
  run_type: 2,
  run_name: 'Busch Pole Qualifying',
  results: times.map(([car, name, t, mph, comment], i) => ({
    car_number: car, driver_id: i, driver_name: name, finishing_position: i + 1,
    best_lap_time: t, best_lap_speed: mph, best_lap_number: 1, laps_completed: t ? 1 : 0, comment,
  })),
});

describe('qualifying card', () => {
  const lv = run([['11', 'Denny Hamlin', 28.91, 186.787], ['54', 'Ty Gibbs', 28.927, 186.677], ['99', 'Daniel Suarez', 0, 0, 'DNS']]);

  it('shows the pole, times, speeds and gaps, and notes like DNS', () => {
    const v = buildQualifyingView(cup, 'final', entriesFromRun(lv), new Set(['54']));
    expect(v.pole).toBe('Pole: #11 Denny Hamlin, 28.910s (186.787 mph)');
    expect(v.rows.map((r) => [r.position, r.lastName, r.time, r.speed, r.gap, r.highlight])).toEqual([
      [1, 'Hamlin', '28.910s', '186.787', 'Pole', false],
      [2, 'Gibbs', '28.927s', '186.677', '+0.017s', true],
      [3, 'Suarez', 'DNS', '–', '–', false],
    ]);
    expect(runHasTimes(lv)).toBe(true);
  });

  it('treats a run with no times as a lineup set by the rulebook', () => {
    const lineup = run([['77', 'Nicholas Sanchez', 0, 0], ['98', 'Jake Garcia', 0, 0]]);
    expect(runHasTimes(lineup)).toBe(false);
    const v = buildQualifyingView(cup, 'rulebook', entriesFromRun(lineup));
    expect([v.title, v.label, v.timed, v.pole]).toEqual(['Starting lineup', 'Set by the rulebook', false, null]);
  });
});
