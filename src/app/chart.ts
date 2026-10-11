// Small helpers shared by the SVG charts (Compare, Chase).
import { useLayoutEffect, useRef, useState } from 'react';

/** Spreads right-end labels so lines that finish close together don't overprint. */
export function endLabels<T extends { y: number }>(labels: T[], gap = 15): T[] {
  const out = [...labels].sort((a, b) => a.y - b.y).map((l) => ({ ...l }));
  for (let i = 1; i < out.length; i++) out[i]!.y = Math.max(out[i]!.y, out[i - 1]!.y + gap);
  return out;
}

export function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setW(ref.current.clientWidth); // measure now; the observer only reports later changes
    const ro = new ResizeObserver(([e]) => e && setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}
