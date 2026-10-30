import { useEffect, useState } from 'react';
import { api, type LiveStatus } from './api';

/** The Live badge turns amber when the server hasn't reached NASCAR's feed for this long. */
const STALE_MS = 30_000;
/** Nothing running: just often enough to notice a session starting (the server checks once a minute). */
const IDLE_MS = 15_000;
/** A session running: a cheap check of the server's in-memory status; views refresh on new data. */
const LIVE_MS = 2_000;

export type LiveState = ReturnType<typeof useLiveStatus>;

/**
 * What's live (any series), polled from the server. `stale` is about the connection to NASCAR,
 * not laps: qualifying or a red flag can go a long time without a lap while data is current.
 */
export function useLiveStatus() {
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [skew, setSkew] = useState(0); // server clock minus ours
  const [now, setNow] = useState(Date.now());
  const active = !!live?.active;

  useEffect(() => {
    const load = () =>
      api.live().then(
        (r) => {
          setLive(r.live);
          setSkew(r.now - Date.now());
        },
        () => setLive(null),
      );
    void load();
    const poll = setInterval(load, active ? LIVE_MS : IDLE_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [active]);

  return { live, stale: live ? now + skew - live.polledAt > STALE_MS : false };
}
