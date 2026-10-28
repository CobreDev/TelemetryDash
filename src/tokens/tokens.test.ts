import { describe, expect, it } from 'vitest';
import { seriesList } from '../series/profiles';
import { contrast } from './contrast';
import { neutrals, onColor, signals } from './tokens';

describe('accessibility', () => {
  for (const theme of ['light', 'dark'] as const) {
    const n = neutrals[theme];
    const grounds = [n.bg, n['surface-1'], n['surface-2']];
    it(`${theme}: every text token meets 4.5:1 on every surface`, () => {
      for (const bg of grounds) for (const t of [n['text-primary'], n['text-secondary'], n['text-muted']]) expect(contrast(t, bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${theme}: good and danger text meet 4.5:1 on the page and controls`, () => {
      for (const bg of [n.bg, n['surface-1']]) for (const c of [signals[theme].good, signals[theme].danger]) expect(contrast(c, bg)).toBeGreaterThanOrEqual(4.5);
    });
    for (const s of seriesList) {
      // The dark series color matches the header exactly; on the page it only fills chips that
      // carry their own text color, so it's exempt from 3:1 against the page.
      if (theme === 'light')
        it(`${theme}: ${s.id} series color meets 3:1 on every surface`, () => {
          for (const bg of grounds) expect(contrast(s.accent[theme], bg)).toBeGreaterThanOrEqual(3);
        });
      it(`${theme}: ${s.id} text on the series color meets 4.5:1`, () => {
        expect(contrast(onColor(s.accent[theme]), s.accent[theme])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('series colors are distinct from each other', () => {
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
