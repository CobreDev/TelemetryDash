import type { PaceRankingsCard } from '../cards/paceRankings.model';
import { isNoLive, type LiveStatus } from './api';
import { LapBar } from './LapBar';
import { RaceStatus } from './RaceStatus';
import { TrackLogo } from './TrackLogo';
import { TvLogo } from './TvLogo';
import { UpcomingHeader } from './UpcomingHeader';

interface Props {
  seriesId: string;
  card: (PaceRankingsCard & { final?: boolean }) | null;
  cardError: unknown;
  live: LiveStatus | null;
  stale: boolean;
}

/** Race name, location, lap counter, lap bar, TV network and status badge; Upcoming when idle. */
export function RaceHeader({ seriesId, card, cardError, live, stale }: Props) {
  if (!card) {
    // Hold the header's height while the first data loads, so the tabs don't jump.
    if (cardError == null) return <div className="race-meta" aria-hidden />;
    return (
      <div className="race-meta">
        {isNoLive(cardError) ? <UpcomingHeader seriesId={seriesId} /> : <span className="race-location">Timing data unavailable</span>}
      </div>
    );
  }
  const { header } = card;
  return (
    <div className="race-meta">
      <div className="race-summary">
        {header.logoUrl && <TrackLogo url={header.logoUrl} alt={header.venue} />}
        <div className="race-info">
          <div className="race-title">
            <span className="race-name">{header.raceName}</span>
            {header.location && <span className="race-location">{header.location}</span>}
          </div>
          <div className="race-progress">
            <RaceStatus lines={card.statusLines} flag={card.flag} />
            {card.progress && <LapBar segments={card.flagSegments} totalLaps={card.progress.totalLaps} stageEnds={card.stageEnds} />}
          </div>
        </div>
      </div>
      <div className="race-badges">
        {header.tv && <TvLogo network={header.tv} />}
        <StatusBadge live={live} stale={stale} seriesId={seriesId} final={card.final} />
      </div>
    </div>
  );
}

function StatusBadge({ live, stale, seriesId, final }: { live: LiveStatus | null; stale: boolean; seriesId: string; final?: boolean }) {
  if (final) return <span className="chip final-chip" title="This race is over; shown until Monday 00:00 ET">Final</span>;
  if (!live?.active || live.seriesId !== seriesId) return null;
  return (
    <span className={`chip live-chip${stale ? ' is-stale' : ''}`} title={stale ? "Can't reach NASCAR's live feed; data may be out of date" : 'Live feed connected'}>
      <i aria-hidden /> Live
    </span>
  );
}
