import { useEffect, useState } from 'react';
import type { ResultsView, ScheduleView } from '../cards/weekend.model';
import { api } from './api';
import { CarNumber } from './CarNumber';
import { clockET } from './time';
import { TvLogo } from './TvLogo';
import { useUniformNameWrap } from './useUniformNameWrap';

/** Loads once per series; these don't change during a session, so no polling. */
export function useOnce<T>(fetcher: (seriesId: string) => Promise<T>, seriesId: string) {
  const [state, setState] = useState<{ data: T | null; failed: boolean }>({ data: null, failed: false });
  useEffect(() => {
    let live = true;
    setState({ data: null, failed: false });
    fetcher(seriesId).then(
      (data) => live && setState({ data, failed: false }),
      () => live && setState({ data: null, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [fetcher, seriesId]);
  return state;
}

/** The next race weekend's on-track sessions, in Eastern time. */
export function ScheduleCard({ seriesId }: { seriesId: string }) {
  const { data, failed } = useOnce(api.schedule, seriesId);
  return (
    <section className="panel schedule-card">
      <div className="panel-head">
        <h2>{data?.title ?? 'Next Race'}</h2>
      </div>
      {failed && <p className="muted">No upcoming race on the schedule.</p>}
      {data && <ScheduleBody view={data} />}
    </section>
  );
}

function ScheduleBody({ view }: { view: ScheduleView }) {
  // Show the day once, on the first session of that day.
  let lastDay = '';
  return (
    <>
      <p className="card-sub">
        <strong>{view.raceName}</strong> · {view.venue}
      </p>
      {/* TV and radio right under the race, above the sessions. */}
      {(view.tv || view.radio) && (
        <div className="schedule-broadcast">
          {view.tv && <TvLogo network={view.tv} />}
          {view.radio && <span className="muted">Radio: {view.radio}</span>}
        </div>
      )}
      <table className="dash-table schedule-table">
        <tbody>
          {view.sessions.map((s) => {
            const day = s.day === lastDay ? '' : s.day;
            lastDay = s.day;
            return (
              <tr key={s.startsAt + s.name} className={[s.kind === 'race' && 'is-race', (s.done || s.cancelled) && 'is-done', s.cancelled && 'is-cancelled'].filter(Boolean).join(' ') || undefined}>
                <td className="left nowrap schedule-day">{day}</td>
                <td className="left">{s.name}</td>
                <td className="nowrap">{s.cancelled ? 'Cancelled' : s.done ? 'Done' : clockET(s.startsAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

/** Final results of the series' most recent race. */
export function ResultsCard({ seriesId }: { seriesId: string }) {
  const { data, failed } = useOnce(api.results, seriesId);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Last race</h2>
      </div>
      {failed && <p className="muted">Results aren't available right now.</p>}
      {data && <ResultsBody view={data} />}
    </section>
  );
}

function ResultsBody({ view }: { view: ResultsView }) {
  const { tableRef, wrapped } = useUniformNameWrap([view]);
  const c = view.columns;
  return (
    <>
      <p className="card-sub">
        <strong>{view.raceName}</strong> · {view.venue} · {view.date}
        <br />
        {view.summary}
      </p>
      <div className="table-scroll">
        <table ref={tableRef} className={`dash-table${wrapped ? ' names-wrapped' : ''}`}>
          <thead>
            <tr>
              <th className="shrink">{c.pos}</th>
              <th className="shrink">{c.car}</th>
              <th className="left">{c.name}</th>
              <th className="shrink" title="Starting position">{c.start}</th>
              <th className="shrink" title="Laps led">{c.led}</th>
              <th className="shrink">{c.status}</th>
              <th className="shrink" title="Points earned in this race">{c.points}</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.carNumber} className={[r.isWinner && 'is-leader', r.highlight && 'is-highlight'].filter(Boolean).join(' ') || undefined}>
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
                <td className="num">{r.start}</td>
                <td className="num">{r.led}</td>
                <td className="nowrap">{r.status}</td>
                <td className="num">{r.points}</td>
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
    </>
  );
}

/** Last race in the narrow right column (qualifying mode): the full field in a ~10-row scroll box. */
export function LastRaceMini({ seriesId }: { seriesId: string }) {
  const { data, failed } = useOnce(api.results, seriesId);
  if (failed) return null;
  return (
    <section className="panel last-race-mini">
      <div className="panel-head">
        <h2>Last Race</h2>
      </div>
      {data && (
        <>
          <p className="card-sub">
            <strong>{data.raceName}</strong> · {data.date}
          </p>
          <div className="scroll-box">
            <table className="dash-table chase-table">
              <thead>
                <tr>
                  <th className="shrink">{data.columns.pos}</th>
                  <th className="shrink">{data.columns.car}</th>
                  <th className="left">{data.columns.name}</th>
                  <th className="shrink" title="Laps led">{data.columns.led}</th>
                  <th className="shrink" title="Points earned in this race">{data.columns.points}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.carNumber} className={[r.isWinner && 'is-leader', r.highlight && 'is-highlight'].filter(Boolean).join(' ') || undefined}>
                    <td className="num">{r.position}</td>
                    <td className="car">
                      <CarNumber number={r.carNumber} badge={r.carBadge} />
                    </td>
                    <td className="left">
                      <span className="dash-last">{r.lastName}</span>
                    </td>
                    <td className="num">{r.led}</td>
                    <td className="num">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
