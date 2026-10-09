import { api, isNoLive } from './api';
import { CarNumber } from './CarNumber';
import { ChaseCard, ChaseStandingsCard } from './ChaseCard';
import { RaceControlCard } from './RaceControlCard';
import { DataError } from './NoLive';
import { useSeriesApi } from './useApi';
import { useUniformNameWrap } from './useUniformNameWrap';
import { ResultsCard, ScheduleCard } from './WeekendCards';

export function OverviewTab({ seriesId }: { seriesId: string }) {
  const { data: view, error } = useSeriesApi(api.overview, seriesId);
  const practice = view?.mode === 'practice';
  const { tableRef, wrapped } = useUniformNameWrap([view]);

  // Nothing live for this series: the coming weekend's schedule and last race's results.
  if (isNoLive(error)) {
    return (
      <div className="overview-view is-overview is-offweek">
        <ScheduleCard seriesId={seriesId} />
        <ResultsCard seriesId={seriesId} />
        <ChaseStandingsCard seriesId={seriesId} />
      </div>
    );
  }

  return (
    <div className="overview-view is-overview">
      <section className="panel">
        <div className="panel-head">
          <h2>{view?.mode === 'practice' ? 'Practice timing' : 'Running order'}</h2>
        </div>
        {error != null && <DataError error={error} />}
        {view && (
          <>
            <div className="table-scroll">
              <table ref={tableRef} className={`dash-table${wrapped ? ' names-wrapped' : ''}`}>
                <thead>
                  <tr>
                    <th className="shrink" title="Position">{view.columns.pos}</th>
                    <th className="shrink">{view.columns.car}</th>
                    <th className="left">{view.columns.name}</th>
                    <th className="shrink">{view.columns.lastLap}</th>
                    <th className="shrink">{view.columns.gap}</th>
                    <th className="shrink" title="Gap to the car ahead">{view.columns.interval}</th>
                    <th className="shrink" title="Laps since last pit stop">{view.columns.pit}</th>
                    {!practice && <th className="shrink" title="Modeled, see note below">{view.columns.fuel}</th>}
                    {!practice && <th className="shrink" title="Average lap time over the last 10 laps">{view.columns.avgLap}</th>}
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((r) => (
                    <tr
                      key={r.carNumber}
                      className={[r.isLeader && 'is-leader', r.out && 'is-excluded', r.highlight && 'is-highlight'].filter(Boolean).join(' ') || undefined}
                    >
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
                      <td className="num">{r.lastLap}</td>
                      <td className="num">{r.gapToLeader}</td>
                      <td className="num">{r.interval}</td>
                      <td className="num">{r.lapsSincePit}</td>
                      {!practice && <td className="num">{r.fuel}</td>}
                      {!practice && <td className="num">{r.avgLap}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="dash-notes">
              {view.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </>
        )}
      </section>
      {/* Right column, the same 420px as off-week: race control above the Chase standings. */}
      <div className="overview-side">
        {!practice && <RaceControlCard seriesId={seriesId} />}
        <ChaseCard seriesId={seriesId} />
      </div>
    </div>
  );
}
