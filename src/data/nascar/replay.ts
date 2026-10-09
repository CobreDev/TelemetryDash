import { lapTime } from '../../format/format';
import type { PaceDataset } from '../types';
import { flagFromFeed, type FeedLapTimes, type FeedPitStop, type FeedRace } from './feed';
import { parseDriverName } from './names';
import { trackLocation, type FeedTrack } from './tracks';
import { computePace } from './pace';

export const halfwayLap = (race: FeedRace) => Math.ceil((race.actual_laps ?? race.scheduled_laps) / 2);

/** A completed race replayed as if it were live at `upToLap`. */
export function replayPaceDataset(
  seriesId: string,
  race: FeedRace,
  lapTimes: FeedLapTimes,
  pits: FeedPitStop[],
  upToLap: number,
  track?: FeedTrack,
  {
    source = 'replay',
    session,
    currentFlag,
  }: { source?: 'replay' | 'live'; session?: string; /** Live: the flag right now. */ currentFlag?: number } = {},
): PaceDataset {
  const { results, falloffPerLap } = computePace(lapTimes, pits, upToLap);
  return {
    race: {
      seriesId,
      raceName: race.race_name,
      venue: race.track_name,
      location: track ? trackLocation(track) : undefined,
      logoUrl: track?.track_logo ?? undefined,
      year: race.race_season,
      totalLaps: race.actual_laps ?? race.scheduled_laps,
      stageLaps: [race.stage_1_laps, race.stage_2_laps, race.stage_3_laps, race.stage_4_laps].filter(
        (n): n is number => !!n && n > 0,
      ),
    },
    lapFrom: 1,
    lapTo: upToLap,
    live: true,
    flag: flagFromFeed(currentFlag ?? lapTimes.flags.find((f) => f.LapsCompleted === upToLap)?.FlagState),
    lapFlags: Array.from({ length: upToLap }, (_, i) =>
      flagFromFeed(lapTimes.flags.find((f) => f.LapsCompleted === i + 1)?.FlagState),
    ),
    metricDefinition: 'Pace score: avg green-flag lap, adjusted to fresh tires',
    methodNotes: [`Tire falloff: ${lapTime(falloffPerLap).replace('s', '')}s per lap of tire age (fit across the field)`],
    entries: results.map((r) => ({
      carNumber: r.carNumber,
      ...parseDriverName(r.fullName),
      paceScore: r.paceScore ?? 0,
      excluded: r.excluded,
    })),
    source,
    session,
  };
}
