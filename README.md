# TelemetryDash

Live race-stats dashboard and shareable card templates. Design rules live in [docs/DESIGN.md](docs/DESIGN.md).

One container serves the web UI (desktop + mobile) and a JSON API at `/api/v1` for future clients.

## Develop

```bash
npm install
npm run dev:api   # API on :8787
npm run dev:web   # UI on :5173, proxies /api
npm test
```

## Run in Docker (Unraid)

Build the image for an Intel/AMD server (works from an Apple Silicon Mac too; only the
small runtime stage is cross-built) and export it:

```bash
docker buildx build --platform linux/amd64 -t telemetrydash:latest --load .
docker save telemetrydash:latest | gzip > telemetrydash-amd64.tar.gz
```

On Unraid:

1. Copy `telemetrydash-amd64.tar.gz` to the server (e.g. `/mnt/user/appdata/`) and load it:
   `docker load -i /mnt/user/appdata/telemetrydash-amd64.tar.gz`
2. Copy `unraid/telemetrydash.xml` to
   `/boot/config/plugins/dockerMan/templates-user/my-telemetrydash.xml`.
3. Docker tab > **Add Container** > Template: **telemetrydash** > Apply.
4. Open `http://<server>:8099`.

The template maps `/data` to `/mnt/user/appdata/telemetrydash`, runs as `99:100`
(nobody:users), and sets `ATTRIBUTION_HANDLE`. To update, load a new tar and click
**Force Update** on the container. Or with compose: `docker compose up -d --build`.

## Data sources

- **Live (default):** the server polls NASCAR's live feed every 5 s during a session (once a
  minute when idle) and records each lap as cars cross the line, saving the session to
  `DATA_DIR/live/current.json` so a restart mid-race loses nothing. Pit detail and live points
  are refreshed every 15 s. Practice and qualifying are ranked by best lap.
- **Sample:** `?source=sample` (or the Live/Sample toggle in the UI) replays the series' last
  completed race at its halfway point. If even that is unreachable, the Pace card falls back
  to fictional data marked "Sample data".

When nothing is live for a series, live endpoints answer `409` with
`{ error: "no-live-session", live, next }` so clients can say what is live and when the next race starts.

## API (v1)

| Route | Returns |
| --- | --- |
| `GET /api/v1/health` | `{ ok: true }` |
| `GET /api/v1/meta` | Attribution handle and active data source |
| `GET /api/v1/series` | All series profiles |
| `GET /api/v1/series/:id` | One series profile |
| `GET /api/v1/live` | What's live right now (series, session, lap, flag, last update) |
| `GET /api/v1/series/:id/cards/pace-rankings` | Pace rankings plus header data (race, stage/lap status, flag) |
| `GET /api/v1/series/:id/overview` | Running order (race) or best-lap timing (practice/qualifying) |
| `GET /api/v1/series/:id/chase` | Chase standings entering the race and as they run |
| `GET /api/v1/series/:id/pit-road` · `strategy` · `fuel` · `laps` · `top-speed` | Data for the other tabs |
| `GET /api/v1/series/:id/car-badges/:number.png` | Team number artwork (cached copy of NASCAR's) |

All series endpoints accept `?source=sample`.

Card endpoints return display-ready strings (formatted per DESIGN.md), so every client shows identical numbers.

## Layout

- `src/tokens` – shared design tokens (both themes) and contrast checks
- `src/series` – series profiles; the only place series differ
- `src/format`, `src/data` – display formats, ranking/tie rules, source-agnostic data types
- `src/cards` – card view models (shared with the API) and React templates
- `src/app` – dashboard UI
- `server` – Hono API + static hosting, bundled to `dist/server/index.mjs`
