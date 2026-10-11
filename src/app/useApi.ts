import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isNoLive, type Source } from './api';

/**
 * A live session: views refresh as soon as the server reports new data (`liveDataAt`), with
 * this as a fallback in case a change is missed.
 */
export const LIVE_REFRESH_MS = 30_000;
/** Nothing live for the series (upcoming, final, off-week): this often, without pinging away. */
export const IDLE_REFRESH_MS = 60_000;

/**
 * Which data source the dashboard shows, and which series has a session running right now
 * (live mode; null when none). Views refresh fast only for that series.
 */
export const SourceContext = createContext<{ source: Source; liveSeriesId: string | null; liveDataAt?: number }>({
  source: 'live',
  liveSeriesId: null,
});

/**
 * Loads a series view from the current source. In live mode, the series with a session running
 * refreshes whenever the server reports new data (plus every LIVE_REFRESH_MS as a fallback);
 * other series refresh every IDLE_REFRESH_MS.
 * Refreshes keep the last data on screen (no flicker); a series or source change clears it.
 * A refresh that fails (the server restarting, a network blip) also keeps it, and the next
 * refresh catches up; only "nothing live" replaces it.
 */
export function useSeriesApi<T>(fetcher: (seriesId: string, source: Source) => Promise<T>, seriesId: string) {
  const { source, liveSeriesId, liveDataAt } = useContext(SourceContext);
  const isLiveSeries = source === 'live' && liveSeriesId === seriesId;
  const refreshMs = source !== 'live' ? 0 : isLiveSeries ? LIVE_REFRESH_MS : IDLE_REFRESH_MS;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const key = `${seriesId}|${source}`;
  const keyRef = useRef(key);
  const hasData = useRef(false);
  /** When this view last loaded; the fallback timer skips a refresh that just happened. */
  const loadedAt = useRef(0);

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
        (d) => live && keyRef.current === key && ((hasData.current = true), (loadedAt.current = Date.now()), setData(d), setError(null)),
        (e) => live && keyRef.current === key && (!hasData.current || isNoLive(e)) && setError(e),
      );
    void load();
    const timer = refreshMs ? setInterval(() => Date.now() - loadedAt.current > refreshMs - 1_000 && load(), refreshMs) : undefined;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshMs]);

  // The live series: fetch again the moment the server has new data.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!isLiveSeries || !liveDataAt) return;
    const k = key;
    fetcher(seriesId, source).then(
      (d) => keyRef.current === k && ((hasData.current = true), (loadedAt.current = Date.now()), setData(d), setError(null)),
      (e) => keyRef.current === k && (!hasData.current || isNoLive(e)) && setError(e),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDataAt]);

  return { data, error };
}
