// Design tokens: the Hairline design system's neutrals and signals, plus this product's own
// identity colors (series branding comes from the series profiles). See docs/DESIGN.md.
import { contrast } from './contrast';

export type ThemeName = 'light' | 'dark';

/** Hairline: warm paper and ink. The interface itself uses only these. */
export const neutrals = {
  light: {
    bg: '#f6f5f1',
    'surface-1': '#ffffff',
    'surface-2': '#efeee9',
    border: '#dcdad2',
    grid: '#e9e7e0',
    'text-primary': '#161614',
    'text-secondary': '#55534d',
    'text-muted': '#6d6b64',
  },
  dark: {
    bg: '#0f0f0e',
    'surface-1': '#181817',
    'surface-2': '#222220',
    border: '#2f2e2b',
    grid: '#262624',
    'text-primary': '#ecebe6',
    'text-secondary': '#bdbbb2',
    'text-muted': '#8f8d85',
  },
} as const;

/** Hairline signals: best values, errors, focus, and status bars (always with a word). */
export const signals = {
  light: { good: '#17773a', danger: '#b8322a', focus: '#2a78d6', 'status-good': '#1b9a3e', 'status-warn': '#b89400', 'status-crit': '#c0302f' },
  dark: { good: '#4cbf6b', danger: '#e66767', focus: '#5598e7', 'status-good': '#2fa24a', 'status-warn': '#a8920a', 'status-crit': '#b3261e' },
} as const;

export const shadowFloat = { light: '0 4px 16px rgba(0, 0, 0, 0.10)', dark: '0 4px 16px rgba(0, 0, 0, 0.45)' } as const;

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

/** Hairline uses one family, the platform's UI face, so pages look native and load nothing. */
export const fonts = {
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;

export const formats = {
  portrait: { width: 1080, height: 1350 },
  landscape: { width: 1600, height: 900 },
  square: { width: 1080, height: 1080 },
  tall: { width: 1080, height: 1920, bottomSafe: 80 },
} as const;

/** Black or white, whichever reads better on `bg` (Cup yellow needs black, the others white). */
export function onColor(bg: string): string {
  return contrast('#000000', bg) >= contrast('#FFFFFF', bg) ? '#000000' : '#FFFFFF';
}

/**
 * CSS custom properties for a theme, the series color (`--series`, this product's identity
 * color for the series) and its text color. Hairline's `--accent` is ink, not a brand hue.
 */
export function themeVars(theme: ThemeName, series: string): Record<string, string> {
  const vars: Record<string, string> = {
    '--series': series,
    '--on-series': onColor(series),
    '--accent': neutrals[theme]['text-primary'],
    '--shadow-float': shadowFloat[theme],
    // A thin halo around team number art: white artwork needs a dark edge on paper, dark artwork a light one at night.
    '--badge-halo': theme === 'light' ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.7)',
    '--font-sans': fonts.sans,
    '--font-mono': fonts.mono,
  };
  for (const [k, v] of Object.entries({ ...neutrals[theme], ...signals[theme] })) vars[`--${k}`] = v;
  lineSeries[theme].forEach((c, i) => (vars[`--line-${i}`] = c));
  return vars;
}
