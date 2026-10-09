import type { TrackFlag } from './types';

/** A run of consecutive laps under the same flag, inclusive. */
export interface FlagSegment {
  fromLap: number;
  toLap: number;
  flag: TrackFlag;
}

/** Collapses a per-lap flag list (index 0 = lap 1) into runs, for the lap progress bar. */
export function flagSegments(lapFlags: TrackFlag[]): FlagSegment[] {
  const out: FlagSegment[] = [];
  lapFlags.forEach((flag, i) => {
    const lap = i + 1;
    const last = out.at(-1);
    if (last && last.flag === flag && last.toLap === lap - 1) last.toLap = lap;
    else out.push({ fromLap: lap, toLap: lap, flag });
  });
  return out;
}
