import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LapsView } from '../cards/tabs.model';
import { lapTime } from '../format/format';
import { lineSeries, MAX_LINES } from '../tokens/tokens';
import { api } from './api';
import { CarNumber } from './CarNumber';
import { DataError } from './NoLive';
import { SourceContext, useSeriesApi } from './useApi';

const WINDOWS = [
  { id: 20, label: 'Last 20' },
  { id: 50, label: 'Last 50' },
  { id: 0, label: 'All laps' },
] as const;
const SLOW_FACTOR = 1.07; // laps this much slower than the car's median are pit/traffic/incident laps

type Car = LapsView['cars'][number];
interface Picked {
  carNumber: string;
  slot: number; // color slot, kept for as long as the car stays selected
}

/** Green-flag lap times, with pit and other slowed laps hidden (null), for one car. */
function cleanLaps(car: Car, flags: LapsView['lapFlags']): (number | null)[] {
  const green = car.laps.map((t, i) => (t !== null && flags[i] === 'green' && flags[i - 1] === 'green' ? t : null));
  const vals = green.filter((t): t is number => t !== null).sort((a, b) => a - b);
  const median = vals[Math.floor(vals.length / 2)] ?? 0;
  return green.map((t) => (t !== null && t <= median * SLOW_FACTOR ? t : null));
}

