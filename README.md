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

Every push to `main` builds a `linux/amd64` image with GitHub Actions
(`.github/workflows/docker.yml`) and publishes it to GHCR as
`ghcr.io/cobredev/telemetrydash:latest` (plus `:sha-<commit>` for each commit). The tests run
inside the build, so a failing commit never ships. The package is **private** because it
contains the licensed fonts.

### One-time setup on Unraid

1. **Token.** On GitHub: Settings > Developer settings > Personal access tokens >
   **Tokens (classic)** > Generate new token (classic), with only the `read:packages` scope.
   Fine-grained tokens don't work: GHCR only accepts classic tokens.
2. **Log in** in the Unraid terminal (paste the token as the password):
   ```bash
   docker login ghcr.io -u CobreDev
   ```
3. **Keep the login across reboots.** Unraid keeps `/root` in RAM, so save the credentials to
   the flash drive and restore them from `/boot/config/go`. (Don't put `docker login` in `go`:
   it runs before Docker starts, so the login would fail.)
   ```bash
   cp /root/.docker/config.json /boot/config/docker-config.json
   printf '\n# Restore registry logins (ghcr.io for TelemetryDash)\nmkdir -p /root/.docker && cp /boot/config/docker-config.json /root/.docker/config.json && chmod 600 /root/.docker/config.json\n' >> /boot/config/go
   ```
   The token is stored unencrypted on the flash drive, so keep the **flash** share's SMB export
   off or private. After replacing an expired token, log in again and repeat the `cp`.
4. **Container.** Copy `unraid/telemetrydash.xml` to
   `/boot/config/plugins/dockerMan/templates-user/my-telemetrydash.xml`, then Docker tab >
   **Add Container** > Template: **telemetrydash** > Apply. For an existing container,
   **Edit** it, set Repository to `ghcr.io/cobredev/telemetrydash:latest` and Apply.
   Check with `docker inspect telemetrydash --format '{{.Config.Image}}'`.
5. Open `http://<server>:8099`.

The template maps `/data` to `/mnt/user/appdata/telemetrydash` and runs as `99:100`
(nobody:users).

### Updates

Pushing to `main` is the deploy: GitHub builds and tests the image (about a minute), and the
server picks it up on its next update.

- **Automatic:** install **Auto Update Applications** (Community Apps), then Settings > Auto
  Update Applications > Docker: daily at an hour outside race times (e.g. 4 AM), with
  telemetrydash set to Yes. If an update does land mid-race, laps missed during the restart
  are backfilled from NASCAR's official lap times.
- **By hand:** Docker tab > **Check for Updates**, then **Apply update** on the container.
- **Roll back:** set Repository to `ghcr.io/cobredev/telemetrydash:sha-<commit>`.

### Building locally instead

```bash
docker buildx build --platform linux/amd64 -t telemetrydash:latest --load .
docker save telemetrydash:latest | gzip > telemetrydash-amd64.tar.gz
```

Then `docker load -i telemetrydash-amd64.tar.gz` on the server and recreate the container
(Edit > Apply).

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
| `GET /api/v1/series/:id/race-control` | Race notes and flag changes, newest first (races only) |
| `GET /api/v1/series/:id/upcoming` | Next race for the header (name, start ET, laps, stages, TV) |
| `GET /api/v1/series/:id/schedule` | Next race weekend's on-track sessions |
| `GET /api/v1/series/:id/results` | Last race's final results |
| `GET /api/v1/series/:id/chase/standings` | Chase standings after the last race (off-week) |
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
