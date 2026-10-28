import { useEffect, useState } from 'react';
import type { ThemeName } from '../tokens/tokens';

const query = '(prefers-color-scheme: dark)';

/** Light or dark, following the system setting (and its changes) as Hairline does. */
export function useTheme(): ThemeName {
  const [dark, setDark] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(query);
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark ? 'dark' : 'light';
}
