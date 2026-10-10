import { describe, expect, it } from 'vitest';
import { easternToEpoch } from './feed';
import { etDateKey, etDayOfWeek, homeSeries, weekendEndsAt } from './weekend';

const et = (s: string) => easternToEpoch(s);

describe('race weekends (US Eastern)', () => {
  it('keeps a Friday, Saturday or Sunday race until Monday 00:00 ET', () => {
    const monday = et('2026-10-12T00:00:00');
    expect(weekendEndsAt('2026-10-09T21:00:00')).toBe(monday); // Friday night Trucks
    expect(weekendEndsAt('2026-10-10T15:30:00')).toBe(monday); // Saturday
    expect(weekendEndsAt('2026-10-11T15:00:00')).toBe(monday); // Sunday Cup
  });

  it('keeps a rain-delayed Monday race until the end of that Monday', () => {
    expect(weekendEndsAt('2026-10-12T12:00:00')).toBe(et('2026-10-13T00:00:00'));
  });

  it('reads the day of the week in Eastern time, not UTC', () => {
    expect(etDayOfWeek(et('2026-10-11T23:30:00'))).toBe(0); // Sunday 11:30 PM ET is Monday in UTC
    expect(etDayOfWeek(et('2026-10-12T00:30:00'))).toBe(1);
    expect(etDateKey(et('2026-10-11T23:30:00'))).toBe('2026-10-11');
  });

  it('opens to the live race, the next race on weekends, else Cup', () => {
    const nextStarts = [
      { seriesId: 'cup', startsAt: et('2026-10-11T15:00:00') },
      { seriesId: 'oreilly', startsAt: et('2026-10-10T15:30:00') },
    ];
    expect(homeSeries({ now: et('2026-10-10T10:00:00'), liveSeriesId: 'craftsman', nextStarts })).toEqual({ seriesId: 'craftsman', reason: 'live' });
    expect(homeSeries({ now: et('2026-10-10T10:00:00'), nextStarts })).toEqual({ seriesId: 'oreilly', reason: 'next-race' });
    expect(homeSeries({ now: et('2026-10-10T20:00:00'), nextStarts })).toEqual({ seriesId: 'cup', reason: 'next-race' });
    expect(homeSeries({ now: et('2026-10-13T10:00:00'), nextStarts })).toEqual({ seriesId: 'cup', reason: 'weekday' }); // Tuesday
  });
});
