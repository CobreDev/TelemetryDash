import { describe, expect, it } from 'vitest';
import type { FeedLapTimes, FeedRace } from './feed';
import { replayPaceDataset } from './replay';

const race: FeedRace = {
  race_id: 1, series_id: 3, race_name: 'Test 200', track_name: 'Track', race_date: '2026-10-09T17:00:00',
  race_season: 2026, scheduled_laps: 100, actual_laps: null,
};
// Lap 34 was run green; the caution came out after it.
const lapTimes: FeedLapTimes = {
  flags: Array.from({ length: 35 }, (_, i) => ({ LapsCompleted: i, FlagState: i === 0 ? 8 : 1 })),
  laps: [],
};

describe('replayPaceDataset flag', () => {
  it('uses the last completed lap for replays', () => {
    expect(replayPaceDataset('craftsman', race, lapTimes, [], 34).flag).toBe('green');
  });
  it('uses the current flag when live, not the last completed lap', () => {
    expect(replayPaceDataset('craftsman', race, lapTimes, [], 34, undefined, { source: 'live', currentFlag: 2 }).flag).toBe('yellow');
  });
});
