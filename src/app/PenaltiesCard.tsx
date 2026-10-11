import { api } from './api';
import { CarCell, NameCell } from './DriverCell';
import { useSeriesApi } from './useApi';

/** Penalties from NASCAR's race notes, newest first; sits between Race control and Chase. */
export function PenaltiesCard({ seriesId }: { seriesId: string }) {
  const { data } = useSeriesApi(api.penalties, seriesId);
  if (!data) return null;
  return (
    <section className="panel penalties">
      <div className="panel-head">
        <h2>{data.title}</h2>
      </div>
      {data.rows.length === 0 ? (
        <p className="muted">No penalties.</p>
      ) : (
        <div className="table-scroll penalties-scroll">
          <table className="dash-table">
            <thead>
              <tr>
                <th className="shrink">Car</th>
                <th className="left">Driver</th>
                <th className="left">Penalty</th>
                <th className="left">Punishment</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} title={`Lap ${r.lap}`}>
                  <CarCell who={r} />
                  <NameCell who={r} short />
                  <td className="left">{r.penalty}</td>
                  <td className="left muted" title={r.punishmentStated ? 'As NASCAR’s note states' : 'NASCAR’s standard for the flag'}>
                    {r.punishment}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.notes.length > 0 && (
        <ul className="dash-notes">
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
