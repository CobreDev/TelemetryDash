import { useContext } from 'react';
import { api } from './api';
import { CarCell, NameCell, rowClass } from './DriverCell';
import { DataError } from './NoLive';
import { SourceContext, useSeriesApi } from './useApi';

export function FuelTab({ seriesId }: { seriesId: string }) {
  const { data, error } = useSeriesApi(api.fuel, seriesId);
  const { useSample } = useContext(SourceContext);
  if (error) return <DataError error={error} onUseSample={useSample} />;
  if (!data) return null;
  return (
    <div className="overview-view">
      <section className="panel">
        <div className="panel-head">
          <h2>Fuel window</h2>
        </div>
        <div className="table-scroll">
          <table className="dash-table">
            <thead>
              <tr>
                <th className="shrink">Pos</th>
                <th className="shrink">Car</th>
                <th className="left">Driver</th>
                <th className="shrink">Since pit</th>
                <th className="left gauge-head">Est. fuel</th>
                <th className="shrink" title="Green-flag laps of fuel left">Laps left</th>
                <th className="left">Reaches</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.carNumber} className={rowClass(r)}>
                  <td className="num">{r.position}</td>
                  <CarCell who={r} />
                  <NameCell who={r} short />
                  <td className="num">{r.sincePit}</td>
                  <td className="left">
                    <span className="gauge" aria-hidden>
                      {r.fuelValue !== null && <span style={{ width: `${r.fuelValue * 100}%` }} />}
                    </span>
                    <span className="gauge-label">{r.fuel}</span>
                  </td>
                  <td className="num">{r.lapsLeft}</td>
                  <td className={`left nowrap status-${r.reachesStatus}`}>{r.reaches}</td>
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
