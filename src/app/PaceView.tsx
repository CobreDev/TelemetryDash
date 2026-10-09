import type { PaceRankingsCard as Model } from '../cards/paceRankings.model';
import { CarNumber } from './CarNumber';
import { TopSpeedCard } from './TopSpeedCard';
import { useUniformNameWrap } from './useUniformNameWrap';

export function PaceView({ card }: { card: Model }) {
  const { tableRef, wrapped } = useUniformNameWrap([card]);
  return (
    <div className="pace-view">
      <section className="panel">
        <div className="panel-head">
          <h2>Pace rankings</h2>
        </div>
        <table ref={tableRef} className={`dash-table${wrapped ? ' names-wrapped' : ''}`}>
          <thead>
            <tr>
              <th className="shrink" title="Position">
                {card.columns.pos}
              </th>
              <th className="shrink">{card.columns.car}</th>
              <th className="left">{card.columns.name}</th>
              <th className="shrink">{card.columns.score}</th>
              <th className="shrink">{card.columns.gap}</th>
            </tr>
          </thead>
          <tbody>
            {card.rows.map((r) => (
              <tr
                key={r.carNumber}
                className={[r.isLeader && 'is-leader', r.excluded && 'is-excluded', r.highlight && 'is-highlight'].filter(Boolean).join(' ') || undefined}
                title={r.excluded ? `Not ranked: ${r.excluded}` : undefined}
              >
                <td className="num">{r.rank ?? '\u2013'}</td>
                <td className="car">
                  <CarNumber number={r.carNumber} badge={r.carBadge} />
                </td>
                <td className="left">
                  <span className="dash-first">{r.firstName}</span>
                  <span className="dash-last">
                    {r.lastName}
                    {r.markers.length > 0 && <span className="dash-marker"> {r.markers.join(' ')}</span>}
                  </span>
                </td>
                <td className="num">{r.score}</td>
                <td className={`num${r.isLeader ? ' good' : ''}`}>{r.gapPercent}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="dash-notes">
          {card.footer.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
      <TopSpeedCard seriesId={card.seriesId} />
    </div>
  );
}
