// A series profile is the ONLY place series differences live (DESIGN.md, "Series theming system").
// Templates read these fields; they never branch on series id.

import type { BodyId } from './bodies';

export const TEMPLATE_IDS = [
  'pace-rankings',
  'pit-stops',
  'four-tire-averages',
  'strategy-report',
  'lap-time-comparison',
  'stage-pace-rankings',
  'lap-time-distribution',
  'fuel-save',
  'pit-crew-summary',
  'pit-lane-time',
  'spots-gained',
  'predicted-pace',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type StopType = 'four-tire' | 'two-tire' | 'fuel-only' | 'driver-change' | 'fuel-and-tires';

export interface DriverMarker {
  /** Token as it appears in the timing feed's name string, e.g. "(i)" or "#". */
  feedToken: string;
  /** Suffix shown after the name on cards. */
  label: string;
  /** One-line footer explanation, shown the first time the marker appears on a card. */
  meaning: string;
  /** 'suffix' (default) prints the label after the name; 'highlight' tints the row instead. */
  display?: 'suffix' | 'highlight';
}

export interface RaceClass {
  id: string;
  name: string;
  color: string;
}

/**
 * Series look. Colors are approximations sampled from the series logos (no official values
 * are published). No logos. Cards use only `stripes`; the dashboard top bar uses all of it.
 * The top bar font (Saira) is shared by every series so the header doesn't shift on switch.
 */
export interface SeriesBrand {
  /**
   * Full-width bands under the card header and the dashboard top bar, top to bottom.
   * Every series has three so the band is the same height when switching series.
   */
  stripes: string[];
  dashboard: {
    barBg: string;
    barFg: string;
    barMuted: string;
    /** Active series and active tab underline. */
    highlight: string;
  };
}

export interface SeriesProfile {
  id: string;
  /** Sanctioning body, for the top-right switcher (see bodies.ts). */
  body: BodyId;
  displayName: string;
  status: 'primary' | 'launch' | 'bonus' | 'later';
  /**
   * The series color: venue line, rank-1 highlight and buttons. One value per theme,
   * because a color that reads on the dark dashboard (Cup yellow) can vanish on a light card.
   * `dark` matches the dashboard header exactly (bar color, or Cup's yellow highlight).
   */
  accent: { light: string; dark: string };
  brand: SeriesBrand;
  competitorUnit: 'driver' | 'car';
  /** Empty for single-class series. */
  classes: RaceClass[];
  markers: DriverMarker[];
  stopTypes: StopType[];
  /** What a race segment is called, or null when the series has none. */
  segmentName: string | null;
  fuelUnit: 'GAL' | 'L';
  enabledTemplates: TemplateId[];
}
