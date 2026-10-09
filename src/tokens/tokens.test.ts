import { describe, expect, it } from 'vitest';
import { seriesList } from '../series/profiles';
import { contrast } from './contrast';
import { neutrals, onColor, perf } from './tokens';

describe('accessibility', () => {
  for (const theme of ['light', 'dark'] as const) {
    const n = neutrals[theme];
    it(`${theme}: body text meets 4.5:1`, () => {
      for (const bg of [n.bg, n.surface, n['surface-alt']]) {
        expect(contrast(n.text, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(n['text-muted'], bg)).toBeGreaterThanOrEqual(4.5);
      }
    });
    for (const [name, c] of Object.entries(perf[theme])) {
      // DESIGN.md's light perf-mid (#D98A00) is 2.77:1 on white, under its own 3:1 rule.
      // Kept as specified until the doc changes; this flips to a failure once it's fixed.
      const test = theme === 'light' && name === 'perf-mid' ? it.fails : it;
      test(`${theme}: ${name} meets 3:1 for large numbers`, () => {
        expect(contrast(c, n.surface)).toBeGreaterThanOrEqual(3);
      });
    }
    for (const s of seriesList) {
      // The dark accent deliberately matches the header color exactly, and on the dashboard it only
      // draws the rank-1 bar, which is redundant with the rank number, so it is exempt from 3:1.
      if (theme === 'light')
        it(`${theme}: ${s.id} accent meets 3:1 on bg, surface and zebra rows`, () => {
          for (const bg of [n.bg, n.surface, n['surface-alt']]) expect(contrast(s.accent[theme], bg)).toBeGreaterThanOrEqual(3);
        });
      it(`${theme}: ${s.id} text on accent meets 4.5:1`, () => {
        expect(contrast(onColor(s.accent[theme]), s.accent[theme])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('series accents are distinct from each other', () => {
    for (const theme of ['light', 'dark'] as const)
      expect(new Set(seriesList.map((s) => s.accent[theme].toUpperCase())).size).toBe(seriesList.length);
  });
});

describe('series dashboard bar', () => {
  for (const s of seriesList) {
    const d = s.brand.dashboard;
    it(`${s.id}: bar text meets 4.5:1`, () => {
      expect(contrast(d.barFg, d.barBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(d.barMuted, d.barBg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${s.id}: active underline is visible (3:1)`, () => {
      expect(contrast(d.highlight, d.barBg)).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('series stripes', () => {
  it('dark accent matches the header color exactly', () => {
    for (const s of seriesList) {
      const d = s.brand.dashboard;
      expect([d.barBg, d.highlight]).toContain(s.accent.dark);
    }
  });
  it('stripes in the bar hue use the exact bar color', () => {
    for (const s of seriesList) {
      const bar = s.brand.dashboard.barBg.toUpperCase();
      if (bar === '#000000') continue; // Cup's bar is black and has no black stripe.
      expect(s.brand.stripes.map((c) => c.toUpperCase())).toContain(bar);
    }
  });
  it('every series has the same number of stripes', () => {
    expect(new Set(seriesList.map((s) => s.brand.stripes.length)).size).toBe(1);
  });
});
