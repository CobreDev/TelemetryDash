// Number formats from DESIGN.md "Data display rules". Followers compare cards across
// weeks, so every card must go through these and never format numbers inline.

const MINUS = '−';
const EN_DASH = '–';
const MIDDOT = '·';

/** 31.340s; minutes only above 99.999 s: 1:58.219 */
export function lapTime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  if (ms <= 99_999) return `${(ms / 1000).toFixed(3)}s`;
  const min = Math.floor(ms / 60_000);
  const rest = ((ms % 60_000) / 1000).toFixed(3).padStart(6, '0');
  return `${min}:${rest}`;
}

/** 8.30s */
export function pitTime(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}

/** +0.212s */
export function gapTime(seconds: number): string {
  const v = Math.round(seconds * 1000) / 1000;
  return `${v < 0 ? MINUS : '+'}${Math.abs(v).toFixed(3)}s`;
}

/** 0.69% (leader shows 0.00%) */
export function gapPercent(pct: number): string {
  return `${Math.abs(pct).toFixed(2)}%`;
}

/** 80.8 GAL */
export function fuel(amount: number, unit: 'GAL' | 'L'): string {
  return `${amount.toFixed(1)} ${unit}`;
}

/** +10, −1, – */
export function positionChange(delta: number): string {
  if (delta === 0) return EN_DASH;
  return delta > 0 ? `+${delta}` : `${MINUS}${Math.abs(delta)}`;
}

/** Laps 221–240 */
export function lapRange(from: number, to: number): string {
  return `Laps ${from}${EN_DASH}${to}`;
}

export interface RaceProgress {
  lap: number;
  totalLaps: number;
  /** 1-based; null when the series has no segments. */
  stage: number | null;
  stageCount: number;
  /** Laps left in the current stage (0 at the end of a stage). */
  stageLapsRemaining: number | null;
  /** Laps completed within the current stage, and that stage's length. */
  stageLap: number | null;
  stageLength: number | null;
  lapsToGo: number;
}

/**
 * Where a live race stands after `lap` completed laps. `stageLaps` are stage LENGTHS, as the
 * feed lists them (Cup Las Vegas: 80, 85, 102); ignored unless they add up to the race length.
 */
export function raceProgress(lap: number, totalLaps: number, stageLaps: number[]): RaceProgress {
  const lapsToGo = Math.max(0, totalLaps - lap);
  const none = { stage: null, stageCount: 0, stageLapsRemaining: null, stageLap: null, stageLength: null };
  const valid = stageLaps.length > 1 && stageLaps.reduce((a, b) => a + b, 0) === totalLaps;
  if (!valid) return { lap, totalLaps, lapsToGo, ...none };
  let end = 0;
  for (const [i, len] of stageLaps.entries()) {
    end += len;
    if (lap <= end || i === stageLaps.length - 1) {
      return {
        lap,
        totalLaps,
        lapsToGo,
        stage: i + 1,
        stageCount: stageLaps.length,
        stageLapsRemaining: Math.max(0, end - lap),
        stageLap: Math.min(len, lap - (end - len)),
        stageLength: len,
      };
    }
  }
  return { lap, totalLaps, lapsToGo, ...none };
}

/** Stage 2: 31 laps to go · Lap 134/267 */
export function raceProgressLabel(p: RaceProgress, segmentName: string | null): string {
  const lap = `Lap ${p.lap}/${p.totalLaps}`;
  if (p.lap >= p.totalLaps) return `Final ${MIDDOT} ${lap}`;
  if (p.stage === null || p.stageLapsRemaining === null || !segmentName) return lap;
  const where =
    p.stageLapsRemaining === 0
      ? `End of ${segmentName} ${p.stage}`
      : `${segmentName} ${p.stage}: ${p.stageLapsRemaining} ${p.stageLapsRemaining === 1 ? 'lap' : 'laps'} to go`;
  return `${where} ${MIDDOT} ${lap}`;
}

/** Under this many laps left, the stage block collapses to just the countdown. */
export const COUNTDOWN_LAPS = 10;

export type StatusLine = { label: string; value: string };

/**
 * Lines for the TV-style race status block:
 *   Stage 2      54|85        (stage, lap in stage | stage length)
 *   133 To Go   134|267       (race laps to go, lap | total)
 * Under 10 laps left in a stage it collapses to "Stage 3   8 To Go".
 */
export function raceStatusLines(p: RaceProgress, segmentName: string | null): StatusLine[] {
  const race = { label: `${p.lapsToGo} To Go`, value: `${p.lap}|${p.totalLaps}` };
  if (p.lap >= p.totalLaps) return [{ label: 'Final', value: `${p.lap}|${p.totalLaps}` }];
  if (!segmentName || p.stage === null || p.stageLapsRemaining === null) return [race];
  const stage = `${segmentName} ${p.stage}`;
  if (p.stageLapsRemaining === 0) return [{ label: stage, value: 'Complete' }];
  if (p.stageLapsRemaining < COUNTDOWN_LAPS) return [{ label: stage, value: `${p.stageLapsRemaining} To Go` }];
  return [{ label: stage, value: `${p.stageLap}|${p.stageLength}` }, race];
}

/** so far, lap 167 */
export function soFar(lap: number): string {
  return `so far, lap ${lap}`;
}
