import type { FlagSegment } from '../data/flags';

/**
 * Race progress across all laps: completed laps colored by the flag they ran under,
 * remaining laps dim, with notches at stage ends.
 */
export function LapBar({ segments, totalLaps, stageEnds }: { segments: FlagSegment[]; totalLaps: number; stageEnds: number[] }) {
  if (totalLaps <= 0) return null;
  const pct = (lap: number) => `${(lap / totalLaps) * 100}%`;
  const done = segments.at(-1)?.toLap ?? 0;
  return (
    <div
      className="lap-bar"
      role="progressbar"
      aria-label="Race laps"
      aria-valuemin={0}
      aria-valuemax={totalLaps}
      aria-valuenow={done}
    >
      {segments.map((s) => (
        <span
          key={s.fromLap}
          className={`lap-bar-seg flag-${s.flag}`}
          style={{ left: pct(s.fromLap - 1), width: pct(s.toLap - s.fromLap + 1) }}
          title={s.fromLap === s.toLap ? `Lap ${s.fromLap}: ${s.flag}` : `Laps ${s.fromLap}–${s.toLap}: ${s.flag}`}
        />
      ))}
      {stageEnds.map((lap) => (
        <span key={lap} className="lap-bar-notch" style={{ left: pct(lap) }} title={`Stage end, lap ${lap}`} />
      ))}
    </div>
  );
}
