import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Source } from './api';

/** Which data source the dashboard shows, and how often live views refresh (0 = never). */
export const SourceContext = createContext<{ source: Source; refreshMs: number }>({ source: 'live', refreshMs: 0 });

/**
 * Loads a series view from the current source, refreshing on an interval in live mode.
 * Refreshes keep the last data on screen (no flicker); a series or source change clears it.
 */
export function useSeriesApi<T>(fetcher: (seriesId: string, source: Source) => Promise<T>, seriesId: string) {
  const { source, refreshMs } = useContext(SourceContext);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const key = `${seriesId}|${source}`;
  const keyRef = useRef(key);

  useEffect(() => {
    keyRef.current = key;
    setData(null);
    setError(null);
    let live = true;
    const load = () =>
      fetcher(seriesId, source).then(
        (d) => live && keyRef.current === key && (setData(d), setError(null)),
        (e) => live && keyRef.current === key && setError(e),
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
