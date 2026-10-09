import { easternToEpoch } from '../data/nascar/feed';
import { isNoLive, type NoLiveSession } from './api';
import { clockET } from './time';

const SERIES_NAME: Record<string, string> = { cup: 'Cup Series', oreilly: "O'Reilly Auto Parts Series", craftsman: 'Craftsman Truck Series' };

/** "2026-10-11T15:00:00" (US Eastern) -> { day: "Sun, Oct 11", time: "3:00 PM ET" }. */
export function etParts(s: string): { day: string; time: string } {
  const [day, time] = formatET(s).split(' · ');
  return { day: day!, time: time! };
}

/** "2026-10-11T15:00:00" (schedule times are US Eastern) -> "Sun, Oct 11 · 3:00 PM ET". */
export function formatET(s: string): string {
  const [y, m, d] = s.split('T')[0]!.split('-').map(Number);
  const day = new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${day} · ${clockET(easternToEpoch(s))}`;
}

/** Explains an error from a live view: nothing live for this series, or data unavailable. */
export function DataError({ error }: { error: unknown }) {
  if (!isNoLive(error)) return <p className="error">Timing data is unavailable right now.</p>;
  const body: NoLiveSession = error.body;
  return (
    <section className="panel no-live">
      <h2>No live session for this series</h2>
      {body.live && (
        <p>
          Live now: <strong>{SERIES_NAME[body.live.seriesId] ?? body.live.seriesId}</strong> · {body.live.runName}
        </p>
      )}
      {body.next && (
        <p>
          Next race: <strong>{body.next.raceName}</strong> at {body.next.track}, {formatET(body.next.startsET)}
        </p>
      )}
    </section>
  );
}
