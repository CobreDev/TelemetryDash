import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isNoLive, type Source } from './api';

/** A live session: views refresh this often. */
export const LIVE_REFRESH_MS = 5_000;
/** Nothing live for the series (upcoming, final, off-week): this often, without pinging away. */
export const IDLE_REFRESH_MS = 60_000;

/**
 * Which data source the dashboard shows, and which series has a session running right now
 * (live mode; null when none). Views refresh fast only for that series.
 */
export const SourceContext = createContext<{ source: Source; liveSeriesId: string | null }>({ source: 'live', liveSeriesId: null });

/**
 * Loads a series view from the current source, refreshing on an interval in live mode: every
 * LIVE_REFRESH_MS while the series has a session running, else every IDLE_REFRESH_MS.
 * Refreshes keep the last data on screen (no flicker); a series or source change clears it.
 * A refresh that fails (the server restarting, a network blip) also keeps it, and the next
 * refresh catches up; only "nothing live" replaces it.
 */
export function useSeriesApi<T>(fetcher: (seriesId: string, source: Source) => Promise<T>, seriesId: string) {
  const { source, liveSeriesId } = useContext(SourceContext);
  const refreshMs = source !== 'live' ? 0 : liveSeriesId === seriesId ? LIVE_REFRESH_MS : IDLE_REFRESH_MS;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const key = `${seriesId}|${source}`;
  const keyRef = useRef(key);
  const hasData = useRef(false);

  useEffect(() => {
    // A new series or source starts empty; a change of refresh rate (a session starting or
    // ending) keeps what's on screen.
    if (keyRef.current !== key) {
      keyRef.current = key;
      setData(null);
      setError(null);
      hasData.current = false;
    }
    let live = true;
    const load = () =>
      fetcher(seriesId, source).then(
        (d) => live && keyRef.current === key && ((hasData.current = true), setData(d), setError(null)),
        (e) => live && keyRef.current === key && (!hasData.current || isNoLive(e)) && setError(e),
      );
    void load();
    const timer = refreshMs ? setInterval(load, refreshMs) : undefined;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshMs]);

  return { data, error };
}
