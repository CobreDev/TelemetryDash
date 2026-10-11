import { api } from './api';
import { CarCell, NameCell, rowClass } from './DriverCell';
import { useSeriesApi } from './useApi';

/** Fastest driver leaderboard for the Pace tab (fastest single lap: time and average speed). */
export function TopSpeedCard({ seriesId }: { seriesId: string }) {
  const { data } = useSeriesApi(api.topSpeed, seriesId);
  if (!data) return null;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Fastest driver</h2>
      </div>
      <table className="dash-table">
        <thead>
          <tr>
            <th className="shrink">Pos</th>
            <th className="shrink">Car</th>
            <th className="left">Driver</th>
            <th className="shrink" title="The car's fastest lap">Time</th>
            <th className="shrink" title="Average speed of the car's fastest lap">Avg MPH</th>
            <th className="shrink">Lap</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.carNumber} className={[rowClass(r), r.rank === 1 && 'is-leader'].filter(Boolean).join(' ') || undefined}>
              <td className="num">{r.rank}</td>
              <CarCell who={r} />
              <NameCell who={r} short />
              <td className="num">{r.time}</td>
              <td className="num">{r.speed}</td>
              <td className="num muted">{r.lap}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="dash-notes">
        {data.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  );
}
