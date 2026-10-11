import { useEffect, useState } from 'react';
import type { ChaseSeasonView } from '../cards/chaseSeason.model';
import { lineSeries } from '../tokens/tokens';
import { api } from './api';
import { CarNumber } from './CarNumber';
import { endLabels, useWidth } from './chart';
import { DataError } from './NoLive';
import { useSeriesApi } from './useApi';

/** Highlighted drivers on the points chart: few enough to tell apart and label directly. */
const MAX_PICKED = 4;

interface Picked {
  carNumber: string;
  /** Color slot, kept while the driver stays highlighted. */
  slot: number;
}

function Summary({ view }: { view: ChaseSeasonView }) {
  return (
    <div className="chase-summary">
      {view.summary.map((t) => (
        <div key={t.label} className="panel stat-tile">
          <div className="stat-label">{t.label}</div>
          <div className="stat-value">{t.value}</div>
          {t.detail && <div className="stat-detail">{t.detail}</div>}
        </div>
      ))}
    </div>
  );
}

function Standings({ view, picked, toggle }: { view: ChaseSeasonView; picked: Picked[]; toggle: (car: string) => void }) {
  const live = view.races.some((r) => r.state === 'live');
  const slotOf = (car: string) => picked.find((p) => p.carNumber === car)?.slot;
  return (
    <section className="panel span-2">
      <div className="panel-head">
        <h2>{live ? 'Standings as they run' : 'Standings'}</h2>
        <span className="muted chase-hint">Click a driver to show them on the chart</span>
      </div>
      <div className="table-scroll">
        <table className="dash-table chase-season-table">
          <thead>
            <tr className="group-row">
              <th colSpan={live ? 9 : 8} />
              <th colSpan={3} className="group">Chase</th>
              <th colSpan={4} className="group">Season</th>
            </tr>
            <tr>
              <th className="shrink">Pos</th>
              <th className="shrink" title={live ? 'Move from where they entered this race' : 'Move in the last race'}>±</th>
              <th className="shrink">Car</th>
              <th className="left">Driver</th>
              <th className="shrink">Pts</th>
              <th className="shrink" title="Points behind the leader">Gap</th>
              <th className="shrink" title="Points behind the driver just ahead">Next</th>
              <th className="shrink" title={live ? 'Points so far this race' : 'Points in the last race'}>{live ? 'This race' : 'Last race'}</th>
              {live && <th className="shrink" title="Current running position">Running</th>}
              <th className="shrink group-start">Wins</th>
              <th className="shrink">Top 5</th>
              <th className="shrink" title="Average finish in the Chase races run">Avg fin</th>
              <th className="shrink group-start">Wins</th>
              <th className="shrink">Top 5</th>
              <th className="shrink">Top 10</th>
              <th className="shrink">Poles</th>
            </tr>
          </thead>
          <tbody>
            {view.drivers.map((d) => {
              const slot = slotOf(d.carNumber);
              return (
                <tr key={d.carNumber} className={['clickable', slot !== undefined && 'is-picked', d.rank === 1 && 'is-leader'].filter(Boolean).join(' ')} onClick={() => toggle(d.carNumber)}>
                  <td className="num">{d.rank}</td>
                  <td className={`num change-${d.changeDir}`}>{d.change}</td>
                  <td className="car">
                    <CarNumber number={d.carNumber} badge={d.carBadge} />
                  </td>
                  <td className="left">
                    {slot !== undefined && <i className="pick-dot" style={{ background: lineSeries.dark[slot] }} aria-hidden />}
                    <span className="dash-first">{d.firstName}</span>
                    <span className="dash-last">{d.lastName}</span>
                  </td>
                  <td className="num">{d.points}</td>
                  <td className="num muted">{d.gap}</td>
                  <td className="num muted">{d.gapAhead}</td>
                  <td className="num chase-gain">{d.earned}</td>
                  {live && <td className="num muted">{d.running}</td>}
                  <td className="num group-start">{d.chaseWins}</td>
                  <td className="num">{d.chaseTop5}</td>
                  <td className="num">{d.chaseAvg}</td>
                  <td className="num group-start">{d.seasonWins}</td>
                  <td className="num">{d.seasonTop5}</td>
                  <td className="num">{d.seasonTop10}</td>
                  <td className="num">{d.poles}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Each driver's finish in every Chase race; the live race shows the running position. */
function RaceGrid({ view }: { view: ChaseSeasonView }) {
  return (
    <section className="panel span-2">
      <div className="panel-head">
        <h2>Race by race</h2>
        <span className="legend-keys muted">
          <span className="res res-win">1</span> Win <span className="res res-top5">5</span> Top 5 <span className="res res-top10">10</span> Top 10
        </span>
      </div>
      <div className="table-scroll">
        <table className="dash-table chase-grid">
          <thead>
            <tr>
              <th className="shrink">Car</th>
              <th className="left">Driver</th>
              {view.races.map((r) => (
                <th key={r.raceId} className={`shrink race-col state-${r.state}`} title={`${r.name}, ${r.date}`}>
                  <div>{r.short}</div>
                  <div className="race-date">{r.state === 'live' ? 'Live' : r.date}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.drivers.map((d) => (
              <tr key={d.carNumber}>
                <td className="car">
                  <CarNumber number={d.carNumber} badge={d.carBadge} />
                </td>
                <td className="left">
                  <span className="dash-last">{d.lastName}</span>
                </td>
                {d.results.map((r, i) => (
                  <td key={view.races[i]!.raceId} className={`num race-cell state-${view.races[i]!.state}`} title={r ? `${view.races[i]!.short}: ${r.state === 'live' ? 'running ' : 'finished '}${r.finish}, ${r.points} pts` : undefined}>
                    {r && <span className={`res res-${r.tone}${r.state === 'live' ? ' res-live' : ''}`}>{r.finish}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Points after each Chase race: every driver as a thin gray line, up to four in color. */
function PointsChart({ view, picked, toggle }: { view: ChaseSeasonView; picked: Picked[]; toggle: (car: string) => void }) {
  const { ref, w } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const H = 340;
  const pad = { l: 56, r: 104, t: 12, b: 28 };
  // Through the last race with points (the live race counts).
  const last = Math.max(1, ...view.drivers.map((d) => d.trail.reduce<number>((m, v, i) => (v !== null ? i : m), 0)));
  const labels = view.trailLabels.slice(0, last + 1);
  const all = view.drivers.flatMap((d) => d.trail.slice(0, last + 1).filter((v): v is number => v !== null));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = Math.max(20, hi - lo);
  const yMin = lo - span * 0.05;
  const yMax = hi + span * 0.05;
  const x = (i: number) => pad.l + (i / Math.max(1, labels.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const path = (trail: (number | null)[]) =>
    trail
      .slice(0, last + 1)
      .map((v, i) => (v === null ? '' : `${i === 0 || trail[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .join('');
  const liveIdx = view.races.findIndex((r) => r.state === 'live');
  const pickedDrivers = picked.map((p) => ({ p, d: view.drivers.find((d) => d.carNumber === p.carNumber)! })).filter((x) => x.d);
  // Round ticks: the first step that gives about four gridlines.
  const step = [10, 20, 25, 50, 100, 200, 250, 500].find((st) => (yMax - yMin) / st <= 5) ?? 1000;
  const yTicks = Array.from({ length: Math.floor(yMax / step) - Math.ceil(yMin / step) + 1 }, (_, i) => (Math.ceil(yMin / step) + i) * step);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - pad.l) / (w - pad.l - pad.r)) * (labels.length - 1));
    setHover(i >= 0 && i < labels.length ? i : null);
  };

  return (
    <section className="panel span-2">
      <div className="panel-head">
        <h2>Points through the Chase</h2>
        <div className="chart-legend">
          {pickedDrivers.map(({ p, d }) => (
            <button key={p.carNumber} className="legend-chip" onClick={() => toggle(p.carNumber)} title="Remove from the chart">
              <i style={{ background: lineSeries.dark[p.slot] }} /> #{d.carNumber} {d.lastName} ×
            </button>
          ))}
          <span className="legend-chip muted">
            <i className="legend-gray" /> Rest of the Chase field
          </span>
        </div>
      </div>
      <div ref={ref} className="chart">
        {w > 0 && (
          <svg width={w} height={H} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Chase points after each race">
            {yTicks.map((t) => (
              <g key={t}>
                <line className="chart-grid" x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} />
                <text className="chart-tick" x={pad.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
                  {Math.round(t)}
                </text>
              </g>
            ))}
            {labels.map((l, i) => (
              <text key={l + i} className="chart-tick" x={x(i)} y={H - 8} textAnchor="middle">
                {i === liveIdx + 1 ? `${l} (live)` : l}
              </text>
            ))}
            {view.drivers
              .filter((d) => !picked.some((p) => p.carNumber === d.carNumber))
              .map((d) => (
                <path key={d.carNumber} className="chase-line-rest" d={path(d.trail)} fill="none" onClick={() => toggle(d.carNumber)} />
              ))}
            {pickedDrivers.map(({ p, d }) => (
              <path key={p.carNumber} d={path(d.trail)} fill="none" stroke={lineSeries.dark[p.slot]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {endLabels(
              pickedDrivers.flatMap(({ p, d }) => {
                const v = d.trail[last];
                return v != null ? [{ key: p.carNumber, name: d.lastName, x: x(last) + 8, y: y(v) }] : [];
              }),
            ).map((l) => (
              <text key={l.key} className="chart-label" x={l.x} y={l.y} dominantBaseline="middle">
                {l.name}
              </text>
            ))}
            {hover !== null && <line className="chart-crosshair" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} />}
            {hover !== null &&
              pickedDrivers.map(({ p, d }) => {
                const v = d.trail[hover];
                return v != null ? <circle key={p.carNumber} cx={x(hover)} cy={y(v)} r={4} fill={lineSeries.dark[p.slot]} stroke="var(--surface)" strokeWidth={2} /> : null;
              })}
          </svg>
        )}
        {hover !== null && pickedDrivers.length > 0 && (
          <div className="chart-tip" style={{ left: Math.min(x(hover) + 12, w - 190) }}>
            <strong>{labels[hover]}</strong>
            {[...pickedDrivers]
              .sort((a, b) => (b.d.trail[hover] ?? 0) - (a.d.trail[hover] ?? 0))
              .map(({ p, d }) => (
                <div key={p.carNumber}>
                  <i style={{ background: lineSeries.dark[p.slot] }} /> {d.lastName} <span className="num">{d.trail[hover] ?? '–'}</span>
                </div>
              ))}
          </div>
        )}
      </div>
      <p className="chart-axis-label">Points after each race{liveIdx >= 0 ? '; the live race is as they run' : ''}. Start is the reset at the beginning of the Chase.</p>
    </section>
  );
}

export function ChaseTab({ seriesId }: { seriesId: string }) {
  const { data: view, error } = useSeriesApi(api.chaseSeason, seriesId);
  const [picked, setPicked] = useState<Picked[]>([]);
  // Default highlight: the top of the standings, once data arrives.
  useEffect(() => {
    if (view && picked.length === 0 && view.drivers.length) {
      setPicked(view.drivers.slice(0, MAX_PICKED).map((d, i) => ({ carNumber: d.carNumber, slot: i })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const toggle = (car: string) =>
    setPicked((cur) => {
      if (cur.some((p) => p.carNumber === car)) return cur.filter((p) => p.carNumber !== car);
      // Full: the oldest pick makes room. The new one takes the first free color.
      const kept = cur.length >= MAX_PICKED ? cur.slice(1) : cur;
      const used = new Set(kept.map((p) => p.slot));
      const slot = Array.from({ length: MAX_PICKED }, (_, i) => i).find((i) => !used.has(i)) ?? 0;
      return [...kept, { carNumber: car, slot }];
    });

  if (error) return <DataError error={error} />;
  if (!view) return null;
  if (view.status === 'not-started') {
    return (
      <div className="tab-grid">
        <section className="panel span-2">
          <div className="panel-head">
            <h2>Chase</h2>
          </div>
          {view.notes.map((n) => (
            <p key={n} className="muted">
              {n}
            </p>
          ))}
        </section>
      </div>
    );
  }
  return (
    <div className="tab-grid chase-tab">
      <Summary view={view} />
      <Standings view={view} picked={picked} toggle={toggle} />
      <PointsChart view={view} picked={picked} toggle={toggle} />
      <RaceGrid view={view} />
      <ul className="dash-notes span-2">
        {view.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

