// Championship points from NASCAR's live points file
// (cf.nascar.com/live/feeds/series_{n}/{raceId}/live_points.json). During a live race NASCAR
// fills it as the cars run; for a completed race it holds the final numbers, so a mid-race
// replay is rebuilt from: points before the race + stages already finished + the points the
// car's current running position would pay.

export interface FeedLivePoints {
  driver_id: number;
  car_number: string;
  first_name: string;
  last_name: string;
  is_in_chase: boolean;
  is_points_eligible: boolean;
  is_rookie?: boolean;
  is_fastest_lap_point: boolean;
  points: number;
  points_position: number;
  points_earned_this_race: number;
  bonus_points: number;
  stage_1_points: number;
  stage_2_points: number;
  stage_3_points: number;
}

export interface FeedResult {
  driver_id: number;
  finishing_position: number;
}

const stagePoints = (d: FeedLivePoints, stages: number) =>
  [d.stage_1_points, d.stage_2_points, d.stage_3_points].slice(0, stages).reduce((a, b) => a + b, 0);

/**
 * Points paid per finishing position in this race (index = position), read back from the
 * results rather than hard-coded, so rule changes (2026: 55 for a win) come along for free.
 * Positions held by points-ineligible drivers are filled by interpolation.
 */
export function finishPointsTable(live: FeedLivePoints[], results: FeedResult[]): number[] {
  const finish = new Map(results.map((r) => [r.driver_id, r.finishing_position]));
  const table: (number | undefined)[] = [];
  for (const d of live) {
    const pos = finish.get(d.driver_id);
    if (!pos || !d.is_points_eligible) continue;
    table[pos] = d.points_earned_this_race - stagePoints(d, 3) - d.bonus_points - (d.is_fastest_lap_point ? 1 : 0);
  }
  const max = Math.max(results.length, table.length - 1);
  const out: number[] = [0];
  for (let p = 1; p <= max; p++) {
    if (table[p] !== undefined) {
      out[p] = table[p]!;
      continue;
    }
    const prev = out[p - 1];
    let n = p + 1;
    while (n <= max && table[n] === undefined) n++;
    const next = table[n];
    out[p] =
      prev !== undefined && p > 1 && next !== undefined
        ? Math.round(prev + (next - prev) / (n - p + 1))
        : next !== undefined
          ? next + (n - p)
          : Math.max(0, (prev ?? 1) - 1);
  }
  return out;
}

export interface ChaseEntry {
  driverId: number;
  carNumber: string;
  name: string;
  /** Season points entering this race. */
  pointsBefore: number;
  rankBefore: number;
  /** Projected points if the race ended now. */
  pointsLive: number;
  rankLive: number;
  /** Current running position, or null if not in the race. */
  running: number | null;
}

/**
 * Chase standings before the race and "as they run". Only the Chase field is ranked.
 * `stagesComplete` stages' points are counted; fastest-lap and bonus points are not
 * projected (they aren't known until the end).
 */
export function chaseStandings(
  live: FeedLivePoints[],
  table: number[],
  runningByCar: Map<string, number>,
  stagesComplete: number,
  /** Live race: NASCAR's file already holds points as they run, so use them as-is. */
  { asTheyRun = false }: { asTheyRun?: boolean } = {},
): ChaseEntry[] {
  const field = live.filter((d) => d.is_in_chase);
  const rows = field.map((d) => {
    const before = d.points - d.points_earned_this_race;
    const running = runningByCar.get(d.car_number) ?? null;
    const projected = asTheyRun ? d.points : before + stagePoints(d, stagesComplete) + (running ? (table[running] ?? 0) : 0);
    return {
      driverId: d.driver_id,
      carNumber: d.car_number,
      name: d.first_name + ' ' + d.last_name,
      pointsBefore: before,
      rankBefore: 0,
      pointsLive: projected,
      rankLive: 0,
      running,
    };
  });
  // Ties break on the current running position (better position first), then car number.
  const rank = (key: 'pointsBefore' | 'pointsLive', target: 'rankBefore' | 'rankLive', useRunning: boolean) =>
    [...rows]
      .sort(
        (a, b) =>
          b[key] - a[key] ||
          (useRunning ? (a.running ?? 99) - (b.running ?? 99) : 0) ||
          a.carNumber.localeCompare(b.carNumber, undefined, { numeric: true }),
      )
      .forEach((r, i) => (r[target] = i + 1));
  rank('pointsBefore', 'rankBefore', false);
  rank('pointsLive', 'rankLive', true);
  return rows.sort((a, b) => a.rankLive - b.rankLive);
}
