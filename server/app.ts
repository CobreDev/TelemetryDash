// The JSON API, versioned so a future app can rely on /api/v1 while the web UI moves on.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { seriesList } from '../src/series/profiles';
import { getProfile } from './bundle';
import { config } from './config';
import { raceRoutes } from './routes/race';
import { weekendRoutes } from './routes/weekend';
import { liveStatus } from './sources/nascarLive';

export const api = new Hono();
api.use('*', cors());

api.get('/health', (c) => c.json({ ok: true }));
api.get('/meta', (c) => c.json({ attribution: config.attributionHandle, sources: ['live'] }));
/** What's live right now (any series): the top bar's status, and when views should refresh. */
api.get('/live', (c) => c.json({ live: liveStatus(), now: Date.now() }));
api.get('/series', (c) => c.json(seriesList));
api.get('/series/:id', (c) => {
  const profile = getProfile(c.req.param('id'));
  return profile ? c.json(profile) : c.json({ error: 'unknown series' }, 404);
});

raceRoutes(api);
weekendRoutes(api);

api.notFound((c) => c.json({ error: 'not found' }, 404));

export const app = new Hono();
app.route('/api/v1', api);
