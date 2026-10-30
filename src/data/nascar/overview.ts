import type { FeedLapTimes, FeedPitStop } from './feed';
import { fuelLeft, fuelModel } from './fuel';

export { CAUTION_BURN } from './fuel';

/**
 * Running order and per-car timing as of the moment the leader completes `atLap`, using
 * only crossings up to that moment (no look-ahead, so it also works on live data).
 *
 * Order is by laps completed, then line-crossing time. Laps down use progress (laps plus the
 * fraction of the current lap, estimated from the car's last lap time). Gaps are taken at the
 * last start/finish line both cars have crossed. A car that hasn't crossed the line for
 * several laps is out.
 */
export interface OverviewEntry {
  carNumber: string;
  fullName: string;
  position: number;
  lapsCompleted: number;
  lapsDown: number;
  out: boolean;
  lastLapTime: number | null;
  /** Seconds behind the leader at the line; null when laps down or out. */
  gapToLeader: number | null;
  /** Seconds behind the car ahead when both are on the same lap; null otherwise. */
  interval: number | null;
  /** Laps down relative to the car ahead (0 when on the same lap). */
  lapsBehindAhead: number;
  lapsSincePit: number | null;
  /** 0..1 of a full tank; null until the burn rate can be estimated. */
  fuelEstimate: number | null;
  /** Mean lap time in seconds over the car's last 10 laps (or fewer, early on). */
  avgLap10: number | null;
}

const AVG_LAPS = 10;
/** Laps without crossing the line (at the car's normal pace) before it counts as out. */
const OUT_LAPS = 4;

