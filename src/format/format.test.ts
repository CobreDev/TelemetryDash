import { describe, expect, it } from 'vitest';
import { fuel, raceStatusLines, gapPercent, gapTime, lapRange, lapTime, pitTime, positionChange, raceProgress, raceProgressLabel, soFar } from './format';

describe('display formats (DESIGN.md examples)', () => {
  it('lap time', () => {
    expect(lapTime(31.34)).toBe('31.340s');
    expect(lapTime(99.999)).toBe('99.999s');
    expect(lapTime(118.219)).toBe('1:58.219');
    expect(lapTime(100.0004)).toBe('1:40.000');
    expect(lapTime(65.05)).toBe('65.050s');
  });
  it('pit time', () => expect(pitTime(8.3)).toBe('8.30s'));
  it('gap time', () => {
    expect(gapTime(0.212)).toBe('+0.212s');
    expect(gapTime(0)).toBe('+0.000s');
  });
  it('gap percent', () => {
    expect(gapPercent(0.6912)).toBe('0.69%');
    expect(gapPercent(0)).toBe('0.00%');
  });
  it('fuel', () => {
    expect(fuel(80.8, 'GAL')).toBe('80.8 GAL');
    expect(fuel(42, 'L')).toBe('42.0 L');
  });
  it('position change', () => {
    expect(positionChange(10)).toBe('+10');
    expect(positionChange(-1)).toBe('−1');
    expect(positionChange(0)).toBe('–');
  });
  it('lap range', () => {
    expect(lapRange(221, 240)).toBe('Laps 221–240');
    expect(soFar(167)).toBe('so far, lap 167');
  });
});

describe('race progress', () => {
  const cup = [80, 85, 102]; // Las Vegas, 267 laps
  const label = (lap: number) => raceProgressLabel(raceProgress(lap, 267, cup), 'Stage');
  it('names the stage and laps left in it', () => {
    expect(raceProgress(134, 267, cup)).toEqual({
      lap: 134, totalLaps: 267, lapsToGo: 133, stage: 2, stageCount: 3, stageLapsRemaining: 31, stageLap: 54, stageLength: 85,
    });
    expect(label(134)).toBe('Stage 2: 31 laps to go \u00B7 Lap 134/267');
    expect(label(79)).toBe('Stage 1: 1 lap to go \u00B7 Lap 79/267');
    expect(label(240)).toBe('Stage 3: 27 laps to go \u00B7 Lap 240/267');
  });
  it('marks stage ends and the finish', () => {
    expect(label(80)).toBe('End of Stage 1 \u00B7 Lap 80/267');
    expect(label(267)).toBe('Final \u00B7 Lap 267/267');
  });
  it('falls back to the lap count without valid stages', () => {
    expect(raceProgressLabel(raceProgress(50, 200, [60, 60]), 'Stage')).toBe('Lap 50/200');
    expect(raceProgressLabel(raceProgress(50, 200, [100, 100]), null)).toBe('Lap 50/200');
  });
});

describe('race status lines (TV-style block)', () => {
  const cup = [80, 85, 102];
  const lines = (lap: number, total = 267, stages = cup) => raceStatusLines(raceProgress(lap, total, stages), 'Stage');
  it('shows stage lap and race laps to go', () => {
    expect(lines(2, 120, [30, 30, 60])).toEqual([
      { label: 'Stage 1', value: '2|30' },
      { label: '118 To Go', value: '2|120' },
    ]);
    expect(lines(134)).toEqual([
      { label: 'Stage 2', value: '54|85' },
      { label: '133 To Go', value: '134|267' },
    ]);
  });
  it('collapses to a countdown under 10 laps left in a stage', () => {
    expect(lines(259)).toEqual([{ label: 'Stage 3', value: '8 To Go' }]);
    expect(lines(71)).toEqual([{ label: 'Stage 1', value: '9 To Go' }]);
    expect(lines(70)).toHaveLength(2);
  });
  it('handles stage ends, the finish, and series without stages', () => {
    expect(lines(80)).toEqual([{ label: 'Stage 1', value: 'Complete' }]);
    expect(lines(267)).toEqual([{ label: 'Final', value: '267|267' }]);
    expect(raceStatusLines(raceProgress(50, 200, []), null)).toEqual([{ label: '150 To Go', value: '50|200' }]);
  });
});
