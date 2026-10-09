import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { app } from './app';
import { config } from './config';
import { startLiveCollector } from './sources/nascarLive';

if (existsSync(config.staticDir)) {
  // serveStatic resolves `root` against the working directory and mishandles absolute paths
  // (every file then falls through to the HTML shell), so always hand it a relative one.
  app.use('/*', serveStatic({ root: relative(process.cwd(), config.staticDir) || '.' }));
  // SPA fallback: any non-API path loads the app shell.
  const shell = await readFile(join(config.staticDir, 'index.html'), 'utf8');
  app.get('*', (c) => c.html(shell));
}

void startLiveCollector();

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`TelemetryDash listening on :${info.port}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => process.exit(0));
