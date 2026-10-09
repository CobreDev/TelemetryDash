// Splits a feed name like "Shane Van Gisbergen" or "Brennan Poole(i) (C)" into display parts.
// The replay files only carry full names, so first/last are inferred.

const MARKER = /\([^)]*\)|[#*]/g;
const SUFFIX = /^(Jr\.?|Sr\.?|II|III|IV)$/;
const PARTICLES = new Set(['van', 'von', 'de', 'da', 'del', 'la', 'le', 'di']);

/** Names the rules split wrong. Key is the name without markers. */
const OVERRIDES: Record<string, [first: string, last: string]> = {
  'Andres Perez De Lara': ['Andres', 'Perez De Lara'],
};

export function parseDriverName(full: string): { firstName: string; lastName: string; markerTokens: string[] } {
  const markerTokens = full.match(MARKER) ?? [];
  const name = full.replace(MARKER, ' ').replace(/\s+/g, ' ').trim();
  const override = OVERRIDES[name];
  if (override) return { firstName: override[0], lastName: override[1], markerTokens };

  const words = name.split(' ');
  let i = words.length - 1;
  if (i > 0 && SUFFIX.test(words[i]!)) i--; // keep "Jr." with the surname
  while (i > 1 && PARTICLES.has(words[i - 1]!.toLowerCase())) i--; // "Van Gisbergen"
  return { firstName: words.slice(0, i).join(' '), lastName: words.slice(i).join(' '), markerTokens };
}
