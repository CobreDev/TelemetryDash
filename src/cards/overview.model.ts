import { CAUTION_BURN, type OverviewEntry } from '../data/nascar/overview';
import type { FeedLapTimes } from '../data/nascar/feed';
import { parseDriverName } from '../data/nascar/names';
import { gapTime, lapTime } from '../format/format';
import { markerHighlight, markerNotes, markerSuffixes } from '../series/markers';
import type { SeriesProfile } from '../series/types';

const EN_DASH = '–';

export interface OverviewRow {
  position: number;
  carNumber: string;
  carBadge: string;
  firstName: string;
  lastName: string;
  markers: string[];
  /** Row tint for highlight-style markers (Chase drivers). */
  highlight: boolean;
  lastLap: string;
  /** "Leader", "+5.119s", "+1 Lap", "Out". */
  gapToLeader: string;
  /** To the car ahead: "+0.244s", "+1 Lap", or "–" for the leader. */
  interval: string;
  lapsSincePit: string;
  /** "64%" of a full tank (modeled). */
  fuel: string;
  /** Mean lap time over the last 10 laps, e.g. "31.512s". */
  avgLap: string;
  isLeader: boolean;
  out: boolean;
}

export interface OverviewView {
  seriesId: string;
  atLap: number;
  /** 'practice' covers practice and qualifying: ranked by best lap, no race columns. */
  mode?: 'race' | 'practice';
  columns: { pos: string; car: string; name: string; lastLap: string; gap: string; interval: string; pit: string; fuel: string; avgLap: string };
  rows: OverviewRow[];
  notes: string[];
}

const laps = (n: number) => `+${n} ${n === 1 ? 'Lap' : 'Laps'}`;

/** Display strings for the Overview tab; shared by the web UI and API clients. */
export function buildOverviewView(entries: OverviewEntry[], profile: SeriesProfile, atLap: number): OverviewView {
  const shown = new Set<string>();
  const rows = entries.map((e): OverviewRow => {
    const name = parseDriverName(e.fullName);
    name.markerTokens.forEach((t) => shown.add(t));
    return {
      position: e.position,
      carNumber: e.carNumber,
      carBadge: `/api/v1/series/${profile.id}/car-badges/${e.carNumber}.png`,
      firstName: name.firstName,
      lastName: name.lastName,
      markers: markerSuffixes(name.markerTokens, profile),
      highlight: markerHighlight(name.markerTokens, profile),
      lastLap: e.lastLapTime ? lapTime(e.lastLapTime) : EN_DASH,
      gapToLeader: e.out ? 'Out' : e.position === 1 ? 'Leader' : e.gapToLeader !== null ? gapTime(e.gapToLeader) : laps(e.lapsDown),
      interval:
        e.position === 1 ? EN_DASH : e.out ? 'Out' : e.interval !== null ? gapTime(e.interval) : laps(e.lapsBehindAhead),
      lapsSincePit: e.lapsSincePit === null ? EN_DASH : String(e.lapsSincePit),
      fuel: e.fuelEstimate === null ? EN_DASH : `${Math.round(e.fuelEstimate * 100)}%`,
      avgLap: e.avgLap10 === null ? EN_DASH : lapTime(e.avgLap10),
      isLeader: e.position === 1,
      out: e.out,
    };
  });

  return {
    seriesId: profile.id,
    atLap,
    columns: {
      pos: 'Pos',
      car: 'Car',
      name: 'Driver',
      lastLap: 'Last lap',
      gap: 'To leader',
      interval: 'To next',
      pit: 'Since pit',
      fuel: 'Est. fuel',
      avgLap: '10-lap avg',
    },
    rows,
    notes: [
      'Gaps measured at the start/finish line.',
      ...markerNotes(shown, profile),
      `Est. fuel is modeled, not measured: % of a full tank, assuming every stop fills it, a caution lap burns ${Math.round(CAUTION_BURN * 100)}% of a green lap, and the field's longest run so far used one tank.`,
      '10-lap avg: mean lap time over each car\'s last 10 laps, including caution and pit laps.',
    ],
  };
}

/**
 * Practice / qualifying: there's no running order to speak of, so rank by each car's best
 * (fully timed) lap, as NASCAR's own timing does. Same row shape, different meanings:
 * lastLap = best lap, gapToLeader = gap to the fastest, interval = gap to the car ahead,
 * lapsSincePit = laps run. Fuel and 10-lap average don't apply and show a dash.
 */
export function buildPracticeView(lapTimes: FeedLapTimes, profile: SeriesProfile, session: string): OverviewView {
  const shown = new Set<string>();
  // Laps that include time parked in the garage are "timed" but aren't real laps: only laps
  // within 1.5x the field's fastest count toward a best lap.
  const all = lapTimes.laps.flatMap((c) => c.Laps.filter((l) => l.Lap >= 1 && l.LapTime && !l.Estimated).map((l) => l.LapTime!));
  const cap = all.length ? Math.min(...all) * 1.5 : Infinity;
  const cars = lapTimes.laps
    .map((c) => {
      const timed = c.Laps.filter((l) => l.Lap >= 1 && l.LapTime && !l.Estimated && l.LapTime <= cap);
      const best = timed.reduce<number | null>((b, l) => (b === null || l.LapTime! < b ? l.LapTime! : b), null);
      const ran = c.Laps.filter((l) => l.Lap >= 1).length;
      return { c, best, ran, last: c.Laps.at(-1)?.Lap ? c.Laps.at(-1)!.LapTime : null };
    })
    .sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity) || b.ran - a.ran);
  const top = cars[0]?.best ?? null;
  const rows = cars.map(({ c, best, ran }, i): OverviewRow => {
    const name = parseDriverName(c.FullName);
    name.markerTokens.forEach((t) => shown.add(t));
    const prev = cars[i - 1]?.best ?? null;
    return {
      position: i + 1,
      carNumber: c.Number,
      carBadge: `/api/v1/series/${profile.id}/car-badges/${c.Number}.png`,
      firstName: name.firstName,
      lastName: name.lastName,
      markers: markerSuffixes(name.markerTokens, profile),
      highlight: markerHighlight(name.markerTokens, profile),
      lastLap: best === null ? EN_DASH : lapTime(best),
      gapToLeader: best === null ? 'No time' : i === 0 ? 'Fastest' : gapTime(best - top!),
      interval: best === null || i === 0 || prev === null ? EN_DASH : gapTime(best - prev),
      lapsSincePit: String(ran),
      fuel: EN_DASH,
      avgLap: EN_DASH,
      isLeader: i === 0 && best !== null,
      out: best === null,
    };
  });
  return {
    seriesId: profile.id,
    atLap: Math.max(0, ...cars.map((x) => x.ran)),
    mode: 'practice',
    columns: { pos: 'Pos', car: 'Car', name: 'Driver', lastLap: 'Best lap', gap: 'To fastest', interval: 'To next', pit: 'Laps', fuel: 'Est. fuel', avgLap: '10-lap avg' },
    rows,
    notes: [
      `${session}: ranked by each driver's best fully timed lap.`,
      ...markerNotes(shown, profile),
      'Laps recorded before the dashboard joined the session have no individual times.',
    ],
  };
}
