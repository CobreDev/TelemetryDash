/** Car numbers sort numerically, then by string so "0" precedes "00". */
export function compareCarNumbers(a: string, b: string): number {
  return Number(a) - Number(b) || a.length - b.length || a.localeCompare(b);
}

export interface Ranked<T> {
  rank: number;
  item: T;
}

/**
 * Competition ranking (1, 2, 2, 4). Equal values share a rank and are ordered by
 * car number. Values are compared at display precision so two rows that print the
 * same number never get different ranks.
 */
export function rankBy<T extends { carNumber: string }>(
  items: T[],
  value: (item: T) => number,
  { ascending = true, decimals = 3 } = {},
): Ranked<T>[] {
  const scale = 10 ** decimals;
  const key = (t: T) => Math.round(value(t) * scale) * (ascending ? 1 : -1);
  const sorted = [...items].sort((a, b) => key(a) - key(b) || compareCarNumbers(a.carNumber, b.carNumber));
  const out: Ranked<T>[] = [];
  sorted.forEach((item, i) => {
    const prev = out[i - 1];
    const rank = prev && key(prev.item) === key(item) ? prev.rank : i + 1;
    out.push({ rank, item });
  });
  return out;
}
