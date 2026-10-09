// Source-agnostic race data. Whatever feed we pick later gets adapted into these shapes.

export type DataSource = 'sample' | 'replay' | 'live';

/** Track status at the latest lap, for the status block's flag line. */
export type TrackFlag = 'green' | 'yellow' | 'red' | 'white' | 'checkered' | 'none';

export interface RaceInfo {
  seriesId: string;
  raceName: string;
  venue: string;
  /** "Las Vegas, NV" */
  location?: string;
  /** Track logo image URL (absolute; loaded by the browser). */
  logoUrl?: string;
  /** TV network, e.g. "FOX" or "Prime". */
  tv?: string;
  year: number;
  totalLaps: number;
  /** Stage lengths in laps, in order (empty when the series has no stages). */
  stageLaps: number[];
}

export interface Competitor {
  carNumber: string;
  firstName: string;
  lastName: string;
  /** Feed marker tokens attached to this entry, e.g. ["#"] or ["(i)"]. */
  markerTokens: string[];
}

export interface PaceEntry extends Competitor {
  /** Seconds; lower is faster. */
  paceScore: number;
  /** Present when the entry is left out of the ranking. */
  excluded?: string;
}

export interface PaceDataset {
  race: RaceInfo;
  lapFrom: number;
  lapTo: number;
  /** True while the race is running; drives "so far" wording instead of a closed range. */
  live: boolean;
  metricDefinition: string;
  /** Flag condition at `lapTo` (live and replay). */
  flag?: TrackFlag;
  /** Flag each lap ran under, index 0 = lap 1, through `lapTo`. */
  lapFlags?: TrackFlag[];
  /** Extra footer lines about how the metric was computed for this dataset. */
  methodNotes?: string[];
  entries: PaceEntry[];
  /** 'sample' marks fabricated data; 'replay' is a completed race played back to `lapTo`. */
  source: DataSource;
  /** Live practice/qualifying: the session name. Absent for races. */
  session?: string;
}
