import { useCallback, useState } from 'react';

/**
 * Tracks whether an <img> has finished loading, so it can fade in instead of popping.
 * Also catches images that were already complete (browser cache) before React's onLoad.
 */
export function useImageLoaded() {
  const [loaded, setLoaded] = useState(false);
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);
  return { loaded, ref, onLoad: () => setLoaded(true) };
}
