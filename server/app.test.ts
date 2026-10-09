import { describe, expect, it, vi } from 'vitest';
import { app } from './app';

// Never hit NASCAR from tests: nothing is live and the replay is unreachable.
vi.mock('./sources/nascarReplay', () => ({
  FEED_SERIES: { cup: 1, oreilly: 2, craftsman: 3 },
  replayPace: () => Promise.reject(new Error('offline in tests')),
  replayBundle: () => Promise.reject(new Error('offline in tests')),
  nextRace: async () => ({
    race_name: 'Bank of America 400', track_name: 'Charlotte Motor Speedway', track_id: 162, race_date: '2026-10-11T15:00:00',
    scheduled_laps: 267, scheduled_distance: 400.5, stage_1_laps: 80, stage_2_laps: 85, stage_3_laps: 102, television_broadcaster: 'USA',
  }),
  trackInfo: async () => ({ track_id: 162, track_name: 'Charlotte Motor Speedway', city: 'Concord', state: 'NC', track_logo: 'https://example/logo.png' }),
  carBadge: async () => null,
}));
vi.mock('./sources/nascarLive', () => ({ liveBundle: async () => null, liveStatus: () => null }));

describe('api v1', () => {
  it('lists the three NASCAR series', async () => {
    const res = await app.request('/api/v1/series');
    expect((await res.json()).map((s: { id: string }) => s.id)).toEqual(['cup', 'oreilly', 'craftsman']);
  });

  it('says when nothing is live, with the next race', async () => {
    const res = await app.request('/api/v1/series/cup/overview');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'no-live-session', next: { raceName: 'Bank of America 400', startsET: '2026-10-11T15:00:00' } });
  });

  it('serves the fictional sample pace card when the replay is unreachable', async () => {
    const card = await (await app.request('/api/v1/series/oreilly/cards/pace-rankings?source=sample')).json();
    expect(card.header.raceLine).toContain("O'Reilly Auto Parts Series");
    expect(card.rows).toHaveLength(12);
    const top = await (await app.request('/api/v1/series/oreilly/cards/pace-rankings?source=sample&limit=10')).json();
    expect(top.rows).toHaveLength(10);
  });

  it('reports sample timing as unavailable rather than inventing a running order', async () => {
    expect((await app.request('/api/v1/series/cup/overview?source=sample')).status).toBe(503);
  });

  it('404s unknown series', async () => {
    expect((await app.request('/api/v1/series/f1')).status).toBe(404);
  });
  it('describes the next race for the header when nothing is live', async () => {
    const up = await (await app.request('/api/v1/series/cup/upcoming')).json();
    expect(up).toMatchObject({ raceName: 'Bank of America 400', location: 'Concord, NC', laps: 267, miles: 400.5, stageLaps: [80, 85, 102], tv: 'USA' });
  });
});
