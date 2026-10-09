import {
  gapPercent,
  lapRange,
  lapTime,
  raceProgress,
  raceProgressLabel,
  raceStatusLines,
  type RaceProgress,
  type StatusLine,
} from '../format/format';
import { flagSegments, type FlagSegment } from '../data/flags';
import { tvNetwork, type TvNetwork } from '../data/nascar/networks';
import { compareCarNumbers, rankBy } from '../data/rank';
import type { DataSource, PaceDataset, PaceEntry, TrackFlag } from '../data/types';
import { markerHighlight, markerNotes, markerSuffixes } from '../series/markers';
import type { SeriesProfile } from '../series/types';

const EN_DASH = '\u2013';

export interface CardHeader {
  title: string;
  /** Just the race, e.g. "South Point 400". */
  raceName: string;
  /** "Las Vegas, NV" when known. */
  location?: string;
  /** Track logo URL when known (no event-specific race logos are published). */
  logoUrl?: string;
  /** TV network, shown above the Live badge. */
  tv?: TvNetwork;
  venue: string;
  raceLine: string;
  definition: string;
}

export interface PaceRow {
  /** Null for cars left out of the ranking; they follow the ranked rows. */
  rank: number | null;
  carNumber: string;
  /** Team's stylized number image (API-relative URL); absent for fictional sample data. */
  carBadge?: string;
  firstName: string;
  lastName: string;
  markers: string[];
  /** Row tint for highlight-style markers (Chase drivers). */
  highlight: boolean;
  score: string;
  gapPercent: string;
  isLeader: boolean;
  /** Why the car isn't ranked, e.g. "too few green-flag laps". */
  excluded?: string;
}

export interface CardFooter {
  notes: string[];
  /** Live: "Stage 2: 31 laps to go · Lap 134/267". Finished: "Laps 1–200". */
  lapStamp: string;
  attribution: string;
}

export interface PaceRankingsCard {
  template: 'pace-rankings';
  format: 'portrait';
  seriesId: string;
  accent: { light: string; dark: string };
  stripes: string[];
  header: CardHeader;
  columns: { pos: string; car: string; name: string; score: string; gap: string };
  rows: PaceRow[];
  footer: CardFooter;
  /** Structured race position for API clients; null for a finished race. */
  progress: RaceProgress | null;
  /** TV-style status block lines (see raceStatusLines); empty for a finished race. */
  statusLines: StatusLine[];
  flag: StatusFlag;
  /** Completed laps as flag runs, for the lap progress bar. */
  flagSegments: FlagSegment[];
  /** Laps where each stage but the last ends (bar notches). */
  stageEnds: number[];
  source: DataSource;
}

/**
 * The status block's flag: track status, except on the lap a stage ends, which shows the
 * stage-end flag NASCAR waves: green/white checkered, or yellow/white checkered when the
 * stage ended under caution (judged by the flag on the stage's last lap, since the
 * stage-break caution comes out right after).
 */
export type StatusFlag = TrackFlag | 'stage-green' | 'stage-yellow';

export function statusFlag(progress: RaceProgress | null, flag: TrackFlag | undefined, lapFlags: TrackFlag[] | undefined): StatusFlag {
  // The feed can keep reporting the white flag after the finish, so the last lap means checkered.
  if (progress && progress.lap >= progress.totalLaps) return 'checkered';
  const stageEnded = progress && progress.stage !== null && progress.stageLapsRemaining === 0 && progress.lap < progress.totalLaps;
  if (!stageEnded) return flag ?? 'none';
  return lapFlags?.[progress.lap - 1] === 'yellow' ? 'stage-yellow' : 'stage-green';
}

/** "Garrity excluded: damage" for one driver; "Excluded (reason): A, B" when a reason repeats. */
function exclusionNotes(data: PaceDataset): string[] {
  const byReason = Map.groupBy(
    data.entries.filter((e) => e.excluded),
    (e) => e.excluded!,
  );
  return [...byReason].map(([reason, es]) =>
    es.length === 1 ? `${es[0]!.lastName} excluded: ${reason}` : `Excluded (${reason}): ${es.map((e) => e.lastName).join(', ')}`,
  );
}

