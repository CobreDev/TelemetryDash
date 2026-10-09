import type { SeriesProfile } from './types';

// How feed name markers render: suffixes after the name, or a row highlight.

export function markerSuffixes(tokens: string[], profile: SeriesProfile): string[] {
  return tokens.flatMap((t) => {
    const m = profile.markers.find((x) => x.feedToken === t);
    return m && m.display !== 'highlight' ? [m.label] : [];
  });
}

export function markerHighlight(tokens: string[], profile: SeriesProfile): boolean {
  return profile.markers.some((m) => m.display === 'highlight' && tokens.includes(m.feedToken));
}

/** Footer lines for the markers that actually appear, in profile order. */
export function markerNotes(seen: Set<string>, profile: SeriesProfile): string[] {
  return profile.markers
    .filter((m) => seen.has(m.feedToken))
    .map((m) => (m.display === 'highlight' ? `Highlighted rows: ${m.meaning}` : `${m.label} ${m.meaning}`));
}
