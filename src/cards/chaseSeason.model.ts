// Chase tab: the whole Chase so far for one series. Standings (as they run during a Chase
// race), each driver's result in every Chase race, and points after each race for the chart.
// Built from each finished Chase race's final points file and results, plus the live race.
// Strings are formatted here so the web UI and API clients match.
import type { FeedRaceResult } from '../data/nascar/feed';
import { parseDriverName } from '../data/nascar/names';
import type { ChaseEntry, FeedLivePoints } from '../data/nascar/points';
import { positionChange } from '../format/format';
import type { SeriesProfile } from '../series/types';

const EN_DASH = '–';
const MINUS = '−';

/** A Chase race from the schedule, with its final files once it has been run. */
export interface ChaseRaceInput {
  race: { race_id: number; race_name: string; track_name: string; race_date: string };
  livePoints?: FeedLivePoints[];
  results?: FeedRaceResult[];
}

/** The Chase race running now: NASCAR's points file and the standings as they run. */
export interface ChaseLiveInput {
  raceId: number;
  livePoints: FeedLivePoints[];
  entries: ChaseEntry[];
}

export type ChaseRaceState = 'done' | 'live' | 'next' | 'upcoming';
export type ResultTone = 'win' | 'top5' | 'top10' | 'other';

export interface ChaseSeasonDriver {
  carNumber: string;
  carBadge: string;
  firstName: string;
  lastName: string;
  /** Chase position now (as they run during a Chase race). */
  rank: number;
  /** Move in the latest (or running) race: "+2", "−1", "–". */
  change: string;
  changeDir: 'up' | 'down' | 'same';
  points: string;
  /** Behind the leader / the driver just ahead: "−74", or "–". */
  gap: string;
  gapAhead: string;
  /** Points from the running race so far, or the last race: "+43". */
  earned: string;
  /** Current running position in a live Chase race ("P14"), else "–". */
  running: string;
  chaseWins: string;
  chaseTop5: string;
  /** Average finish in the Chase races run, "8.4", or "–". */
  chaseAvg: string;
  seasonWins: string;
  seasonTop5: string;
  seasonTop10: string;
  poles: string;
  /** One per Chase race (same order as `races`): finish (or running position live), or null. */
  results: ({ finish: string; points: string; state: 'done' | 'live'; tone: ResultTone } | null)[];
  /** Points at the start of the Chase, then after each race run (live: as they run); null after. */
  trail: (number | null)[];
}

export interface ChaseSeasonView {
  seriesId: string;
  title: string;
  /** 'not-started': no Chase race has run yet (rows empty); 'running'; 'complete'. */
  status: 'not-started' | 'running' | 'complete';
  /** Headline tiles: "Race" 6 of 10, "Leader" #5 Larson +79, "To go" 4 races. */
  summary: { label: string; value: string; detail?: string }[];
  races: { raceId: number; short: string; name: string; date: string; state: ChaseRaceState }[];
  /** Axis labels for `trail`: "Start", then each race's short name. */
  trailLabels: string[];
  drivers: ChaseSeasonDriver[];
  notes: string[];
}

/** "Charlotte Motor Speedway" -> "Charlotte". */
export function shortTrack(name: string): string {
  const special: Record<string, string> = { 'World Wide Technology Raceway': 'Gateway', 'Homestead-Miami Speedway': 'Homestead' };
  return special[name] ?? name.replace(/\s+(Motor Speedway|International Speedway|International Raceway|Superspeedway|Speedway|Raceway)$/i, '').trim();
}

/** "2026-10-11T15:00:00" -> "Oct 11" (the schedule's ET date). */
function shortDate(raceDate: string): string {
  const [y, m, d] = raceDate.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y!, m! - 1, d!));
}