/**
 * Turns raw pace data into a fully formatted card. Every display string is produced
 * here, so the web UI, exported PNGs and API clients all show identical numbers.
 */
export function buildPaceRankings(
  data: PaceDataset,
  profile: SeriesProfile,
  handle: string,
  { limit = Infinity }: { limit?: number } = {},
): PaceRankingsCard {
  const included = data.entries.filter((e) => !e.excluded);
  const ranked = rankBy(included, (e) => e.paceScore).slice(0, limit);
  // The full field also lists unranked cars, by car number, so nobody silently disappears.
  const unranked = Number.isFinite(limit)
    ? []
    : data.entries.filter((e) => e.excluded).sort((a, b) => compareCarNumbers(a.carNumber, b.carNumber));
  const best = ranked[0]?.item.paceScore ?? 0;

  const base = (item: PaceEntry) => ({
    carNumber: item.carNumber,
    carBadge: data.source === 'sample' ? undefined : `/api/v1/series/${profile.id}/car-badges/${item.carNumber}.png`,
    firstName: item.firstName,
    lastName: item.lastName,
    markers: markerSuffixes(item.markerTokens, profile),
    highlight: markerHighlight(item.markerTokens, profile),
  });
  const rows: PaceRow[] = [
    ...ranked.map(({ rank, item }) => ({
      ...base(item),
      rank,
      score: lapTime(item.paceScore),
      gapPercent: gapPercent(((item.paceScore - best) / best) * 100),
      isLeader: rank === 1,
    })),
    ...unranked.map((item) => ({
      ...base(item),
      rank: null,
      score: EN_DASH,
      gapPercent: EN_DASH,
      isLeader: false,
      excluded: item.excluded,
    })),
  ];

  // Explain each marker that actually appears, in profile order, then any exclusions.
  const shownTokens = new Set([...ranked.map((r) => r.item), ...unranked].flatMap((e) => e.markerTokens));
  const notes = [
    data.metricDefinition,
    ...markerNotes(shownTokens, profile),
    ...exclusionNotes(data),
    ...(data.methodNotes ?? []),
  ];

  // Practice and qualifying have no race length: show the session and its lap count instead.
  const progress =
    data.live && !data.session && data.race.totalLaps > 0 ? raceProgress(data.lapTo, data.race.totalLaps, data.race.stageLaps) : null;
  const sessionLines = data.session ? [{ label: data.session, value: `${data.lapTo} ${data.lapTo === 1 ? 'lap' : 'laps'}` }] : [];

  return {
    template: 'pace-rankings',
    format: 'portrait',
    seriesId: profile.id,
    accent: profile.accent,
    stripes: profile.brand.stripes,
    header: {
      title: Number.isFinite(limit) ? `Top ${limit} Pace Rankings` : 'Pace Rankings',
      raceName: data.race.raceName,
      location: data.race.location,
      logoUrl: data.race.logoUrl,
      tv: tvNetwork(data.race.tv),
      venue: data.race.venue,
      raceLine: `${data.race.raceName} · ${profile.displayName} · ${data.race.year}`,
      definition: 'Fastest drivers, adjusted for tire age',
    },
    columns: {
      pos: 'Pos',
      car: 'Car',
      name: profile.competitorUnit === 'car' ? 'Car / Drivers' : 'Driver',
      score: 'Pace score',
      gap: 'Gap to best',
    },
    rows,
    footer: {
      notes,
      lapStamp: progress
        ? raceProgressLabel(progress, profile.segmentName)
        : data.session
          ? `${data.session} · ${data.lapTo} laps`
          : lapRange(data.lapFrom, data.lapTo),
      attribution: `Generated by ${handle}`,
    },
    progress,
    statusLines: progress ? raceStatusLines(progress, profile.segmentName) : sessionLines,
    flag: statusFlag(progress, data.flag, data.lapFlags),
    flagSegments: flagSegments(data.lapFlags ?? []),
    stageEnds: data.race.stageLaps.slice(0, -1).map((_, i, a) => a.slice(0, i + 1).reduce((x, y) => x + y, 0)),
    source: data.source,
  };
}
