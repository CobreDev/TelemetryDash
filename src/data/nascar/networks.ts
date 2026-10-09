// TV network logos for the header and schedule. The schedule only gives a name ("FS1",
// "PRIME VIDEO"), so names map to public-domain logo files on Wikimedia Commons, loaded by
// the browser like the track logos. Unknown names fall back to text.

const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons';

const LOGOS: Record<string, string> = {
  FOX: `${COMMONS}/c/c0/Fox_Broadcasting_Company_logo_%282019%29.svg`,
  FS1: `${COMMONS}/3/37/2015_Fox_Sports_1_logo.svg`,
  FS2: `${COMMONS}/3/38/FS2_logo_2015.svg`,
  USA: `${COMMONS}/d/d7/USA_Network_logo_%282016%29.svg`,
  NBC: `${COMMONS}/0/0b/NBC_logo_2022.svg`,
  CW: `${COMMONS}/b/b1/The_CW_2024.svg`,
  TNT: `${COMMONS}/c/ca/TNT_Sports_2024_vector_logo.svg`,
  'PRIME VIDEO': `${COMMONS}/9/90/Prime_Video_logo_%282024%29.svg`,
};
const ALIASES: Record<string, string> = { 'THE CW': 'CW', 'TNT SPORTS': 'TNT', PRIME: 'PRIME VIDEO', 'FOX SPORTS 1': 'FS1', 'USA NETWORK': 'USA' };

export interface TvNetwork {
  /** As the schedule lists it, e.g. "FS1". */
  name: string;
  logoUrl?: string;
}

export function tvNetwork(name: string | null | undefined): TvNetwork | undefined {
  const clean = name?.trim();
  if (!clean) return undefined;
  const key = clean.toUpperCase();
  return { name: clean, logoUrl: LOGOS[ALIASES[key] ?? key] };
}
