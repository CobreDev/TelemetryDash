import type { TrackFlag } from '../types';

// Shapes of NASCAR's public replay files (cf.nascar.com/cacher/{year}/{seriesId}/{raceId}/...).
// Unofficial and undocumented; only the fields we use are typed.

export interface FeedLap {
  Lap: number;
  LapTime: number | null;
  /** mph as a string, e.g. "181.232". */
  LapSpeed?: string | null;
  RunningPos: number;
  /** Live collection only: time split evenly across laps missed between polls. */
  Estimated?: boolean;
}

export interface FeedDriverLaps {
  Number: string;
  /** Name with markers appended, e.g. "Austin Hill(i)" or "Brent Crews # (C)". */
  FullName: string;
  Laps: FeedLap[];
}

/** 1 green, 2 yellow, 4 white, 8 pre-race (observed values). */
export interface FeedFlag {
  LapsCompleted: number;
  FlagState: number;
}

export interface FeedLapTimes {
  laps: FeedDriverLaps[];
  flags: FeedFlag[];
}

export interface FeedPitStop {
  vehicle_number: string;
  /** The car's OWN lap it pitted on (lapped cars differ from leader_lap); next lap is the out lap. */
  lap_count: number;
  leader_lap?: number;
  pit_stop_type: string;
  driver_name?: string;
  /** Seconds in the box, entry-to-exit seconds; -1 when unknown. */
  pit_stop_duration?: number;
  total_duration?: number;
  pit_in_race_time?: number;
  positions_gained_lost?: number;
  left_front_tire_changed: boolean;
  left_rear_tire_changed: boolean;
  right_front_tire_changed: boolean;
  right_rear_tire_changed: boolean;
}

export interface FeedRace {
  race_id: number;
  series_id: number;
  race_name: string;
  track_name: string;
  track_id?: number;
  race_date: string;
  race_season: number;
  scheduled_laps: number;
  actual_laps: number | null;
  /** Stage LENGTHS, not end laps; stage_4 is null when unused. */
  stage_1_laps?: number | null;
  stage_2_laps?: number | null;
  stage_3_laps?: number | null;
  stage_4_laps?: number | null;
}

export const FLAG_GREEN = 1;

/**
 * Feed flag codes. 1/2/4/8 are observed in 2026 replay files; 3 (red) and 9 (checkered) follow
 * the same numbering used by NASCAR's live feed but haven't been seen in replays yet.
 */
const FLAGS: Record<number, TrackFlag> = { 1: 'green', 2: 'yellow', 3: 'red', 4: 'white', 9: 'checkered', 8: 'none' };
export const flagFromFeed = (code: number | undefined): TrackFlag => (code === undefined ? 'none' : (FLAGS[code] ?? 'none'));

/**
 * Schedule times ("2026-10-11T15:00:00") are US Eastern wall-clock times with no offset.
 * Converts one to epoch ms, honoring daylight saving.
 */
export function easternToEpoch(s: string): number {
  const asUtc = Date.parse(`${s}Z`);
  // Offset of New York at that instant: format the UTC guess in ET and compare.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(asUtc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc + (asUtc - shown);
}
