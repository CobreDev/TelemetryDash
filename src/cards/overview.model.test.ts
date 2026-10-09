import { describe, expect, it } from 'vitest';
import type { FeedLapTimes } from '../data/nascar/feed';
import { cup } from '../series/profiles';
import { buildPracticeView } from './overview.model';

const lap = (Lap: number, LapTime: number, Estimated?: boolean) => ({ Lap, LapTime, RunningPos: 1, Estimated });
const lapTimes: FeedLapTimes = {
  flags: [],
  laps: [
    { Number: '1', FullName: 'Slow Car', Laps: [lap(1, 31.0), lap(2, 30.6)] },
    { Number: '2', FullName: 'Fast Car (C)', Laps: [lap(1, 29.0, true), lap(2, 30.2)] }, // estimated 29.0 must not count
    { Number: '3', FullName: 'No Time', Laps: [lap(1, 40, true), lap(2, 325.5)] }, // garage lap: too slow to count
  ],
};

describe('buildPracticeView', () => {
  it('ranks by best fully timed lap and ignores estimated laps', () => {
    const v = buildPracticeView(lapTimes, cup, 'Final Practice');
    expect(v.mode).toBe('practice');
    expect(v.rows.map((r) => [r.carNumber, r.lastLap, r.gapToLeader, r.interval, r.lapsSincePit])).toEqual([
      ['2', '30.200s', 'Fastest', '–', '2'],
      ['1', '30.600s', '+0.400s', '+0.400s', '2'],
      ['3', '–', 'No time', '–', '2'],
    ]);
    expect(v.rows[0]!.highlight).toBe(true);
  });
});
