import { describe, expect, it } from 'vitest';
import { markerHighlight, markerNotes, markerSuffixes } from './markers';
import { cup } from './profiles';

describe('driver markers', () => {
  it('prints suffix markers but turns Chase into a row highlight', () => {
    expect(markerSuffixes(['#', '(C)'], cup)).toEqual(['(R)']);
    expect(markerHighlight(['#', '(C)'], cup)).toBe(true);
    expect(markerHighlight(['(i)'], cup)).toBe(false);
    expect(markerNotes(new Set(['#', '(C)']), cup)).toEqual(['(R) Rookie', 'Highlighted rows: Drivers in the Chase']);
  });
});
