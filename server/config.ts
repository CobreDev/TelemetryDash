// All runtime settings come from env vars so the Unraid template can set them.
export const config = {
  port: Number(process.env.PORT ?? 8080),
  attributionHandle: process.env.ATTRIBUTION_HANDLE ?? '@yourhandle',
  /** Built web UI. Absent in dev, where Vite serves the UI and proxies /api here. */
  staticDir: process.env.STATIC_DIR ?? 'dist/client',
  /** Persistent state (Unraid appdata mount). Unused until a live data source is chosen. */
  dataDir: process.env.DATA_DIR ?? './data',
};
