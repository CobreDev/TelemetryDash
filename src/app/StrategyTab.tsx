import type { Stint } from '../data/nascar/stops';
import { strategy } from '../tokens/tokens';
import { api } from './api';
import { CarCell, NameCell, rowClass } from './DriverCell';
import { DataError } from './NoLive';
import { useSeriesApi } from './useApi';
import { useUniformNameWrap } from './useUniformNameWrap';

const STINT_COLOR: Record<Stint['start'], string> = {
  start: strategy.start,
  four: strategy.fourTire,
  two: strategy.twoTire,
  fuel: strategy.fuelOnly,
};
const STINT_LABEL: Record<Stint['start'], string> = { start: 'Start', four: '4 tires', two: '2 tires', fuel: 'Fuel only' };

function StintBar({ stints, totalLaps, stageEnds }: { stints: Stint[]; totalLaps: number; stageEnds: number[] }) {
  const pct = (lap: number) => `${(lap / totalLaps) * 100}%`;
  return (
    <div className="stint-bar">
      {stints.map((s) => (
        <span
          key={s.fromLap}
          className="stint"
          style={{ left: pct(s.fromLap - 1), width: `calc(${pct(s.toLap - s.fromLap + 1)} - 2px)`, background: STINT_COLOR[s.start] }}
          title={`Laps ${s.fromLap}–${s.toLap} (${s.toLap - s.fromLap + 1}) · ${s.start === 'start' ? 'from the start' : `after ${STINT_LABEL[s.start].toLowerCase()}`}`}
        />
      ))}
      {stageEnds.map((lap) => (
        <span key={lap} className="stint-notch" style={{ left: pct(lap) }} title={`Stage end, lap ${lap}`} />
      ))}
    </div>
  );
}

export function StrategyTab({ seriesId }: { seriesId: string }) {
  const { data, error } = useSeriesApi(api.strategy, seriesId);
  // Full names; the whole table switches to two-line names together when they don't fit.
  const { tableRef, wrapped } = useUniformNameWrap([data]);
  if (error) return <DataError error={error} />;
  if (!data) return null;
  return (
    <div className="overview-view">
      <section className="panel">
        <div className="panel-head">
          <h2>Strategy</h2>
          <div className="legend" aria-label="Stint colors">
            {(Object.keys(STINT_LABEL) as Stint['start'][]).map((k) => (
              <span key={k}>
                <i style={{ background: STINT_COLOR[k] }} />
                {STINT_LABEL[k]}
              </span>
            ))}
          </div>
        </div>
        <div className="table-scroll">
          <table ref={tableRef} className={`dash-table strategy-table${wrapped ? ' names-wrapped' : ''}`}>
            <thead>
              <tr>
                <th className="shrink">Pos</th>
                <th className="shrink">Car</th>
                <th className="left fit">Driver</th>
                {/* The bars give up width so names stay on one line; 160 matches .stint-cell. */}
                <th className="left stint-head" data-min-width="160">
                  Stints · lap {data.atLap} of {data.totalLaps}
                </th>
                <th className="shrink">Stops</th>
                <th className="shrink" title="Total time on pit road">Lane</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.carNumber} className={rowClass(r)}>
                  <td className="num">{r.position}</td>
                  <CarCell who={r} />
                  <NameCell who={r} />
                  <td className="stint-cell">
                    <StintBar stints={r.stints} totalLaps={data.totalLaps} stageEnds={data.stageEnds} />
                  </td>
                  <td className="num">{r.stops}</td>
                  <td className="num">{r.laneTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="dash-notes">
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
