// Display models for the Pit road, Strategy, Fuel and Compare tabs. All strings are
// formatted here so the web UI and API clients show identical values.
import type { TrackFlag } from '../data/types';
import { flagFromFeed, type FeedLapTimes, type FeedPitStop } from '../data/nascar/feed';
import { fuelLeft, fuelModel, CAUTION_BURN } from '../data/nascar/fuel';
import { parseDriverName } from '../data/nascar/names';
import type { OverviewEntry } from '../data/nascar/overview';
import { crewAverages, stints, stopsUpTo, type Stint, type StopKind } from '../data/nascar/stops';
import { lapTime, pitTime, positionChange } from '../format/format';
import { markerHighlight } from '../series/markers';
import type { SeriesProfile } from '../series/types';

const EN_DASH = '–';
const KIND_LABEL: Record<StopKind, string> = { four: '4 tires', two: '2 tires', fuel: 'Fuel only' };

interface Who {
  carNumber: string;
  carBadge: string;
  firstName: string;
  lastName: string;
  highlight: boolean;
}
const who = (profile: SeriesProfile, carNumber: string, fullName: string): Who => {
  const n = parseDriverName(fullName);
  return {
    carNumber,
    carBadge: `/api/v1/series/${profile.id}/car-badges/${carNumber}.png`,
    firstName: n.firstName,
    lastName: n.lastName,
    highlight: markerHighlight(n.markerTokens, profile),
  };
};

export interface Inputs {
  profile: SeriesProfile;
  lapTimes: FeedLapTimes;
  pits: FeedPitStop[];
  atLap: number;
  totalLaps: number;
  stageEnds: number[];
  order: OverviewEntry[];
}

// ---- Pit road -------------------------------------------------------------------------

export interface PitRoadView {
  latest: (Who & { lap: string; kind: string; flag: TrackFlag; box: string; lane: string; gained: string; gainedDir: 'up' | 'down' | 'same' })[];
  fourTire: (Who & { rank: number; average: string; best: string; stops: string })[];
  twoTire: (Who & { rank: number; average: string; best: string; stops: string })[];
  notes: string[];
}

export function buildPitRoadView({ profile, lapTimes, pits, atLap }: Inputs): PitRoadView {
  const stops = stopsUpTo(lapTimes, pits, atLap);
  const avgRows = (kind: StopKind) =>
    crewAverages(stops, kind)
      .slice(0, 10)
      .map((a, i) => ({
        ...who(profile, a.carNumber, a.driverName),
        rank: i + 1,
        average: pitTime(a.average),
        best: pitTime(a.best),
        stops: String(a.stops),
      }));
  return {
    latest: [...stops]
      .sort((a, b) => b.raceTime - a.raceTime)
      .map((s) => ({
        ...who(profile, s.carNumber, s.driverName),
        lap: String(s.leaderLap),
        kind: KIND_LABEL[s.kind],
        flag: s.underGreen ? 'green' : 'yellow',
        box: s.boxTime === null ? EN_DASH : pitTime(s.boxTime),
        lane: s.laneTime === null ? EN_DASH : pitTime(s.laneTime),
        gained: positionChange(s.positionsGained),
        gainedDir: s.positionsGained > 0 ? 'up' : s.positionsGained < 0 ? 'down' : 'same',
      })),
    fourTire: avgRows('four'),
    twoTire: avgRows('two'),
    notes: [
      'Box: time stopped in the pit box. Lane: pit road entry to exit.',
      'Averages leave out stops over 1.5× the field median (repairs, penalties).',
      '± is positions gained or lost on that stop.',
    ],
  };
}

// ---- Strategy -------------------------------------------------------------------------

export interface StrategyView {
  totalLaps: number;
  atLap: number;
  stageEnds: number[];
  rows: (Who & { position: number; stints: Stint[]; stops: string; laneTotal: string })[];
  notes: string[];
}

export function buildStrategyView({ profile, lapTimes, pits, atLap, totalLaps, stageEnds, order }: Inputs): StrategyView {
  const stops = stopsUpTo(lapTimes, pits, atLap);
  return {
    totalLaps,
    atLap,
    stageEnds,
    rows: order.map((e) => {
      const mine = stops.filter((s) => s.carNumber === e.carNumber);
      const lane = mine.reduce((a, s) => a + (s.laneTime ?? 0), 0);
      return {
        ...who(profile, e.carNumber, e.fullName),
        position: e.position,
        stints: stints(stops, e.carNumber, e.lapsCompleted),
        stops: String(mine.length),
        laneTotal: lane ? lapTime(lane) : EN_DASH,
      };
    }),
    notes: [
      'Each bar is one stint, colored by the stop that started it. Notches mark stage ends.',
      'Lane: total time spent on pit road.',
    ],
  };
}

// ---- Fuel -----------------------------------------------------------------------------

export interface FuelView {
  rows: (Who & {
    position: number;
    fuel: string;
    /** 0..1 for the gauge, or null. */
    fuelValue: number | null;
    lapsLeft: string;
    sincePit: string;
    reaches: string;
    reachesStatus: 'good' | 'mid' | 'bad' | 'none';
  })[];
  notes: string[];
}

