// Shared design tokens from docs/DESIGN.md. These never change per series;
// the only per-series colors (accent, brand) come from the series profile.
import { contrast } from './contrast';

export type ThemeName = 'light' | 'dark';

export const neutrals = {
  light: {
    bg: '#F4F5F7',
    surface: '#FFFFFF',
    'surface-alt': '#E9EBEF',
    border: '#D5D9E0',
    text: '#12151B',
    'text-muted': '#5B6270',
  },
  dark: {
    bg: '#0F1115',
    surface: '#181B21',
    'surface-alt': '#20242C',
    border: '#2C313A',
    text: '#EEF0F3',
    'text-muted': '#9AA1AE',
  },
} as const;

/** Good/middle/bad judgments only, never decoration. */
export const perf = {
  light: { 'perf-good': '#1E9E5A', 'perf-mid': '#D98A00', 'perf-bad': '#D33A3A' },
  dark: { 'perf-good': '#3DD68C', 'perf-mid': '#F2B33D', 'perf-bad': '#F2645E' },
} as const;

/**
 * Stint bars only. Two-tire orange is deepened from DESIGN.md's #F29B1F so the hued set
 * passes the dataviz validator on the dark dashboard surface (lightness band 0.48-0.67).
 */
export const strategy = {
  start: '#4A5160',
  fourTire: '#2F7FE0',
  twoTire: '#D07A1A',
  fuelOnly: '#8A5CF0',
} as const;

/**
 * Line-chart series, assigned in slot order and kept per entity (never repainted when the
 * selection changes). Six is the maximum per chart. The dark set reorders and deepens the
 * amber so adjacent pairs stay apart for colorblind readers; validated with
 * dataviz/validate_palette.js against #181B21.
 */
export const lineSeries = {
  light: ['#2F7FE0', '#E5484D', '#F2B33D', '#30A46C', '#8E4EC6', '#12A5B8'],
  dark: ['#2F7FE0', '#E5484D', '#12A5B8', '#C48420', '#8E4EC6', '#30A46C'],
} as const;
export const MAX_LINES = lineSeries.dark.length;

export const fonts = {
  display: "'Barlow Condensed', 'Arial Narrow', sans-serif",
  /** Body text: Stainless Regular when its licensed file is installed, else Inter. */
  sans: "'Stainless', 'Inter', system-ui, sans-serif",
  /** Headers: Stainless Black when installed, else Saira. */
  heading: "'Stainless', 'Saira', 'Barlow Condensed', sans-serif",
  /** NASCAR logo face for the body switcher, when installed. */
  logo: "'NASCAR Logo', 'Saira', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** Card type scale in px at 1080 px wide. */
export const cardType = {
  title: 68,
  venue: 28,
  subtitle: 18,
  lastName: 30,
  firstName: 14,
  carNumber: 34,
  numeric: 28,
  columnLabel: 14,
  footer: 13,
} as const;

/** Dashboard uses 60% of card sizes, never below 14 px. */
export const dashboardSize = (cardPx: number) => Math.max(14, Math.round(cardPx * 0.6));

export const space = (n: number) => n * 8;
export const CARD_MARGIN = 56;
export const ACCENT_RULE = 4;

export const formats = {
  portrait: { width: 1080, height: 1350 },
  landscape: { width: 1600, height: 900 },
  square: { width: 1080, height: 1080 },
  tall: { width: 1080, height: 1920, bottomSafe: 80 },
} as const;
export type CardFormat = keyof typeof formats;
export const EXPORT_PIXEL_RATIO = 2;

/** Black or white, whichever reads better on `bg` (Cup yellow needs black, the others white). */
export function onColor(bg: string): string {
  return contrast('#000000', bg) >= contrast('#FFFFFF', bg) ? '#000000' : '#FFFFFF';
}

/** CSS custom properties for a theme plus the series accent. Token names match DESIGN.md. */
export function themeVars(theme: ThemeName, accent: string): Record<string, string> {
  const vars: Record<string, string> = { '--accent': accent, '--on-accent': onColor(accent) };
  for (const [k, v] of Object.entries({ ...neutrals[theme], ...perf[theme] })) vars[`--${k}`] = v;
  vars['--font-display'] = fonts.display;
  vars['--font-sans'] = fonts.sans;
  vars['--font-heading'] = fonts.heading;
  vars['--font-logo'] = fonts.logo;
  vars['--font-mono'] = fonts.mono;
  return vars;
}
