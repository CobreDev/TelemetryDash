// Sanity check against the cached real Cup replay, when present (skipped in clean checkouts/CI).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildOverview } from './overview';

const dir = 'data/nascar/2026/1/5630';
const have = existsSync(`${dir}/lap-times.json`);

describe.runIf(have)('buildOverview on Las Vegas Cup replay', () => {
  it('produces a sane running order at lap 134', () => {
    const rows = buildOverview(
      JSON.parse(readFileSync(`${dir}/lap-times.json`, 'utf8')),
      JSON.parse(readFileSync(`${dir}/live-pit-data.json`, 'utf8')),
      134,
    );
    console.table(rows.slice(0, 8).map((r) => ({ p: r.position, n: r.carNumber, gap: r.gapToLeader?.toFixed(3), int: r.interval?.toFixed(3), down: r.lapsDown, pit: r.lapsSincePit, fuel: r.fuelEstimate?.toFixed(2), avg: r.avgLap10?.toFixed(3), last: r.lastLapTime })));
    console.table(rows.slice(-6).map((r) => ({ p: r.position, n: r.carNumber, down: r.lapsDown, out: r.out, laps: r.lapsCompleted })));
    expect(rows).toHaveLength(36);
    expect(rows[0]!.gapToLeader).toBe(0);
    expect(rows.every((r, i) => i === 0 || r.lapsDown >= rows[i - 1]!.lapsDown || rows[i - 1]!.out === false)).toBe(true);
  });
});

describe.runIf(have)('buildOverview gap consistency on real replays', () => {
  it('never shows a negative gap or interval', () => {
    for (const dir of ['data/nascar/2026/1/5630', 'data/nascar/2026/2/5663', 'data/nascar/2026/3/5675']) {
      if (!existsSync(`${dir}/lap-times.json`)) continue;
      const lt = JSON.parse(readFileSync(`${dir}/lap-times.json`, 'utf8'));
      const pits = JSON.parse(readFileSync(`${dir}/live-pit-data.json`, 'utf8'));
      for (const at of [10, 50, 100, 134]) {
        for (const r of buildOverview(lt, pits, at)) {
          expect(r.gapToLeader ?? 0).toBeGreaterThanOrEqual(0);
          expect(r.interval ?? 0).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