export function buildFuelView({ profile, lapTimes, pits, atLap, totalLaps, stageEnds, order }: Inputs): FuelView {
  const model = fuelModel(lapTimes, pits, atLap);
  const nextStageEnd = stageEnds.find((s) => s > atLap);
  const toStage = nextStageEnd ? nextStageEnd - atLap : null;
  const toFinish = totalLaps - atLap;
  return {
    rows: order.map((e) => {
      const lastStop = e.lapsSincePit === null ? 0 : e.lapsCompleted - e.lapsSincePit;
      const left = e.out ? null : fuelLeft(model, lastStop, e.lapsCompleted);
      const range = left === null ? null : left * model.tankLaps;
      let reaches = EN_DASH;
      let reachesStatus: FuelView['rows'][number]['reachesStatus'] = 'none';
      if (range !== null) {
        if (range >= toFinish) [reaches, reachesStatus] = ['The finish', 'good'];
        else if (toStage !== null && range >= toStage) [reaches, reachesStatus] = [`Stage end (${toStage} to go)`, 'mid'];
        else [reaches, reachesStatus] = [`Short ${Math.ceil((toStage ?? toFinish) - range)} laps`, 'bad'];
      }
      return {
        ...who(profile, e.carNumber, e.fullName),
        position: e.position,
        fuel: left === null ? EN_DASH : `${Math.round(left * 100)}%`,
        fuelValue: left,
        lapsLeft: range === null ? EN_DASH : `~${Math.floor(range)}`,
        sincePit: e.lapsSincePit === null ? EN_DASH : String(e.lapsSincePit),
        reaches,
        reachesStatus,
      };
    }),
    notes: [
      'Modeled, not measured: NASCAR publishes no fuel data.',
      `Assumes every stop fills the tank, a caution lap burns ${Math.round(CAUTION_BURN * 100)}% of a green lap, and the field's longest run so far (${model.tankLaps.toFixed(0)} green-flag-equivalent laps) used one full tank.`,
      'Laps left and Reaches assume green-flag running from here; cautions stretch fuel further.',
    ],
  };
}

// ---- Compare (lap times) ----------------------------------------------------------------

export interface LapsView {
  atLap: number;
  /** Flag per leader lap, index 0 = lap 1. */
  lapFlags: TrackFlag[];
  cars: (Who & { position: number; laps: (number | null)[] })[];
}

export function buildLapsView({ profile, lapTimes, atLap, order }: Inputs): LapsView {
  const flagAt = new Map(lapTimes.flags.map((f) => [f.LapsCompleted, f.FlagState]));
  const byCar = new Map(lapTimes.laps.map((c) => [c.Number, c]));
  return {
    atLap,
    lapFlags: Array.from({ length: atLap }, (_, i) => flagFromFeed(flagAt.get(i + 1))),
    cars: order.map((e) => {
      const laps: (number | null)[] = Array.from({ length: e.lapsCompleted }, () => null);
      for (const l of byCar.get(e.carNumber)?.Laps ?? []) {
        if (l.Lap >= 1 && l.Lap <= e.lapsCompleted) laps[l.Lap - 1] = l.Estimated ? null : l.LapTime;
      }
      return { ...who(profile, e.carNumber, e.fullName), position: e.position, laps };
    }),
  };
}

// ---- Top speed (Pace tab) --------------------------------------------------------------

export interface TopSpeedView {
  rows: (Who & { rank: number; speed: string; lap: string; time: string })[];
  notes: string[];
}

/**
 * Fastest single-lap average speed per car through `atLap`. NASCAR's public feed has no
 * speed-trap data, so this is the best lap speed (mph), not an instantaneous top speed.
 */
export function buildTopSpeedView({ profile, lapTimes, atLap, order }: Inputs, limit = 10): TopSpeedView {
  const ownLaps = new Map(order.map((e) => [e.carNumber, e.lapsCompleted]));
  const best = lapTimes.laps
    .map((car) => {
      const upTo = ownLaps.get(car.Number) ?? atLap;
      let top: { speed: number; lap: number; time: number } | null = null;
      for (const l of car.Laps) {
        const mph = Number(l.LapSpeed);
        if (l.Lap < 1 || l.Lap > upTo || !l.LapTime || !Number.isFinite(mph)) continue;
        if (!top || mph > top.speed) top = { speed: mph, lap: l.Lap, time: l.LapTime };
      }
      return top && { car, top };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => b.top.speed - a.top.speed || a.top.lap - b.top.lap)
    .slice(0, limit);
  return {
    rows: best.map((b, i) => ({
      ...who(profile, b.car.Number, b.car.FullName),
      rank: i + 1,
      speed: b.top.speed.toFixed(3),
      lap: String(b.top.lap),
      time: lapTime(b.top.time),
    })),
    notes: ['Fastest single lap, as average lap speed in mph. NASCAR publishes no speed-trap data, so true top speed isn\'t available.'],
  };
}
