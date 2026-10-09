import type { ChaseView } from '../cards/chase.model';
import { api } from './api';
import { CarNumber } from './CarNumber';
import { useSeriesApi } from './useApi';
import { useOnce } from './WeekendCards';

/** Chase standings entering the race and as they run. Hidden for races without Chase data. */
export function ChaseCard({ seriesId }: { seriesId: string }) {
  const { data: view } = useSeriesApi(api.chase, seriesId);
  return view ? <ChasePanel view={view} /> : null;
}

/** Off-week: standings after the last race. Hidden for series without Chase data. */
export function ChaseStandingsCard({ seriesId }: { seriesId: string }) {
  const { data: view, failed } = useOnce(api.chaseStandings, seriesId);
  if (failed) return null;
  // Hold the card's place while loading so the other two cards don't shift when it arrives.
  if (!view) {
    return (
      <section className="panel chase-card is-pending" aria-busy>
        <div className="panel-head">
          <h2>Chase standings</h2>
        </div>
      </section>
    );
  }
  return <ChasePanel view={view} />;
}

function ChasePanel({ view }: { view: ChaseView }) {
  return (
    <section className="panel chase-card">
      <div className="panel-head">
        <h2>{view.title}</h2>
      </div>
      <table className="dash-table chase-table">
        <thead>
          <tr>
            <th className="shrink">{view.columns.rank}</th>
            <th className="shrink" title={view.hints.change}>{view.columns.change}</th>
            <th className="shrink" title={view.hints.running}>{view.columns.running}</th>
            <th className="shrink">{view.columns.car}</th>
            <th className="left">{view.columns.name}</th>
            <th className="shrink" title={view.hints.points}>{view.columns.points}</th>
            <th className="shrink" title={view.hints.gain}>{view.columns.gain}</th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((r) => (
            <tr key={r.carNumber}>
              <td className="num">{r.rank}</td>
              <td className={`num change-${r.changeDir}`} title={view.mode === 'live' ? `P${r.liveRank} if the race ended now` : undefined}>
                {r.change}
              </td>
              <td className="num muted">{r.running}</td>
              <td className="car">
                <CarNumber number={r.carNumber} badge={r.carBadge} />
              </td>
              <td className="left">
                <span className="dash-last">{r.lastName}</span>
              </td>
              <td className="num" title={view.mode === 'live' ? `${r.livePoints} if the race ended now` : undefined}>
                {r.points}
              </td>
              <td className="num chase-gain">{r.earned}</td>
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