export function buildOverview(
  lapTimes: FeedLapTimes,
  pits: FeedPitStop[],
  atLap: number,
  /**
   * Live data: "now" is the latest line crossing recorded, not the leader's. A snapshot comes
   * in after the cars behind have crossed too, and cutting at the leader's crossing would
   * leave them a lap short until the leader's next lap.
   */
  latest = false,
  /** Cars NASCAR reports as out (live feed status), whatever their line crossings say. */
  outCars: ReadonlySet<string> = new Set(),
  /**
   * Live: NASCAR's running position and gap to the leader (seconds, or minus the laps down),
   * used as given. Only finished races, which have no feed, work the order out from the laps.
   */
  feed: ReadonlyMap<string, { position: number; gap?: number }> = new Map(),
): OverviewEntry[] {
  // Cumulative race time at the end of each lap, per car (index = lap).
  const cars = lapTimes.laps.map((car) => {
    const elapsed: number[] = [0];
    const laps = [...car.Laps].filter((l) => l.Lap >= 1).sort((a, b) => a.Lap - b.Lap);
    for (const l of laps) elapsed[l.Lap] = (elapsed[l.Lap - 1] ?? NaN) + (l.LapTime ?? NaN);
    return { car, laps, elapsed, total: laps.length };
  });

  // "Now" is the moment the first car completes `atLap`. Everything below uses only line
  // crossings at or before that moment, so the same logic works on a live race.
  const leader = cars
    .filter((c) => Number.isFinite(c.elapsed[atLap]))
    .sort((a, b) => a.elapsed[atLap]! - b.elapsed[atLap]!)[0];
  if (!leader) return [];
  const crossed = cars.flatMap((c) => c.elapsed.filter((t) => Number.isFinite(t)));
  const tNow = latest ? Math.max(leader.elapsed[atLap]!, ...crossed) : leader.elapsed[atLap]!;

  const fuel = fuelModel(lapTimes, pits, atLap);

  const rows = cars.map(({ car, laps, elapsed }) => {
    // Laps completed by now, and how far into the next one (from its last lap time).
    let m = 0;
    while (Number.isFinite(elapsed[m + 1]) && elapsed[m + 1]! <= tNow) m++;
    const sinceLine = tNow - elapsed[m]!;
    const recent = laps.slice(Math.max(0, m - AVG_LAPS), m).filter((l) => l.LapTime);
    const typical = recent.length ? Math.min(...recent.map((l) => l.LapTime!)) : leader.laps[atLap - 1]?.LapTime ?? 30;
    const progress = m + Math.min(0.999, sinceLine / (laps[m - 1]?.LapTime ?? typical));
    // No crossing for OUT_LAPS of its normal laps: parked in the garage or out of the race.
    const out = outCars.has(car.Number) || (m < atLap && sinceLine > OUT_LAPS * typical);
    const lapsDown = m >= atLap ? 0 : Math.max(0, Math.floor(atLap - progress));

    const stops = pits
      .filter((p) => p.vehicle_number === car.Number && p.lap_count > 0 && p.lap_count <= m)
      .map((p) => p.lap_count);
    const lastStop = stops.length ? Math.max(...stops) : 0;
    const recentTime = recent.reduce((a, l) => a + l.LapTime!, 0);

    return {
      elapsed,
      progress,
      // Lap 0's running position is the starting spot: orders the field before the green.
      start: car.Laps.find((l) => l.Lap === 0)?.RunningPos || Infinity,
      carNumber: car.Number,
      fullName: car.FullName,
      lapsCompleted: m,
      lapsDown,
      out,
      lastLapTime: laps[m - 1]?.LapTime ?? null,
      gapToLeader: null as number | null, // filled in below, once the leader's row exists
      lapsSincePit: m > 0 ? m - lastStop : null,
      fuelEstimate: fuelLeft(fuel, lastStop, m),
      avgLap10: recent.length ? recentTime / recent.length : null,
    };
  });

  // Order as timing screens do at the line: more laps completed first, then who crossed the
  // line earlier. (Progress into the current lap only decides laps down; ordering by it could
  // put a car ahead of one that crossed the line before it, giving negative gaps.)
  const feedPos = (n: string) => feed.get(n)?.position || Infinity;
  rows.sort(
    (a, b) =>
      Number(a.out) - Number(b.out) ||
      (feed.size ? feedPos(a.carNumber) - feedPos(b.carNumber) : 0) ||
      b.lapsCompleted - a.lapsCompleted ||
      a.elapsed[a.lapsCompleted]! - b.elapsed[b.lapsCompleted]! ||
      a.start - b.start,
  );

  /**
   * Time `car` trails `other`: at the last line both crossed, as live timing shows it. If
   * `other` only got ahead after that line (a pass mid-lap), that difference is negative, so
   * fall back to the progress difference at the car's current pace.
   */
  const trail = (car: (typeof rows)[number], other: (typeof rows)[number]) => {
    const L = car.lapsCompleted;
    const atLine = car.elapsed[L]! - (other.elapsed[L] ?? NaN);
    if (Number.isFinite(atLine) && atLine >= 0) return atLine;
    return Math.max(0, (other.progress - car.progress) * (car.lastLapTime ?? 0));
  };
  const first = rows[0];

  // NASCAR's gaps, when the feed has one for every running car.
  const gapOf = (n: string) => feed.get(n)?.gap;
  const feedGaps = feed.size > 0 && rows.every((r) => r.out || gapOf(r.carNumber) !== undefined);
  if (feedGaps) for (const r of rows) if (!r.out) r.lapsDown = Math.max(0, Math.round(-gapOf(r.carNumber)!));

  return rows.map((row, i) => {
    const { elapsed: _e, progress: _p, start: _s, ...r } = row;
    const ahead = rows[i - 1];
    const lapsBehindAhead = ahead ? r.lapsDown - ahead.lapsDown : 0;
    if (feedGaps) {
      const leadLap = !r.out && r.lapsDown === 0;
      const gap = Math.max(0, gapOf(r.carNumber)!);
      return {
        ...r,
        position: i + 1,
        gapToLeader: leadLap ? (i === 0 ? 0 : gap) : null,
        // The one derived figure: the difference between two of NASCAR's gaps.
        interval: ahead && leadLap && lapsBehindAhead === 0 ? Math.max(0, gap - Math.max(0, gapOf(ahead.carNumber) ?? 0)) : null,
        lapsBehindAhead,
      };
    }
    return {
      ...r,
      position: i + 1,
      gapToLeader: !first || r.out || r.lapsDown > 0 ? null : i === 0 ? 0 : trail(row, first),
      interval: ahead && lapsBehindAhead === 0 && !r.out ? trail(row, ahead) : null,
      lapsBehindAhead,
    };
  });
}

