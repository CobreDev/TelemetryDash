import { api, isNoLive } from './api';
import { CarNumber } from './CarNumber';
import { ChaseCard, ChaseStandingsCard } from './ChaseCard';
import { RaceControlCard } from './RaceControlCard';
import { DataError } from './NoLive';
import { useSeriesApi } from './useApi';
import { useUniformNameWrap } from './useUniformNameWrap';
import { LastRaceMini, ResultsCard, ScheduleCard } from './WeekendCards';
import { QualifyingCard } from './QualifyingCard';

/**
 * `showNextRace`: a finished race seen from the next day on also gets the Next Race card on top.
 * `final`: the race is over, so the running order is titled Results.
 */
export function OverviewTab({ seriesId, showNextRace, final }: { seriesId: string; showNextRace?: boolean; final?: boolean }) {
  const { data: view, error } = useSeriesApi(api.overview, seriesId);
  const practice = view?.mode === 'practice';
  const { tableRef, wrapped } = useUniformNameWrap([view]);
  // Qualifying for the next race (live, final, or a rulebook lineup); 404 means none yet.
  const { data: qualifying } = useSeriesApi(api.qualifying, seriesId);

  // Qualifying mode (no race running, qualifying live or done): the schedule, a large
  // Qualifying card, and on the right Chase standings over a slim Last Race.
  if (qualifying && (isNoLive(error) || view?.mode === 'practice')) {
    return (
      <div className="overview-view is-overview is-offweek">
        <ScheduleCard seriesId={seriesId} />
        <QualifyingCard view={qualifying} />
        <div className="offweek-side">
          <ChaseStandingsCard seriesId={seriesId} />
          <LastRaceMini seriesId={seriesId} />
        </div>
      </div>
    );
  }

  // Nothing live for this series: the coming weekend's schedule and last race's results.
  if (isNoLive(error)) {
    return (
      <div className="overview-view is-overview is-offweek">
        <ScheduleCard seriesId={seriesId} />
        <ResultsCard seriesId={seriesId} />
        <div className="offweek-side">
          <ChaseStandingsCard seriesId={seriesId} />
        </div>
      </div>
    );
  }

  return (
    <div className="overview-view is-overview">
      <div className="overview-main">
        {showNextRace && <ScheduleCard seriesId={seriesId} />}
        <section className="panel">
          <div className="panel-head">
            <h2>{view?.mode === 'practice' ? 'Practice timing' : final ? 'Results' : 'Running order'}</h2>
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
      </div>
      {/* Right column, the same 420px as off-week: race control above the Chase standings. */}
      <div className="overview-side">
        {!practice && <RaceControlCard seriesId={seriesId} />}
        <ChaseCard seriesId={seriesId} />
      </div>
    </div>
  );
}
