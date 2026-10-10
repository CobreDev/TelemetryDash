// Qualifying card: live best laps during the session, the official order afterwards, or the
// lineup when qualifying is cancelled (set by the rulebook). Strings are formatted here so the
// web UI and API clients match.
import type { FeedLapTimes } from '../data/nascar/feed';
import { parseDriverName } from '../data/nascar/names';
import { gapTime, lapTime } from '../format/format';
import { markerHighlight, markerNotes, markerSuffixes } from '../series/markers';
import type { SeriesProfile } from '../series/types';

const EN_DASH = '–';

/** One result of weekend-feed.json's qualifying run (`weekend_runs[].results`). */
export interface FeedRunResult {
  car_number: string;
  driver_id: number;
  driver_name: string;
  finishing_position: number;
  best_lap_time: number;
  best_lap_speed: number;
  best_lap_number: number;
  laps_completed: number;
  /** "DNS", "DQ", ... */
  comment?: string;
}
export interface FeedWeekendRun {
  run_type: number;
  run_name: string;
  results: FeedRunResult[];
}

/** live: session running; final: official order with times; rulebook: lineup set without times. */
export type QualifyingStatus = 'live' | 'final' | 'rulebook';

export interface QualifyingEntry {
  position: number;
  carNumber: string;
  /** Name as the feed has it (markers like "(i)" or "#" are read from it). */
  fullName: string;
  best: number | null;
  speed: number | null;
  laps: number;
  note?: string;
}

export interface QualifyingRow {
  position: number;
  carNumber: string;
  carBadge: string;
  firstName: string;
  lastName: string;
  markers: string[];
  highlight: boolean;
  /** "28.910s", or the note ("DNS") / "–". */
  time: string;
  /** "186.787" */
  speed: string;
  /** "Pole", "+0.017s" or "–". */
  gap: string;
  isPole: boolean;
}

export interface QualifyingView {
  seriesId: string;
  status: QualifyingStatus;
  title: string;
  /** "Live", "Final" or "Lineup set by the rulebook". */
  label: string;
  /** "Pole: #11 Denny Hamlin, 28.910s (186.787 mph)" */
  pole: string | null;
  columns: { pos: string; car: string; name: string; time: string; speed: string; gap: string };
  /** Rulebook lineups have no times, so clients hide the time columns. */
  timed: boolean;
  rows: QualifyingRow[];
  notes: string[];
}

/**
 * `chaseCars`: the Chase field by car number (the name text over-marks "(C)", so it's always
 * rebuilt from this, as elsewhere).
 */
export function buildQualifyingView(
  profile: SeriesProfile,
  status: QualifyingStatus,
  entries: QualifyingEntry[],
  chaseCars: ReadonlySet<string> = new Set(),
): QualifyingView {
  const sorted = [...entries].sort((a, b) => a.position - b.position);
  const poleTime = sorted.find((e) => e.best)?.best ?? null;
  const shown = new Set<string>();
  const rows = sorted.map((e): QualifyingRow => {
    const name = parseDriverName(e.fullName);
    const tokens = [...name.markerTokens.filter((t) => t !== '(C)'), ...(chaseCars.has(e.carNumber) ? ['(C)'] : [])];
    tokens.forEach((t) => shown.add(t));
    const isPole = status !== 'rulebook' && !!e.best && e.best === poleTime;
    return {
      position: e.position,
      carNumber: e.carNumber,
      carBadge: `/api/v1/series/${profile.id}/car-badges/${e.carNumber}.png`,
      firstName: name.firstName,
      lastName: name.lastName,
      markers: markerSuffixes(tokens, profile),
      highlight: markerHighlight(tokens, profile),
      time: e.best ? lapTime(e.best) : e.note || EN_DASH,
      speed: e.speed ? e.speed.toFixed(3) : EN_DASH,
      gap: !e.best || poleTime === null ? EN_DASH : isPole ? 'Pole' : gapTime(e.best - poleTime),
      isPole,
    };
  });
  const top = sorted.find((e) => e.best);
  const poleName = top ? parseDriverName(top.fullName) : null;
  const notes = [
    ...(status === 'live' ? ['Live: best lap so far for each car, refreshed as laps complete.'] : []),
    ...(status === 'rulebook' ? ['Qualifying didn’t run; NASCAR set the starting lineup by the rulebook.'] : []),
    ...markerNotes(shown, profile),
  ];
  return {
    seriesId: profile.id,
    status,
    title: status === 'rulebook' ? 'Starting lineup' : 'Qualifying',
    label: status === 'live' ? 'Live' : status === 'final' ? 'Final' : 'Set by the rulebook',
    pole:
      top && poleName && status !== 'rulebook'
        ? `${status === 'live' ? 'Fastest' : 'Pole'}: #${top.carNumber} ${poleName.firstName} ${poleName.lastName}, ${lapTime(top.best!)}${top.speed ? ` (${top.speed.toFixed(3)} mph)` : ''}`
        : null,
    columns: { pos: 'Pos', car: 'Car', name: 'Driver', time: 'Time', speed: 'MPH', gap: 'Gap' },
    timed: status !== 'rulebook',
    rows,
    notes,
  };
}

/** Official order from weekend-feed's qualifying run. */
export function entriesFromRun(run: FeedWeekendRun): QualifyingEntry[] {
  return run.results.map((r) => ({
    position: r.finishing_position,
    carNumber: r.car_number,
    fullName: r.driver_name,
    best: r.best_lap_time > 0 ? r.best_lap_time : null,
    speed: r.best_lap_speed > 0 ? r.best_lap_speed : null,
    laps: r.laps_completed,
    note: r.comment?.trim() || undefined,
  }));
}

/** Live session: each car's best fully-timed lap so far (garage laps over 1.5x the best don't count). */
export function entriesFromLive(lapTimes: FeedLapTimes): QualifyingEntry[] {
  const all = lapTimes.laps.flatMap((c) => c.Laps.filter((l) => l.Lap >= 1 && l.LapTime && !l.Estimated).map((l) => l.LapTime!));
  const cap = all.length ? Math.min(...all) * 1.5 : Infinity;
  return lapTimes.laps
    .map((c) => {
      const timed = c.Laps.filter((l) => l.Lap >= 1 && l.LapTime && !l.Estimated && l.LapTime <= cap);
      const bestLap = timed.reduce<(typeof timed)[number] | null>((b, l) => (!b || l.LapTime! < b.LapTime! ? l : b), null);
      return {
        carNumber: c.Number,
        fullName: c.FullName,
        best: bestLap?.LapTime ?? null,
        speed: bestLap?.LapSpeed ? Number(bestLap.LapSpeed) || null : null,
        laps: c.Laps.filter((l) => l.Lap >= 1).length,
      };
    })
    .sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity) || b.laps - a.laps)
    .map((e, i) => ({ ...e, position: i + 1 }));
}

/** A qualifying run counts as run once any car has a time; otherwise it's a pre-set lineup. */
export const runHasTimes = (run: FeedWeekendRun) => run.results.some((r) => r.best_lap_time > 0);
