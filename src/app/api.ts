import type { ChaseView } from '../cards/chase.model';
import type { OverviewView } from '../cards/overview.model';
import type { PaceRankingsCard } from '../cards/paceRankings.model';
import type { FuelView, LapsView, PitRoadView, StrategyView, TopSpeedView } from '../cards/tabs.model';
import type { SeriesProfile } from '../series/types';

export type Source = 'live' | 'sample';

/** The API's "nothing live for this series" answer (HTTP 409). */
export interface NoLiveSession {
  error: 'no-live-session';
  live: LiveStatus | null;
  next?: { raceName: string; track: string; startsET: string };
}

export interface LiveStatus {
  seriesId: string;
  raceId: number;
  runName: string;
  isRace: boolean;
  lap: number;
  lapsInRace: number;
  flag: number;
  updatedAt: number;
  /** Server's last successful check of NASCAR's feed. */
  polledAt: number;
  active: boolean;
}

export interface UpcomingRace {
  raceName: string;
  venue: string;
  location?: string;
  logoUrl?: string;
  /** US Eastern wall-clock, e.g. "2026-10-11T15:00:00". */
  startsET: string;
  laps: number;
  miles: number | null;
  stageLaps: number[];
  tv: string | null;
  radio: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API ${status}`);
  }
}

async function get<T>(path: string, source?: Source): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`/api/v1${path}${source === 'sample' ? `${sep}source=sample` : ''}`);
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json() as Promise<T>;
}

type SeriesFetch<T> = (seriesId: string, source: Source) => Promise<T>;
const seriesGet =
  <T,>(path: string): SeriesFetch<T> =>
  (seriesId, source) =>
    get<T>(`/series/${seriesId}${path}`, source);

export const api = {
  series: () => get<SeriesProfile[]>('/series'),
  live: () => get<{ live: LiveStatus | null; now: number }>('/live'),
  upcoming: (seriesId: string) => get<UpcomingRace>(`/series/${seriesId}/upcoming`),
  paceRankings: seriesGet<PaceRankingsCard & { updatedAt: number | null }>('/cards/pace-rankings'),
  overview: seriesGet<OverviewView>('/overview'),
  chase: seriesGet<ChaseView>('/chase'),
  pitRoad: seriesGet<PitRoadView>('/pit-road'),
  strategy: seriesGet<StrategyView>('/strategy'),
  fuel: seriesGet<FuelView>('/fuel'),
  topSpeed: seriesGet<TopSpeedView>('/top-speed'),
  laps: seriesGet<LapsView>('/laps'),
};

export const isNoLive = (e: unknown): e is ApiError & { body: NoLiveSession } =>
  e instanceof ApiError && e.status === 409 && (e.body as NoLiveSession | null)?.error === 'no-live-session';
