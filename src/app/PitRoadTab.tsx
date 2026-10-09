import type { PitRoadView } from '../cards/tabs.model';
import { api } from './api';
import { CarCell, NameCell, rowClass } from './DriverCell';
import { DataError } from './NoLive';
import { useSeriesApi } from './useApi';

function AverageTable({ title, rows }: { title: string; rows: PitRoadView['fourTire'] }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="muted">No stops of this kind yet.</p>
      ) : (
        <table className="dash-table">
          <thead>
            <tr>
              <th className="shrink">Pos</th>
              <th className="shrink">Car</th>
              <th className="left">Driver</th>
              <th className="shrink">Avg</th>
              <th className="shrink">Best</th>
              <th className="shrink">Stops</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.carNumber} className={[rowClass(r), r.rank === 1 && 'is-leader'].filter(Boolean).join(' ') || undefined}>
                <td className="num">{r.rank}</td>
                <CarCell who={r} />
                <NameCell who={r} short />
                <td className="num">{r.average}</td>
                <td className="num">{r.best}</td>
                <td className="num">{r.stops}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function PitRoadTab({ seriesId }: { seriesId: string }) {
  const { data, error } = useSeriesApi(api.pitRoad, seriesId);
  if (error) return <DataError error={error} />;
  if (!data) return null;
  return (
    <div className="tab-grid">
      <section className="panel span-2">
        <div className="panel-head">
          <h2>Latest stops</h2>
        </div>
        <div className="table-scroll">
          <table className="dash-table">
            <thead>
              <tr>
                <th className="shrink">Lap</th>
                <th className="shrink">Car</th>
                <th className="left">Driver</th>
                <th className="shrink">Service</th>
                <th className="shrink" title="Time stopped in the box">Box</th>
                <th className="shrink" title="Pit road entry to exit">Lane</th>
                <th className="shrink" title="Positions gained or lost">±</th>
              </tr>
            </thead>
            <tbody>
              {data.latest.map((r, i) => (
                <tr key={i} className={rowClass(r)}>
                  <td className="num">
                    <span className={`flag-dot flag-${r.flag}`} title={r.flag === 'green' ? 'Under green' : 'Under caution'} />
                    {r.lap}
                  </td>
                  <CarCell who={r} />
                  <NameCell who={r} short />
                  <td className="nowrap">{r.kind}</td>
                  <td className="num">{r.box}</td>
                  <td className="num">{r.lane}</td>
                  <td className={`num change-${r.gainedDir}`}>{r.gained}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <AverageTable title="Four-tire averages" rows={data.fourTire} />
      <AverageTable title="Two-tire averages" rows={data.twoTire} />
      <ul className="dash-notes span-2">
        {data.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
