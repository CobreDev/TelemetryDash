import { useEffect, useState } from 'react';
import { api, type UpcomingRace } from './api';
import { etParts } from './NoLive';
import { TrackLogo } from './TrackLogo';
import { TvLogo } from './TvLogo';

/**
 * Header for a series with nothing live: its next race, laid out like the live header
 * (logo, name, location) with start time, length and stages where the lap counter goes.
 */
export function UpcomingHeader({ seriesId }: { seriesId: string }) {
  const [race, setRace] = useState<UpcomingRace | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setRace(null);
    setFailed(false);
    api.upcoming(seriesId).then(setRace, () => setFailed(true));
  }, [seriesId]);

  if (failed) return <span className="race-location">No upcoming race on the schedule</span>;
  if (!race) return null;
  const { day, time } = etParts(race.startsET);
  const lines: [string, string][] = [
    [day, time],
    [`${race.laps} laps`, race.miles ? `${race.miles} mi` : ''],
  ];
  if (race.stageLaps.length) lines.push(['Stages', race.stageLaps.join(' | ')]);
  return (
    <>
      <div className="race-summary">
        {race.logoUrl && <TrackLogo url={race.logoUrl} alt={race.venue} />}
        <div className="race-info">
          <div className="race-title">
            <span className="race-name">{race.raceName}</span>
            {race.location && <span className="race-location">{race.location}</span>}
          </div>
          <div className="race-status is-upcoming" role="group" aria-label="Upcoming race">
            <div className="race-status-lines">
              {lines.map(([label, value], i) => (
                <div key={i} className={`race-status-line${i === 0 ? ' is-primary' : ''}`}>
                  <span className="race-status-label">{label}</span>
                  <span className="race-status-value upcoming-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="race-badges">
        {race.tv && <TvLogo network={race.tv} />}
        <span className="chip upcoming-chip" title="Not running yet">
          Upcoming
        </span>
      </div>
    </>
  );
}
