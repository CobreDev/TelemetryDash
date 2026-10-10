import { describe, expect, it } from 'vitest';
import type { FeedRace } from '../data/nascar/feed';
import type { FeedWeekendRun } from './qualifying.model';
import { buildScheduleView } from './weekend.model';

const race = {
  race_name: 'Blue Cross NC 300', track_name: 'Charlotte Motor Speedway', race_date: '2026-10-10T16:00:00',
  schedule: [
    { event_name: 'Practice', start_time_utc: '2026-10-10T12:30:00', run_type: 1 },
    { event_name: 'Qualifying', start_time_utc: '2026-10-10T13:35:00', run_type: 2 },
    { event_name: 'Race', start_time_utc: '2026-10-10T20:00:00', run_type: 3 },
  ],
} as FeedRace;
const qual = (time: number): FeedWeekendRun => ({ run_type: 2, run_name: 'Qualifying', results: [{ car_number: '1', driver_id: 1, driver_name: 'A B', finishing_position: 1, best_lap_time: time, best_lap_speed: 0, best_lap_number: 0, laps_completed: 0 }] });
const status = (runs: FeedWeekendRun[] | undefined, now: string) =>
  buildScheduleView('oreilly', race, Date.parse(now), runs).sessions.map((s) => (s.cancelled ? 'Cancelled' : s.done ? 'Done' : 'Upcoming'));

describe('schedule card sessions', () => {
  it('marks practice and qualifying Cancelled when no timed results came an hour after the start', () => {
    expect(status([qual(0)], '2026-10-10T16:00:00Z')).toEqual(['Cancelled', 'Cancelled', 'Upcoming']);
  });

  it('keeps sessions that ran as Done, and gives a session its first hour before judging it', () => {
    expect(status([qual(28.9)], '2026-10-10T16:00:00Z')).toEqual(['Cancelled', 'Done', 'Upcoming']);
    expect(status([], '2026-10-10T13:00:00Z')).toEqual(['Upcoming', 'Upcoming', 'Upcoming']);
  });

  it('never calls anything cancelled without the weekend feed', () => {
    expect(status(undefined, '2026-10-10T16:00:00Z')).toEqual(['Done', 'Done', 'Upcoming']);
  });

  it('reads Weekend Schedule once the first session has started', () => {
    expect(buildScheduleView('oreilly', race, Date.parse('2026-10-10T12:00:00Z')).title).toBe('Next Race');
    expect(buildScheduleView('oreilly', race, Date.parse('2026-10-10T12:31:00Z')).title).toBe('Weekend Schedule');
  });
});
