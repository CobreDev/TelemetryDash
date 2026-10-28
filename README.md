# TelemetryDash

A live NASCAR stats dashboard for the Cup, O'Reilly Auto Parts and Craftsman Truck series:
running order, pace, pit stops, strategy, fuel, lap-time comparisons, race control, penalties and
the Chase. It runs as one Docker container that serves the web UI (desktop and phone) and a JSON
API at `/api/v1`.

Timing comes from NASCAR's public feeds and is unofficial. How it looks and what each number means
is in [docs/DESIGN.md](docs/DESIGN.md).

## Develop

```bash
npm install
npm run dev:api   # API on :8787
npm run dev:web   # UI on :5173, proxying /api
npm test
```

| Path | What's there |
| --- | --- |
| `src/app` | The dashboard (React) |
| `src/cards` | View models: display-ready data shared by the UI and the API |
| `src/data` | NASCAR feed types, the live recorder, running order, pace, fuel and points |
| `src/format`, `src/tokens`, `src/series` | Number formats, design tokens, series profiles |
| `server` | The API (Hono): `routes/`, data selection in `bundle.ts`, NASCAR access in `sources/` |

## Run on Unraid

Every push to `main` builds a `linux/amd64` image with GitHub Actions (tests run in the build) and
publishes it as `ghcr.io/cobredev/telemetrydash:latest` and `:sha-<commit>`. The image is public.

1. Copy `unraid/telemetrydash.xml` to
   `/boot/config/plugins/dockerMan/templates-user/my-telemetrydash.xml`, then Docker > **Add
   Container** > Template: **telemetrydash** > Apply. It maps `/data` to
   `/mnt/user/appdata/telemetrydash` and runs as `99:100`.
2. Open `http://<server>:8099`.

**Updating:** Docker > **Check for Updates** > **Apply update**, or schedule it with the Auto Update
Applications plugin outside race hours. A restart mid-race is safe: the session is saved to `/data`
and missed laps are filled in from NASCAR's official lap times. To roll back, set the Repository to
`ghcr.io/cobredev/telemetrydash:sha-<commit>`.

To build the image yourself instead:

```bash
docker buildx build --platform linux/amd64 -t telemetrydash:latest --load .
```

## Data

- **Live** (default): the server follows NASCAR's live feed during sessions, records every lap,
  and keeps the session on disk. Between races, series views show the next race, the last results
  and Chase standings.
- **Sample:** the Live/Sample toggle, or `?source=sample` on any series endpoint, replays each
  series' last race at halfway.

When nothing is live for a series, timing endpoints answer `409` with
`{ error: "no-live-session", live, next }`.

## API

All series endpoints are under `/api/v1/series/:id` (`cup`, `oreilly`, `craftsman`) and return
display-ready strings, so every client shows the same numbers.

| Route | Returns |
| --- | --- |
| `GET /api/v1/live` | What's live (series, session, lap, flag) and when its data last changed |
| `GET /api/v1/home` | The series to open to |
| `GET /api/v1/series` · `/series/:id` | Series profiles |
| `/cards/pace-rankings` | Header data and pace rankings (`?limit=10` for a top 10) |
| `/overview` | Running order, or best-lap timing in practice and qualifying |
| `/chase` | Chase standings as they run |
| `/chase/season` | The whole Chase: standings, results in every Chase race, points by race |
| `/chase/standings` | Chase standings after the last race |
| `/race-control` · `/penalties` | Race notes and flag changes; penalties read from the notes |
| `/pit-road` · `/strategy` · `/fuel` · `/laps` · `/top-speed` | The data tabs |
| `/upcoming` · `/schedule` · `/qualifying` · `/results` | The next race, its sessions, qualifying, the last results |
| `/car-badges/:number.png` | Team number art (a cached copy of NASCAR's) |
