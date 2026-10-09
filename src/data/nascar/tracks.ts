// NASCAR's track list (cf.nascar.com/cacher/tracks.json): location and logo per track_id.

export interface FeedTrack {
  track_id: number;
  track_name: string;
  city: string | null;
  state: string | null;
  /** Hosted on www.nascar.com, which blocks server-side fetches; browsers load it fine. */
  track_logo: string | null;
}

const STATES: Record<string, string> = {
  alabama: 'AL', arizona: 'AZ', california: 'CA', delaware: 'DE', florida: 'FL', georgia: 'GA',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', michigan: 'MI',
  missouri: 'MO', nevada: 'NV', 'new hampshire': 'NH', 'new york': 'NY', 'north carolina': 'NC',
  ohio: 'OH', oregon: 'OR', pennsylvania: 'PA', 'south carolina': 'SC', tennessee: 'TN',
  texas: 'TX', virginia: 'VA', washington: 'WA', wisconsin: 'WI',
};

/** "Las Vegas, NV". The feed mixes codes and full names ("North Carolina"); normalize to codes. */
export function trackLocation(t: Pick<FeedTrack, 'city' | 'state'>): string | undefined {
  const city = t.city?.trim();
  const raw = t.state?.trim();
  if (!city) return undefined;
  if (!raw) return city;
  const state = raw.length === 2 ? raw.toUpperCase() : (STATES[raw.toLowerCase()] ?? raw);
  return `${city}, ${state}`;
}