/** Spreads right-end labels so lines that finish close together don't overprint. */
function endLabels<T extends { y: number }>(labels: T[], gap = 15): T[] {
  const out = [...labels].sort((a, b) => a.y - b.y).map((l) => ({ ...l }));
  for (let i = 1; i < out.length; i++) out[i]!.y = Math.max(out[i]!.y, out[i - 1]!.y + gap);
  return out;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setW(ref.current.clientWidth); // measure now; the observer only reports later changes
    const ro = new ResizeObserver(([e]) => e && setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

function LapChart({ data, picked, window }: { data: LapsView; picked: Picked[]; window: number }) {
  const { ref, w } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const H = 320;
  const pad = { l: 56, r: picked.length <= 4 ? 96 : 16, t: 12, b: 28 };
  const from = window ? Math.max(1, data.atLap - window + 1) : 1;
  const to = data.atLap;

  const series = picked.map((p) => {
    const car = data.cars.find((c) => c.carNumber === p.carNumber)!;
    return { p, car, laps: cleanLaps(car, data.lapFlags), color: lineSeries.dark[p.slot]! };
  });
  const shown = series.flatMap((s) => s.laps.slice(from - 1, to).filter((t): t is number => t !== null));
  const lo = shown.length ? Math.min(...shown) : 0;
  const hi = shown.length ? Math.max(...shown) : 1;
  const span = Math.max(0.2, hi - lo);
  const yMin = lo - span * 0.08;
  const yMax = hi + span * 0.08;
  const x = (lap: number) => pad.l + ((lap - from) / Math.max(1, to - from)) * (w - pad.l - pad.r);
  const y = (t: number) => pad.t + ((t - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);

  const path = (laps: (number | null)[]) => {
    let d = '';
    let pen = false;
    for (let lap = from; lap <= to; lap++) {
      const t = laps[lap - 1];
      if (t == null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${x(lap).toFixed(1)},${y(t).toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  // Caution periods inside the window, shaded behind the lines.
  const cautions: [number, number][] = [];
  for (let lap = from; lap <= to; lap++) {
    if (data.lapFlags[lap - 1] !== 'green') {
      const last = cautions.at(-1);
      if (last && last[1] === lap - 1) last[1] = lap;
      else cautions.push([lap, lap]);
    }
  }
  const ticks = 5;
  const yTicks = Array.from({ length: ticks }, (_, i) => yMin + ((yMax - yMin) * i) / (ticks - 1));
  const xStep = Math.max(1, Math.ceil((to - from) / 8 / 5) * 5);
  const xTicks = Array.from({ length: Math.floor((to - from) / xStep) + 1 }, (_, i) => from + i * xStep);
  const lastValue = (laps: (number | null)[]) => {
    for (let lap = to; lap >= from; lap--) if (laps[lap - 1] != null) return { lap, t: laps[lap - 1]! };
    return null;
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const lap = Math.round(from + ((e.clientX - r.left - pad.l) / (w - pad.l - pad.r)) * (to - from));
    setHover(lap >= from && lap <= to ? lap : null);
  };

  return (
    <div ref={ref} className="chart">
      {w > 0 && (
      <svg width={w} height={H} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Lap time comparison chart">
        {cautions.map(([a, b]) => (
          <rect key={a} className="chart-caution" x={x(a) - 2} y={pad.t} width={Math.max(4, x(b) - x(a) + 4)} height={H - pad.t - pad.b} />
        ))}
        {yTicks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} />
            <text className="chart-tick" x={pad.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {xTicks.map((lap) => (
          <text key={lap} className="chart-tick" x={x(lap)} y={H - 8} textAnchor="middle">
            {lap}
          </text>
        ))}
        {series.map((s) => (
          <path key={s.p.carNumber} d={path(s.laps)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {picked.length <= 4 &&
          endLabels(series.flatMap((s) => {
            const lv = lastValue(s.laps);
            return lv ? [{ key: s.p.carNumber, name: s.car.lastName, x: x(lv.lap) + 8, y: y(lv.t) }] : [];
          })).map((l) => (
            <text key={l.key} className="chart-label" x={l.x} y={l.y} dominantBaseline="middle">
              {l.name}
            </text>
          ))}
        {hover !== null && (
          <g>
            <line className="chart-crosshair" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} />
            {series.map((s) => {
              const t = s.laps[hover - 1];
              return t != null ? <circle key={s.p.carNumber} cx={x(hover)} cy={y(t)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null;
            })}
          </g>
        )}
      </svg>
      )}
      {hover !== null && w > 0 && (
        <div className="chart-tip" style={{ left: Math.min(x(hover) + 12, w - 190) }}>
          <strong>Lap {hover}</strong>
          {data.lapFlags[hover - 1] !== 'green' && <span className="muted"> · caution</span>}
          {series.map((s) => (
            <div key={s.p.carNumber}>
              <i style={{ background: s.color }} />
              {s.car.lastName}
              <span className="num">{s.laps[hover - 1] != null ? lapTime(s.laps[hover - 1]!) : '–'}</span>
            </div>
          ))}
        </div>
      )}
      <div className="chart-axis-label">Lap time in seconds (faster is higher) · lap number</div>
    </div>
  );
}

export function CompareTab({ seriesId }: { seriesId: string }) {
  const { data, error } = useSeriesApi(api.laps, seriesId);
  const { useSample } = useContext(SourceContext);
  const [picked, setPicked] = useState<Picked[] | null>(null);
  const [window, setWindow] = useState<number>(20);

  const selection = useMemo<Picked[]>(
    () => picked ?? data?.cars.slice(0, 3).map((c, i) => ({ carNumber: c.carNumber, slot: i })) ?? [],
    [picked, data],
  );
  if (error) return <DataError error={error} onUseSample={useSample} />;
  if (!data) return null;

  const add = (carNumber: string) => {
    const used = new Set(selection.map((p) => p.slot));
    const slot = [...Array(MAX_LINES).keys()].find((s) => !used.has(s));
    if (slot !== undefined) setPicked([...selection, { carNumber, slot }]);
  };
  const remove = (carNumber: string) => setPicked(selection.filter((p) => p.carNumber !== carNumber));
  const byNumber = new Map(data.cars.map((c) => [c.carNumber, c]));
  const from = window ? Math.max(1, data.atLap - window + 1) : 1;

  return (
    <div className="overview-view">
      <section className="panel">
        <div className="panel-head">
          <h2>Compare lap times</h2>
          <div className="seg" role="group" aria-label="Laps shown">
            {WINDOWS.map((o) => (
              <button key={o.id} className={window === o.id ? 'active' : undefined} aria-pressed={window === o.id} onClick={() => setWindow(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="compare-picker">
          {selection.map((p) => {
            const c = byNumber.get(p.carNumber)!;
            return (
              <span key={p.carNumber} className="chip-driver">
                <i style={{ background: lineSeries.dark[p.slot] }} />
                <CarNumber number={c.carNumber} badge={c.carBadge} />
                {c.lastName}
                <button aria-label={`Remove ${c.lastName}`} onClick={() => remove(p.carNumber)} disabled={selection.length <= 1}>
                  ×
                </button>
              </span>
            );
          })}
          <select
            value=""
            onChange={(e) => e.target.value && add(e.target.value)}
            disabled={selection.length >= MAX_LINES}
            aria-label="Add a driver"
          >
            <option value="">{selection.length >= MAX_LINES ? `Up to ${MAX_LINES} drivers` : '+ Add driver'}</option>
            {data.cars
              .filter((c) => !selection.some((p) => p.carNumber === c.carNumber))
              .map((c) => (
                <option key={c.carNumber} value={c.carNumber}>
                  P{c.position} · #{c.carNumber} {c.firstName} {c.lastName}
                </option>
              ))}
          </select>
        </div>
        <LapChart data={data} picked={selection} window={window} />
        <div className="table-scroll">
        <table className="dash-table compare-table">
          <thead>
            <tr>
              <th className="left">Driver</th>
              <th className="shrink">Laps shown</th>
              <th className="shrink">Avg</th>
              <th className="shrink">Best</th>
              <th className="shrink">Last</th>
            </tr>
          </thead>
          <tbody>
            {selection.map((p) => {
              const c = byNumber.get(p.carNumber)!;
              const laps = cleanLaps(c, data.lapFlags).slice(from - 1, data.atLap).filter((t): t is number => t !== null);
              const last = [...c.laps].reverse().find((t) => t !== null);
              return (
                <tr key={p.carNumber}>
                  <td className="left">
                    <span className="legend-swatch" style={{ background: lineSeries.dark[p.slot] }} />
                    <span className="dash-last">{c.lastName}</span>
                  </td>
                  <td className="num">{laps.length}</td>
                  <td className="num">{laps.length ? lapTime(laps.reduce((a, t) => a + t, 0) / laps.length) : '–'}</td>
                  <td className="num">{laps.length ? lapTime(Math.min(...laps)) : '–'}</td>
                  <td className="num">{last != null ? lapTime(last) : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <ul className="dash-notes">
          <li>Green-flag laps only; pit, restart and other slowed laps (over 7% off the car&apos;s median) are hidden. Shaded bands are cautions.</li>
          <li>Up to {MAX_LINES} drivers. Each keeps its color while selected.</li>
        </ul>
      </section>
    </div>
  );
}