const tone = (finish: number): ResultTone => (finish === 1 ? 'win' : finish <= 5 ? 'top5' : finish <= 10 ? 'top10' : 'other');
const behind = (n: number) => (n > 0 ? `${MINUS}${n}` : EN_DASH);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function buildChaseSeasonView(profile: SeriesProfile, races: ChaseRaceInput[], live?: ChaseLiveInput): ChaseSeasonView {
  const done = races.filter((r) => r.livePoints?.some((d) => d.is_in_chase) && r.results?.length && r.race.race_id !== live?.raceId);
  const liveIdx = live ? races.findIndex((r) => r.race.race_id === live.raceId) : -1;
  const nextIdx = races.findIndex((r, i) => i !== liveIdx && !done.includes(r));
  const raceRows = races.map((r, i) => ({
    raceId: r.race.race_id,
    short: shortTrack(r.race.track_name),
    name: r.race.race_name,
    date: shortDate(r.race.race_date),
    state: (i === liveIdx ? 'live' : done.includes(r) ? 'done' : i === nextIdx && liveIdx < 0 ? 'next' : 'upcoming') as ChaseRaceState,
  }));
  const base = { seriesId: profile.id, title: 'Chase', races: raceRows, trailLabels: ['Start', ...raceRows.map((r) => r.short)] };

  // The latest standings: live as they run, else the last finished race's points file.
  const latest = done.at(-1);
  if (!live && !latest) {
    const first = races[0];
    return {
      ...base,
      status: 'not-started',
      summary: first ? [{ label: 'Starts', value: shortTrack(first.race.track_name), detail: shortDate(first.race.race_date) }] : [],
      drivers: [],
      notes: first ? [`The Chase starts at ${first.race.track_name} on ${shortDate(first.race.race_date)}: ${plural(races.length, 'race')}.`] : ['No Chase races on this season’s schedule.'],
    };
  }

  const seasonFile = live?.livePoints ?? latest!.livePoints!;
  const season = new Map(seasonFile.map((d) => [d.car_number, d]));
  // Points now and before the latest race, by car, for the Chase field.
  const now = new Map<string, { points: number; before: number; running: number | null; name: string }>();
  if (live) {
    for (const e of live.entries) now.set(e.carNumber, { points: e.pointsLive, before: e.pointsBefore, running: e.running, name: e.name });
  } else {
    for (const d of latest!.livePoints!.filter((x) => x.is_in_chase)) {
      now.set(d.car_number, { points: d.points, before: d.points - d.points_earned_this_race, running: null, name: `${d.first_name} ${d.last_name}` });
    }
  }
  const finishOf = (r: ChaseRaceInput) => new Map((r.results ?? []).map((x) => [x.car_number, x]));
  const finishes = races.map((r) => (done.includes(r) ? finishOf(r) : undefined));
  const pointsAfter = races.map((r) => (done.includes(r) ? new Map(r.livePoints!.map((d) => [d.car_number, d])) : undefined));
  // Start-of-Chase points: the first Chase race's points less what it earned (the reset seed).
  const firstFile = done[0]?.livePoints;
  const seed = (car: string) => {
    const d = firstFile?.find((x) => x.car_number === car);
    return d ? d.points - d.points_earned_this_race : (now.get(car)?.before ?? null);
  };

  const cars = [...now.keys()];
  // Ties on points break on the better running position (live), then car number.
  const rankBy = (key: 'points' | 'before') =>
    new Map(
      [...cars]
        .sort(
          (a, b) =>
            now.get(b)![key] - now.get(a)![key] ||
            (key === 'points' ? (now.get(a)!.running ?? 99) - (now.get(b)!.running ?? 99) : 0) ||
            a.localeCompare(b, undefined, { numeric: true }),
        )
        .map((c, i) => [c, i + 1]),
    );
  const rankNow = rankBy('points');
  const rankBefore = rankBy('before');
  const order = [...cars].sort((a, b) => rankNow.get(a)! - rankNow.get(b)!);
  const leadPts = now.get(order[0]!)!.points;

  const drivers = order.map((car, i): ChaseSeasonDriver => {
    const n = now.get(car)!;
    const name = parseDriverName(n.name);
    const delta = rankBefore.get(car)! - rankNow.get(car)!;
    const myFinishes = finishes.map((f) => f?.get(car)?.finishing_position).filter((x): x is number => !!x);
    const s = season.get(car);
    const results = races.map((_, ri) => {
      if (ri === liveIdx) return n.running ? { finish: `P${n.running}`, points: `+${n.points - n.before}`, state: 'live' as const, tone: tone(n.running) } : null;
      const f = finishes[ri]?.get(car);
      return f ? { finish: String(f.finishing_position), points: `+${f.points_earned}`, state: 'done' as const, tone: tone(f.finishing_position) } : null;
    });
    const trail = [seed(car), ...races.map((_, ri) => (ri === liveIdx ? n.points : (pointsAfter[ri]?.get(car)?.points ?? null)))];
    return {
      carNumber: car,
      carBadge: `/api/v1/series/${profile.id}/car-badges/${car}.png`,
      firstName: name.firstName,
      lastName: name.lastName,
      rank: rankNow.get(car)!,
      change: positionChange(delta),
      changeDir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
      points: String(n.points),
      gap: i === 0 ? EN_DASH : behind(leadPts - n.points),
      gapAhead: i === 0 ? EN_DASH : behind(now.get(order[i - 1]!)!.points - n.points),
      earned: `+${n.points - n.before}`,
      running: n.running ? `P${n.running}` : EN_DASH,
      chaseWins: String(myFinishes.filter((f) => f === 1).length),
      chaseTop5: String(myFinishes.filter((f) => f <= 5).length),
      chaseAvg: myFinishes.length ? (myFinishes.reduce((a, f) => a + f, 0) / myFinishes.length).toFixed(1) : EN_DASH,
      seasonWins: String(s?.wins ?? 0),
      seasonTop5: String(s?.top_5 ?? 0),
      seasonTop10: String(s?.top_10 ?? 0),
      poles: String(s?.poles ?? 0),
      results,
      trail,
    };
  });

  const run = done.length + (live ? 1 : 0);
  const left = races.length - run;
  const leader = drivers[0]!;
  const second = drivers[1];
  return {
    ...base,
    status: left === 0 && !live ? 'complete' : 'running',
    summary: [
      { label: live ? 'Racing' : 'Races run', value: `${run} of ${races.length}`, detail: live ? raceRows[liveIdx]?.short : latest ? shortTrack(latest.race.track_name) : undefined },
      { label: live ? 'Leader as they run' : 'Leader', value: `#${leader.carNumber} ${leader.lastName}`, detail: second ? `by ${Number(leader.points) - Number(second.points)} pts` : undefined },
      { label: 'To go', value: plural(left, 'race'), detail: left > 0 ? raceRows.filter((r) => r.state === 'next' || r.state === 'upcoming').map((r) => r.short).join(', ') : undefined },
    ],
    drivers,
    notes: [
      live
        ? 'As they run: points, gaps and Pos are the standings if the race ended now (finishing points for the running position plus stage points). ± is the move from where they entered this race.'
        : `Standings after the ${latest!.race.race_name}. ± is the move in that race.`,
      'Chase columns count the Chase races run; Season columns are the whole season (NASCAR’s points file).',
    ],
  };
}
