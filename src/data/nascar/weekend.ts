// Race-weekend timing in US Eastern time (NASCAR's schedule clock): how long a finished race
// stays on screen, and which series the dashboard opens to.
import { easternToEpoch } from './feed';

const ET = 'America/New_York';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Day of the week in Eastern time: 0 = Sunday ... 6 = Saturday. */
export function etDayOfWeek(now: number): number {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short' }).format(now);
  return DAYS.indexOf(day);
}

/** The Eastern calendar date, "2026-10-10", comparable with the schedule's race_date prefix. */
export function etDateKey(now: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/**
 * When a finished race stops being shown: midnight ET at the end of Sunday (Monday 00:00)
 * after the race. A race run on a Monday (rain delay) stays until the end of that Monday.
 * `raceDateET` is the schedule's US Eastern wall-clock time, e.g. "2026-10-11T15:00:00".
 */
export function weekendEndsAt(raceDateET: string): number {
  const [y, m, d] = raceDateET.split('T')[0]!.split('-').map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  const add = dow === 1 ? 1 : (8 - dow) % 7 || 7;
  const end = new Date(Date.UTC(y!, m! - 1, d! + add));
  return easternToEpoch(`${end.toISOString().slice(0, 10)}T00:00:00`);
}

export type HomeReason = 'live' | 'next-race' | 'weekday';

/**
 * The series to open to: a live race's series; else Friday-Sunday the series whose next race
 * starts soonest; else (Monday-Thursday, or nothing scheduled) Cup.
 */
export function homeSeries(opts: {
  now: number;
  liveSeriesId?: string | null;
  nextStarts: { seriesId: string; startsAt: number }[];
}): { seriesId: string; reason: HomeReason } {
  if (opts.liveSeriesId) return { seriesId: opts.liveSeriesId, reason: 'live' };
  const dow = etDayOfWeek(opts.now);
  if (dow === 5 || dow === 6 || dow === 0) {
    const next = opts.nextStarts.filter((n) => n.startsAt > opts.now).sort((a, b) => a.startsAt - b.startsAt)[0];
    if (next) return { seriesId: next.seriesId, reason: 'next-race' };
  }
  return { seriesId: 'cup', reason: 'weekday' };
}
