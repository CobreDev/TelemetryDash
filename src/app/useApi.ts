import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isNoLive } from './api';

/**
 * A live session: views refresh as soon as the server reports new data (`liveDataAt`), with
 * this as a fallback in case a change is missed.
 */
export const LIVE_REFRESH_MS = 30_000;
/** Nothing live for the series (upcoming, final, off-week): this often, without pinging away. */
export const IDLE_REFRESH_MS = 60_000;

/** Which series has a session running right now (null when none), and when its data last changed. */
export const LiveContext = createContext<{ liveSeriesId: string | null; liveDataAt?: number }>({ liveSeriesId: null });

/**
 * Loads a series view. The series with a session running refreshes whenever the server reports
 * new data (plus every LIVE_REFRESH_MS as a fallback); other series every IDLE_REFRESH_MS.
 * Refreshes keep the last data on screen (no flicker); a series change clears it. A refresh
 * that fails (the server restarting, a network blip) also keeps it, and the next one catches
 * up; only "nothing live" replaces it.
 */
export function useSeriesApi<T>(fetcher: (seriesId: string) => Promise<T>, seriesId: string) {
  const { liveSeriesId, liveDataAt } = useContext(LiveContext);
  const isLiveSeries = liveSeriesId === seriesId;
  const refreshMs = isLiveSeries ? LIVE_REFRESH_MS : IDLE_REFRESH_MS;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const keyRef = useRef(seriesId);
  const hasData = useRef(false);
  /** When this view last loaded; the fallback timer skips a refresh that just happened. */
  const loadedAt = useRef(0);

  const load = (key: string, isCurrent: () => boolean) =>
    fetcher(key).then(
      (d) => isCurrent() && ((hasData.current = true), (loadedAt.current = Date.now()), setData(d), setError(null)),
      (e) => isCurrent() && (!hasData.current || isNoLive(e)) && setError(e),
    );

  useEffect(() => {
    // A new series starts empty; a change of refresh rate (a session starting or ending)
    // keeps what's on screen.
    if (keyRef.current !== seriesId) {
      keyRef.current = seriesId;
      setData(null);
      setError(null);
      hasData.current = false;
    }
    let active = true;
    const isCurrent = () => active && keyRef.current === seriesId;
    void load(seriesId, isCurrent);
    const timer = setInterval(() => Date.now() - loadedAt.current > refreshMs - 1_000 && load(seriesId, isCurrent), refreshMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, refreshMs]);

  // The live series: fetch again the moment the server has new data.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!isLiveSeries || !liveDataAt) return;
    const key = seriesId;
    void load(key, () => keyRef.current === key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDataAt]);

  return { data, error };
}
