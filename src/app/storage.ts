// Per-browser preferences (series, tab). Storage can be unavailable (private
// mode, blocked site data), so reads fall back to null and writes are best effort.

export function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* not available */
  }
}
