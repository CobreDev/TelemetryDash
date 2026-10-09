// Display models for the off-week Overview: the next race weekend's schedule and the last
// race's results. Strings are formatted here so the web UI and API clients match.
import type { FeedRace, FeedWeekendRace } from '../data/nascar/feed';
import { easternToEpoch } from '../data/nascar/feed';
import { parseDriverName } from '../data/nascar/names';
import { tvNetwork, type TvNetwork } from '../data/nascar/networks';
import type { FeedLivePoints } from '../data/nascar/points';
import { markerHighlight, markerNotes, markerSuffixes } from '../series/markers';
import type { SeriesProfile } from '../series/types';

export type SessionKind = 'practice' | 'qualifying' | 'race';
const KIND: Record<number, SessionKind> = { 1: 'practice', 2: 'qualifying', 3: 'race' };
/** How long after its start a session is assumed over (the schedule has no end times). */
const RUNS_FOR_MS: Record<SessionKind, number> = { practice: 3_600_000, qualifying: 2 * 3_600_000, race: 5 * 3_600_000 };

export interface ScheduleView {
  seriesId: string;
  raceName: string;
  venue: string;
  sessions: {
    name: string;
    kind: SessionKind;
    /** "Fri, Oct 9" */
    day: string;
    /** "5:00 PM ET" (the web UI reformats startsAt in the browser's 12/24-hour style). */
    time: string;
    /** Start in ms epoch, for clients that want local time. */
    startsAt: number;
    done: boolean;
  }[];
  tv: TvNetwork | null;
  radio: string | null;
}

const ET = 'America/New_York';
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short', month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: ET, hour: 'numeric', minute: '2-digit' });

/** On-track sessions only (practice, qualifying, race); garage hours and meetings are left out. */
export function buildScheduleView(seriesId: string, race: FeedRace, now: number): ScheduleView {
  const sessions = (race.schedule ?? [])
    .filter((e) => KIND[e.run_type])
    .map((e) => {
      const kind = KIND[e.run_type]!;
      const startsAt = Date.parse(`${e.start_time_utc}Z`);
      return {
        name: e.event_name.trim(),
        kind,
        day: dayFmt.format(startsAt),
        time: `${timeFmt.format(startsAt)} ET`,
        startsAt,
        done: startsAt + RUNS_FOR_MS[kind] < now,
      };
    })
    .sort((a, b) => a.startsAt - b.startsAt);
  // No on-track times published yet: fall back to the race start from the season schedule.
  if (!sessions.length) {
    const startsAt = easternToEpoch(race.race_date);
    sessions.push({ name: 'Race', kind: 'race', day: dayFmt.format(startsAt), time: `${timeFmt.format(startsAt)} ET`, startsAt, done: false });
  }
  return {
    seriesId,
    raceName: race.race_name,
    venue: race.track_name,
    sessions,
    tv: tvNetwork(race.television_broadcaster) ?? null,
    radio: race.radio_broadcaster || null,
  };
}

export interface ResultsRow {
  position: number;
  carNumber: string;
  carBadge: string;
  firstName: string;
  lastName: string;
  markers: string[];
  highlight: boolean;
  start: string;
  led: string;
  /** "Running", "+2 Laps", or why the car fell out ("Accident"). */
  status: string;
  points: string;
  isWinner: boolean;
}

export interface ResultsView {
  seriesId: string;
  raceName: string;
  venue: string;
  /** "Sat, Oct 3" */
  date: string;
  /** "201 laps · 3 cautions · 15 lead changes" */
  summary: string;
  columns: { pos: string; car: string; name: string; start: string; led: string; status: string; points: string };
  rows: ResultsRow[];
  notes: string[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Final results. Markers come from the points file when there is one (it knows rookies,
 * eligibility and the Chase); otherwise from the name text, minus the unreliable "(C)".
 */
export function buildResultsView(profile: SeriesProfile, race: FeedWeekendRace, livePoints?: FeedLivePoints[]): ResultsView {
  const byDriver = new Map(livePoints?.map((d) => [d.driver_id, d]));
  const shown = new Set<string>();
  const rows = [...race.results]
    .sort((a, b) => a.finishing_position - b.finishing_position)
    .map((r): ResultsRow => {
      const name = parseDriverName(r.driver_fullname);
      const p = byDriver.get(r.driver_id);
      const tokens = p
        ? [p.is_rookie && '#', !p.is_points_eligible && '(i)', p.is_in_chase && '(C)'].filter((t): t is string => !!t)
        : name.markerTokens.filter((t) => t !== '(C)');
      tokens.forEach((t) => shown.add(t));
      const running = r.finishing_status === 'Running';
      return {
        position: r.finishing_position,
        carNumber: r.car_number,
        carBadge: `/api/v1/series/${profile.id}/car-badges/${r.car_number}.png`,
        firstName: name.firstName,
        lastName: name.lastName,
        markers: markerSuffixes(tokens, profile),
        highlight: markerHighlight(tokens, profile),
        start: String(r.starting_position),
        led: r.laps_led ? String(r.laps_led) : '–',
        status: running ? (r.diff_laps > 0 ? `+${plural(r.diff_laps, 'Lap')}` : 'Running') : r.finishing_status,
        points: String(r.points_earned),
        isWinner: r.finishing_position === 1,
      };
    });
  const summary = [
    race.actual_laps ? `${race.actual_laps} laps` : null,
    plural(race.number_of_cautions, 'caution'),
    plural(race.number_of_lead_changes, 'lead change'),
  ].filter(Boolean);
  return {
    seriesId: profile.id,
    raceName: race.race_name,
    venue: race.track_name,
    date: dayFmt.format(easternToEpoch(race.race_date)),
    summary: summary.join(' · '),
    columns: { pos: 'Pos', car: 'Car', name: 'Driver', start: 'Start', led: 'Led', status: 'Status', points: 'Pts' },
    rows,
    notes: markerNotes(shown, profile),
  };
}
