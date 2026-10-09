import { describe, expect, it } from 'vitest';
import { samplePace } from '../data/sample/pace';
import { cup } from '../series/profiles';
import { raceProgress } from '../format/format';
import { buildPaceRankings, statusFlag } from './paceRankings.model';

describe('buildPaceRankings', () => {
  const card = buildPaceRankings(samplePace.cup!, cup, '@handle');

  it('ranks the full field, then lists excluded cars unranked', () => {
    expect(card.rows).toHaveLength(12);
    expect(card.header.title).toBe('Pace Rankings');
    expect(card.rows.at(-1)).toMatchObject({ rank: null, carNumber: '1', score: '\u2013', excluded: 'diffuser damage' });
  });

  it('caps to a top-N list when asked, without excluded cars', () => {
    const top = buildPaceRankings(samplePace.cup!, cup, '@h', { limit: 10 });
    expect(top.rows).toHaveLength(10);
    expect(top.header.title).toBe('Top 10 Pace Rankings');
    expect(top.rows.map((r) => r.carNumber)).not.toContain('1');
    expect(card.rows[0]).toMatchObject({ rank: 1, carNumber: '8', score: '30.412s', gapPercent: '0.00%', isLeader: true });
  });

  it('shares a rank on ties, ordered by car number', () => {
    expect(card.rows.slice(2, 5).map((r) => [r.rank, r.carNumber])).toEqual([
      [3, '17'],
      [3, '41'],
      [5, '3'],
    ]);
  });

  it('maps feed markers to profile labels and explains them in the footer', () => {
    expect(card.rows.find((r) => r.carNumber === '41')?.markers).toEqual(['(R)']);
    expect(card.footer.notes).toContain('(R) Rookie');
    expect(card.footer.notes).toContain('(i) Ineligible for points in this series');
    expect(card.footer.notes).toContain('Garrity excluded: diffuser damage');
  });

  it('stamps live data with stage progress and closed ranges otherwise', () => {
    expect(card.footer.lapStamp).toBe('Stage 3: 100 laps to go \u00B7 Lap 167/267');
    expect(card.progress).toMatchObject({ stage: 3, stageLapsRemaining: 100 });
    expect(buildPaceRankings(samplePace.craftsman!, cup, '@h').footer.lapStamp).toBe('Laps 61–134');
  });

  it('computes gap percent against the leader', () => {
    // (30.448 - 30.412) / 30.412 = 0.118%
    expect(card.rows[1]?.gapPercent).toBe('0.12%');
  });
});

describe('statusFlag', () => {
  const stages = [30, 30, 74];
  const flags = (n: number, last: 'green' | 'yellow') => [...Array<'green'>(n - 1).fill('green'), last];

  it('shows the green/white checkered on the lap a stage ends under green', () => {
    // The stage-break caution is already out, but the stage ended green.
    expect(statusFlag(raceProgress(30, 134, stages), 'yellow', flags(30, 'green'))).toBe('stage-green');
  });

  it('shows the yellow/white checkered when the stage ends under caution', () => {
    expect(statusFlag(raceProgress(60, 134, stages), 'yellow', flags(60, 'yellow'))).toBe('stage-yellow');
  });

  it('shows track status otherwise, and the plain checkered at the finish', () => {
    expect(statusFlag(raceProgress(31, 134, stages), 'yellow', flags(31, 'yellow'))).toBe('yellow');
    expect(statusFlag(raceProgress(134, 134, stages), 'checkered', flags(134, 'green'))).toBe('checkered');
    expect(statusFlag(null, undefined, undefined)).toBe('none');
  });

  it('shows the checkered at the finish even while the feed still says white', () => {
    expect(statusFlag(raceProgress(134, 134, stages), 'white', flags(134, 'green'))).toBe('checkered');
  });
});
