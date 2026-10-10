import type { QualifyingView } from '../cards/qualifying.model';
import { CarNumber } from './CarNumber';
import { useUniformNameWrap } from './useUniformNameWrap';

/** Qualifying (or the rulebook lineup), in the large card where Last Race usually sits. */
export function QualifyingCard({ view }: { view: QualifyingView }) {
  const { tableRef, wrapped } = useUniformNameWrap([view]);
  const c = view.columns;
  return (
    <section className="panel qualifying-card">
      <div className="panel-head">
        <h2>{view.title}</h2>
        <span className={`chip qual-chip qual-${view.status}`}>{view.label}</span>
      </div>
      {view.pole && <p className="card-sub qual-pole">{view.pole}</p>}
      <div className="table-scroll">
        <table ref={tableRef} className={`dash-table${wrapped ? ' names-wrapped' : ''}`}>
          <thead>
            <tr>
              <th className="shrink">{c.pos}</th>
              <th className="shrink">{c.car}</th>
              <th className="left">{c.name}</th>
              {view.timed && <th className="shrink">{c.time}</th>}
              {view.timed && <th className="shrink" title="Speed of the best lap (mph)">{c.speed}</th>}
              {view.timed && <th className="shrink" title="Gap to the pole">{c.gap}</th>}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.carNumber} className={[r.isPole && 'is-leader', r.highlight && 'is-highlight'].filter(Boolean).join(' ') || undefined}>
                <td className="num">{r.position}</td>
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
                {view.timed && <td className="num">{r.time}</td>}
                {view.timed && <td className="num">{r.speed}</td>}
                {view.timed && <td className="num">{r.gap}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.notes.length > 0 && (
        <ul className="dash-notes">
          {view.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
