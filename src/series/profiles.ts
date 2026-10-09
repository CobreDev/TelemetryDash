import type { DriverMarker, SeriesProfile, TemplateId } from './types';
import { TEMPLATE_IDS } from './types';

// NASCAR's feed marks rookies with "#" and points-ineligible drivers with "(i)".
const pointsIneligible: DriverMarker = {
  feedToken: '(i)',
  label: '(i)',
  meaning: 'Ineligible for points in this series',
};
const rookie: DriverMarker = { feedToken: '#', label: '(R)', meaning: 'Rookie' };
// The feed's "(C)" name text over-marks, so the server rewrites it from is_in_chase
// (see withChaseMarkers) before anything reads it.
// Shown as a light yellow row tint rather than a suffix.
const chase: DriverMarker = { feedToken: '(C)', label: '(C)', meaning: 'Drivers in the Chase', display: 'highlight' };

// Bar colors are the sampled logo colors darkened just enough for 4.5:1 top-bar text.
// Stripes reuse the exact same value so the band and the bar read as one color.
const OREILLY_GREEN = '#007A38';
const CRAFTSMAN_RED = '#B81E24';

const ALL_NASCAR_TEMPLATES: TemplateId[] = [...TEMPLATE_IDS];

export const cup: SeriesProfile = {
  id: 'cup',
  body: 'nascar',
  displayName: 'Cup Series',
  status: 'primary',
  accent: { light: '#8F6B00', dark: '#FFD100' },
  brand: {
    stripes: ['#FFD100', '#E4002B', '#0072CE'],
    dashboard: { barBg: '#000000', barFg: '#FFFFFF', barMuted: '#B5B5B5', highlight: '#FFD100' },
  },
  competitorUnit: 'driver',
  classes: [],
  markers: [rookie, pointsIneligible, chase],
  stopTypes: ['four-tire', 'two-tire', 'fuel-only'],
  segmentName: 'Stage',
  fuelUnit: 'GAL',
  enabledTemplates: ALL_NASCAR_TEMPLATES,
};

// Same as Cup; Cup drivers moonlighting here carry the (i) marker.
export const oreilly: SeriesProfile = {
  ...cup,
  id: 'oreilly',
  displayName: "O'Reilly Auto Parts Series",
  status: 'launch',
  accent: { light: '#00843D', dark: OREILLY_GREEN },
  brand: {
    stripes: [OREILLY_GREEN, '#E31837', OREILLY_GREEN],
    dashboard: { barBg: OREILLY_GREEN, barFg: '#FFFFFF', barMuted: '#E3F4EA', highlight: '#FFFFFF' },
  },
};

// Same as Cup; shorter races and fewer stops need no profile change.
export const craftsman: SeriesProfile = {
  ...cup,
  id: 'craftsman',
  displayName: 'Craftsman Truck Series',
  status: 'launch',
  accent: { light: '#D2232A', dark: CRAFTSMAN_RED },
  brand: {
    stripes: [CRAFTSMAN_RED, '#000000', CRAFTSMAN_RED],
    dashboard: { barBg: CRAFTSMAN_RED, barFg: '#FFFFFF', barMuted: '#FBE3E4', highlight: '#FFFFFF' },
  },
};

export const profiles = { cup, oreilly, craftsman } satisfies Record<string, SeriesProfile>;
export type SeriesId = keyof typeof profiles;
export const seriesList: SeriesProfile[] = Object.values(profiles);

export function isTemplateEnabled(profile: SeriesProfile, template: TemplateId) {
  return profile.enabledTemplates.includes(template);
}
