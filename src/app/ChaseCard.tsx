import { api } from './api';
import { CarNumber } from './CarNumber';
import { useSeriesApi } from './useApi';

/** Chase standings entering the race and as they run. Hidden for races without Chase data. */
export function ChaseCard({ seriesId }: { seriesId: string }) {
  const { data: view } = useSeriesApi(api.chase, seriesId);

  if (!view) return null;
  return (
    <section className="panel chase-card">
      <div className="panel-head">
        <h2>{view.title}</h2>
      </div>
      <table className="dash-table chase-table">
        <thead>
          <tr>
            <th className="shrink">{view.columns.rank}</th>
            <th className="shrink" title="Projected move if the race ended now">{view.columns.change}</th>
            <th className="shrink">{view.columns.car}</th>
            <th className="left">{view.columns.name}</th>
            <th className="shrink" title="Current running position">{view.columns.running}</th>
            <th className="shrink" title="Points entering this race">{view.columns.points}</th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((r) => (
            <tr key={r.carNumber}>
              <td className="num">{r.rank}</td>
              <td className={`num change-${r.changeDir}`} title={`P${r.liveRank} if the race ended now`}>
                {r.change}
              </td>
              <td className="car">
                <CarNumber number={r.carNumber} badge={r.carBadge} />
              </td>
              <td className="left">
                <span className="dash-last">{r.lastName}</span>
              </td>
              <td className="num muted">{r.running}</td>
              <td className="num" title={`${r.livePoints} if the race ended now (${r.earned})`}>
                {r.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="dash-notes">
        {view.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  );
}
