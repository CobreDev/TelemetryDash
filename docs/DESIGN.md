# TelemetryDash — Design Guidelines

Oct 9, 2026 · @Cooper

This is the single source of truth for how TelemetryDash looks and behaves: visual rules, the
meaning of every number it shows, and how live data is handled. Code comments point back here.
When a decision changes, change it here in the same commit.

## Purpose and scope

TelemetryDash is a **live race-stats dashboard** for NASCAR, self-hosted as one Docker container
on an Unraid server and used from a desktop or a phone. It also serves a versioned JSON API
(`/api/v1`) so a native app can be built on the same data later.

- **Primary:** Cup Series. **Launch:** O'Reilly Auto Parts Series and Craftsman Truck Series,
  with no design changes beyond their series profile.
- **IMSA** is the 2027 bonus. The NASCAR/IMSA switcher already exists (IMSA marked "coming soon"),
  and the system must handle multi-class racing when IMSA profiles are written.
- Any other series (IndyCar…) is added by writing a **series profile**, not by redesigning.
- **Shareable cards** (static images for X) were the original second output. They are **not
  built** (image export was removed); their guidelines are kept in [Shareable cards](#shareable-cards-not-built)
  for when they return.

## Design principles

1. **Numbers first.** Times, gaps and ranks are the most legible elements on screen. Decoration never competes with data.
2. **Always say when.** Every live view makes the race position obvious (stage, laps to go, lap of total) and the data source obvious (Live, Replay, Upcoming).
3. **Explain every modeled number in one line.** Pace score, estimated fuel and points as they run all carry a footnote saying how they're computed and what they assume.
4. **Never invent data.** Live views show real timing or say there is none. Fictional sample data is only a last-resort fallback for the Pace card, and is always labeled.
5. **No look-ahead.** Every calculation uses only what was known at the current lap, so a replay behaves exactly like a live race.
6. **Same structure everywhere.** Top bar, tabs and panel layouts stay put across series and tabs.
7. **Series-agnostic core.** Layout, type and data rules never assume NASCAR. Series differences live only in the series profile.
8. **Works on a phone.** Every view is checked at 375 px wide: no page-level horizontal scroll, ever. Wide tables scroll inside their panel.

## Series theming system

Every series is described by one **series profile** (`src/series/profiles.ts`) that the dashboard
and API read. Templates never branch on a series id.

| Field | What it controls | Cup |
| --- | --- | --- |
| `id` / display name | Series switcher, headers | `cup` / "Cup Series" |
| `body` | Sanctioning body for the top-right switcher | `nascar` |
| `accent.dark` / `accent.light` | Rank-1 bar, buttons (dark); venue line on cards (light) | `#FFD100` / `#8F6B00` |
| `brand.dashboard` | Top bar color, text, muted text, active underline | Black bar, white text, yellow underline |
| `brand.stripes` | Three stripes under the top bar (and under card headers) | Yellow, red, blue |
| Competitor unit | Rows are drivers or cars | Driver |
| Classes | Multi-class grouping and class colors | None |
| Markers | Feed name tokens, their label and how they render | `#` → (R), `(i)`, `(C)` → row highlight |
| Stop types | Pit stop categories tracked | Four tire, two tire, fuel only |
| Segment name | What a race segment is called | Stage |
| Fuel unit | GAL or L | GAL |
| Enabled templates | Which views/cards make sense | All NASCAR |

| Series | Status | Branding | Notes |
| --- | --- | --- | --- |
| Cup Series | Primary | Black bar, yellow / red / blue stripes | Stages; four/two-tire and fuel-only stops |
| O'Reilly Auto Parts Series | Launch | Green bar `#007A38`, green / red / green stripes | Cup drivers appear as points-ineligible (i) |
| Craftsman Truck Series | Launch | Red bar `#B81E24`, red / black / red stripes | Shorter races, fewer stops |
| IMSA | 2027 | — | Car-based rows with driver lineups, classes, timed races |
| IndyCar | Later | — | No stages; primary vs. alternate tires |

To add a series: copy the closest profile, change the fields, then check every tab with real data
from one race on desktop and at 375 px.

## Color system

The dashboard is **dark theme only**. Tokens share names with the (future) light card theme so views
can switch without changes. All palettes are checked by tests (`src/tokens/tokens.test.ts`) or the
dataviz validator; change a value only after re-running them.

**Neutrals**

| Token | Dark (dashboard) | Light (cards) | Use |
| --- | --- | --- | --- |
| `bg` | #0F1115 | #F4F5F7 | Page background |
| `surface` | #181B21 | #FFFFFF | Panels |
| `surface-alt` | #20242C | #E9EBEF | Zebra rows, active toggle |
| `border` | #2C313A | #D5D9E0 | Dividers, panel borders |
| `text` | #EEF0F3 | #12151B | Primary text and numbers |
| `text-muted` | #9AA1AE | #5B6270 | Labels, first names, footnotes |

**Performance colors** are only for good/middle/bad judgments, and always sit next to a signed
number or a word, never alone: `perf-good` #3DD68C (gained, best), `perf-mid` #F2B33D, `perf-bad`
#F2645E (lost). Light values for cards: #1E9E5A / #D98A00 / #D33A3A. Known issue: light `perf-mid`
is 2.77:1 on white, under the 3:1 rule; the test marks it as an expected failure until it's retuned.

**Series accent** (`accent.dark`) is exactly the dashboard header color: the bar color, or Cup's
yellow highlight. It draws the rank-1 bar (redundant with the rank number, so exempt from 3:1)
and buttons, whose text is black or white by contrast. O'Reilly green and Craftsman red sit close to
the performance colors, so **the accent is never used on a number**.

**Series brand.** The top bar takes the series bar color; three full-width stripes sit under it.
Rules: every series has exactly three stripes (constant height); the stripe in the bar's hue uses
the **exact** bar color; top-bar text meets 4.5:1 on the bar (darken the bar, never the text); an
8 px band of bar color separates the active-tab underline from the stripes. Colors are sampled from
the series logos (none are published).

**Flag colors** (flag icon, lap bar): green `#2BB34B`, yellow `#FFD100`, red `#E4002B`, white
`#FFFFFF`, checkered as a black/white pattern. Stage ends use NASCAR's stage flags: green/white
checkered, or yellow/white checkered when the stage ended under caution. The flag icon is always outlined (white around colored
flags, dark around white/checkered) so it reads on any series bar, including red-on-red.

**Chase highlight:** rows of Chase drivers get a faint yellow tint, `rgba(255, 209, 0, 0.09)`, layered
over the zebra stripe, explained in the footnote "Highlighted rows: Drivers in the Chase".

**Strategy colors** (stint bars only): start `#4A5160`, four tires `#2F7FE0`, two tires `#D07A1A`,
fuel only `#8A5CF0`. Two-tire orange is deepened from `#F29B1F` to pass the dataviz validator's
lightness band on the dark surface.

**Line-chart palette** (Compare), dark: `#2F7FE0`, `#E5484D`, `#12A5B8`, `#C48420`, `#8E4EC6`,
`#30A46C`, in that slot order. Reordered and with a deeper amber versus the original light set so
every adjacent pair stays distinct for color-blind readers on `#181B21` (validated). Six lines max.
A driver keeps its color slot for as long as it's selected; removing one never repaints the others.

## Typography

**The dashboard uses no italics anywhere.**

| Role | Font | Weight | Size |
| --- | --- | --- | --- |
| Panel titles, race name, stage label | Stainless (licensed) | Black 900 | 22 px (titles), 16 px (race), 15 px (stage) |
| Series selectors (Cup / O'Reilly / Craftsman) | Stainless | Regular 400 | 17 px, all caps |
| Body text, labels, notes | Stainless | Regular 400 | 14–15 px |
| Driver last name | Barlow Condensed | Bold 700, all caps | 18 px |
| Driver first name | Stainless | Regular, muted | 15 px |
| Times, gaps, positions | JetBrains Mono | Semibold, tabular | 17 px |
| Car number (no badge) | Barlow Condensed | Black 900 | 20 px |
| Column headers | Stainless | Semibold-equivalent, caps, +4% tracking | 14 px |
| NASCAR/IMSA switcher | NASCAR logo face slot (falls back to Saira) | 800 | 15 px |

- Minimum size is 14 px. Numbers are never set in the display face; numeric columns are right-aligned.
- Stainless (Regular, Bold, Black) is **purchased and licensed**, stored in `public/fonts` and committed (the owner keeps them in the public repo under that license). Missing faces fall back to Saira/Inter. Never download fonts from nascar.com or other sites; NASCAR's logo face ("Big Bill") is proprietary and unavailable, so its slot stays on the fallback.
- Free fonts are bundled with the app (no CDN), so the container works offline.

## Dashboard layout

### Top bar (series-branded)

```
CUP SERIES  O'REILLY…  CRAFTSMAN…                       [ NASCAR ▾ ]
                                                        [Live|Sample]
[track logo]  SOUTH POINT 400  Las Vegas, NV
              ⚑ STAGE 2         54 | 85     (● Live)
                133 To Go     134 | 267
              ▬▬▬▬▬▬ lap bar ▬▬▬▬▬▬
Overview  Pace  Pit road  Strategy  Fuel  Compare
════════ three series stripes ════════
```

- **Left:** series selectors (scroll sideways on a phone; never wrap).
- **Top right:** NASCAR/IMSA dropdown, with the **Live | Sample** toggle under it.
- **Race header:** track logo (JPG logos sit on a white tile; PNGs sit directly on the bar; hidden if it fails to load), race name and "City, ST". The race name sits beside the logo, not above it.
- **Status block**, TV-style:

  | Situation | Line 1 | Line 2 |
  | --- | --- | --- |
  | Normal | **Stage N** · lap in stage \| stage length | *X* To Go · lap \| total |
  | Fewer than 10 laps left in the stage | **Stage N** · *X* To Go | — |
  | Stage just ended | **Stage N** · Complete | — |
  | Race finished | **Final** · lap \| total | — |
  | Practice / qualifying | **Session name** · *N* laps | — |
  | Upcoming (not live) | **Day, Mon D** · time ET | *N* laps · *M* mi, then **Stages** a \| b \| c |

- **Flag:** a small waving-flag icon left of the status block, showing the **current** flag (not the last completed lap's). On the lap a stage ends (status "Stage N Complete") it shows the stage-end flag instead, judged by the flag on the stage's last lap, since the stage-break caution comes out right after.
- **Lap bar:** under the status block, exactly as wide as it. Completed laps are colored by the flag they ran under, remaining laps are dim, notches mark stage ends. Hidden for practice and upcoming races.
- **TV network** logo stacked above the source badge, on a small white tile so network colors never vanish into a series bar. Logos are public-domain files on Wikimedia Commons, hotlinked like track logos (`src/data/nascar/networks.ts`); an unknown network or a failed image falls back to the name as text.
- **Times** are always US Eastern, labelled "ET", in the browser's own 12- or 24-hour style. The upcoming date is not uppercased.
- **Source badge** next to the race: **Live** (pulsing red dot) on the series that's live; **Upcoming** when the series isn't live; **Replay** in sample mode. Live turns amber only if the server hasn't reached NASCAR's feed for 30 s. There is no seconds counter: quiet stretches (qualifying, red flags) are not staleness.
- **Tabs:** active tab underlined in the series highlight color, at the same baseline-to-underline gap (8.5 px) as the active series.

### Panels and tables

- **Columns:** `Pos` (not `#`); Pos, Car and numeric columns shrink to their content; the Driver column takes the rest. Headers may wrap only when the panel is narrow (container query at 480 px).
- **Names:** full names everywhere except the narrow Chase and crew-average tables (last name only). One line, "Chase BRISCOE" (first name muted, last name bold caps). If any name doesn't fit, **every** row wraps to two lines (first name above last); never a mix. A long name breaks only between first and last name.
- **Car numbers:** each team's stylized number artwork (NASCAR's public badge images, proxied and cached weekly), 34 px tall with a thin light halo so dark artwork reads on dark rows. Fallback: the number in Barlow Condensed.
- **Rows:** zebra striping; the leader gets a 4 px accent bar; Chase drivers get the yellow tint; unranked/out cars sit at the bottom at 55% opacity with dashes.
- **Markers:** (R) rookie and (i) points-ineligible print after the last name; Chase is the row highlight instead of "(C)". Each marker that appears is explained in the panel's footnote.
- **Footnotes** under each table explain metrics, markers and exclusions. Panels don't repeat the stage/lap stamp; the header shows it.
- **Widths:** Pace rankings max 640 px; Overview max 980 px, or 1,640 px (≥1,360 px screens) with the 420 px right column (Race control + Chase live, Chase off-week) in the **same spot in both modes**. **The Overview cards are centered on the screen.**
- **Phones:** wide tables scroll inside their panel; the page never scrolls sideways.
- **Loading (no jank on a fresh load):** series profiles ship in the bundle, so the bar has its colors on first paint; the header holds a 76 px min height (also steady between series); the track logo has a fixed 120 × 52 slot; car badges reserve their 78:70 box; images fade in (0.25 s, off with reduced motion); the Stainless fonts are preloaded and use `font-display: block`, so text never swaps faces. Target: zero layout shift (measured 0 on reload).

## Tabs

| Tab | Contents |
| --- | --- |
| **Overview** | Running order: Pos, Car, Driver, Last lap, To leader, To next, Since pit, Est. fuel, 10-lap avg (both gap columns always shown). In practice/qualifying it becomes **Practice timing**: ranked by best fully-timed lap with To fastest, To next and laps run. Beside it (stacked on narrow screens): the **Chase standings** card. When the series isn't live, the Overview shows **Next Race** (on-track sessions in ET, done ones muted, TV and radio), **Last race** (full results: Pos, Car, Driver, Start, Led, Status, Pts, with Chase tint and markers from the points file) and, on the right, **Chase standings** after that race (± = move in that race, Last race = finish). Wide screens: schedule \| results \| Chase; mid widths stack the schedule over the results; phones get one column with Chase last. |
| **Pace** | Pace rankings for the **full field** (excluded cars listed unranked at the bottom), plus a **Top speed** card (fastest single-lap average speed, top 10; column "Avg MPH"). |
| **Pit road** | Every stop so far, newest first, in a fixed-height list (~12 rows) that scrolls with a sticky header (lap with green/caution dot, service, box time, lane time, positions ±), and four-tire and two-tire crew averages (top 10). |
| **Strategy** | Full driver names (one line on desktop: the stint bars give up width, down to 160px, before names wrap). One stint bar per car in running order, colored by the stop that started each stint, stage-end notches, stops and total lane time. |
| **Fuel** | Full driver names. Est. fuel gauge, laps of fuel left, and whether each car reaches the finish, the stage end, or is short by N laps. |
| **Compare** | Lap-time chart for up to 6 drivers (default: top 3), Last 20 / Last 50 / All laps, plus a summary table (laps shown, avg, best, last). |

**Right column (420px, same spot live and off-week):** during a race, **Race control** sits above
the Chase card: NASCAR's lap notes (`lap-notes.json`: passes, incidents, pit cycles, stage results;
"Stat" for info notes) plus flag changes built from the lap flags (Caution, Red flag, Green flag:
restart, White, Checkered), newest first, car numbers in bold, a fixed 360px list that scrolls.
Flag changes right after a recording gap are skipped (the change could be anywhere in the gap). A red flag sticks to its lap in the recorder (the caution that resumes on the same lap can't erase it), the next caution reads "Red flag lifted: caution", and a note NASCAR marks red adds the Red flag entry (plus the "Red flag lifted: caution" entry on the next caution lap) if the lap flags missed it. Every flag stays in the history: Caution → Red flag → Red flag lifted: caution → Green flag: restart. Flag entries are labelled like the header's lap counter, by **laps completed when the flag came out** (white at 133 and checkered at 134 in a 134-lap race; the opening green is "Start"), so a flag can read one lap earlier than NASCAR's note about it. When the leader completes the last lap, a **Checkered flag** entry goes on that lap (the feed can keep sending white after the finish, so the header shows checkered and "Final" from the race length, not the feed's flag). Live races use the feed's `laps_in_race` for the race length (the schedule can be wrong, and overtime adds laps); the final stage absorbs the difference.
Replays show only notes up to the replay lap. Hidden in practice/qualifying.

**Chase card:** columns Pos, ±, Car, Driver, Current, Pts, Gain. Pos and Pts are the standings
**entering the race**, sorted by those points; ± is the projected move if the race ended now (green
up, red down, dash for none); Current is the current running position; Gain is the points picked up
so far as they run (stage points plus what the running position pays). Hovering Pts shows the live
total. It hides in practice and when a race has no Chase data. Off-week the same columns read Pos,
±, Car, Driver, Finish, Pts, Gain for the last race. Cell padding is 5px so seven columns fit 420px.

**Compare chart rules** (from the dataviz guidance): 2 px lines; faster laps plot lower (the axis reads as lap time, the user's choice); a legend
always, plus right-end name labels for up to 4 drivers, spread so they never overprint; cautions
shaded; crosshair + tooltip on hover; shows green-flag laps only (pit, restart and laps over 7%
slower than the car's median are hidden, so one pit lap can't flatten the scale).

## Metrics and data rules

### Formats

| Value | Format | Example |
| --- | --- | --- |
| Lap time | Seconds, 3 decimals; minutes only above 99.999 s | 31.340s, 1:58.219 |
| Pit stop time | Seconds, 2 decimals | 8.30s |
| Gap (time) | Signed, 3 decimals; laps down as "+1 Lap" / "+2 Laps" | +0.212s |
| Gap to best (percent) | 2 decimals; leader 0.00% in `perf-good` | 0.69% |
| Position change | Signed integer; zero is an en dash | +3, −1, – |
| Fuel (modeled) | Percent of a full tank | 64% |
| Speed | mph, 3 decimals | 182.605 |
| Schedule times | US Eastern, as published | Sun, Oct 11 · 3:00 PM ET |

Ties share a rank and are ordered by car number. (NASCAR's official Chase tie-break starts with wins; not yet applied.)

### Definitions

- **Running order and gaps:** "now" is the moment the first car completes the current lap. Cars are ordered by laps completed, then by line-crossing time. Gaps are measured at the last start/finish line both cars crossed; if a car was passed after that line (negative difference), the gap falls back to the progress difference at the car's pace. A car is on the lead lap if its progress (laps plus fraction of the current lap, from its last lap time) is within one lap. A car that hasn't crossed the line for 4 of its normal laps is **out**.
- **Pace score** (tire-age adjusted): each car's mean green-flag lap with tire falloff removed, i.e. its expected lap on fresh tires. Clean laps: green flag, not a restart lap, not a pit-in or pit-out lap, within 7% of the car's own median. Tire age counts laps since the last stop that changed any tire (fuel-only doesn't reset it). One field-wide falloff rate is fitted within stints of at least 5 laps. Cars need at least max(10, half the typical clean-lap count) laps to be ranked; others are listed as excluded. (A median-lap variant was requested as "both"; not built yet.)
- **Top speed:** each car's fastest single-lap average speed (mph). NASCAR publishes no speed-trap data, so true top speed isn't available, and the footnote says so.
- **10-lap avg:** mean lap time over the car's last 10 laps, **including** caution and pit laps.
- **Est. fuel (modeled; NASCAR publishes no fuel data):** every stop fills the tank; a caution lap burns 35% of a green lap; the field's longest run between stops so far equals one full tank. "Laps left" and "Reaches" assume green-flag running from now.
- **Crew averages:** box times only; stops with no time are skipped, and stops over 1.5× the field median for that service (repairs, penalties) are left out.
- **Points as they run:** live races use NASCAR's live points file as-is. Replays rebuild it: points entering the race, plus stages already completed, plus what the current running position pays. The payout per position is read from the race's actual results (2026: 55 for a win, 35 for 2nd, then one less per position), so rule changes need no code. Fastest-lap and bonus points are only added at the finish.
- **Markers:** NASCAR feed tokens `#` (rookie → shown as "(R)"), `(i)` (ineligible for points in this series), `(C)` (in the Chase). The name text over-marks `(C)` (it tags drivers outside this series' Chase, even some with `(i)`), so the server rewrites it from NASCAR's `is_in_chase` flag: the points file in a race, the live snapshot in practice. With no flag data, nobody is highlighted.
- **Estimated laps:** when the server joins a session late or misses polls, the missed time is split evenly across the missed laps; elapsed time stays exact, but those laps are marked and never count toward pace, top speed, best laps or the Compare chart. During a race they are then **backfilled** from NASCAR's official `lap-times.json` (published live during races), which also supplies flags for laps the server never saw. Laps with no flag seen and no backfill read as unknown unless the flags on both sides match, so a gap never looks like a caution or restart.
- **Practice best lap:** only fully-timed laps within 1.5× the field's fastest count (laps that include garage time don't).

## Data sources and live behavior

- **Live (default):** the server polls NASCAR's live feed every 5 s during a session (once a minute when idle, using If-Modified-Since), records each lap from the car's session clock, and saves the session to `/data/live/current.json` so restarts lose nothing already recorded (laps run while it's down are backfilled, see Estimated laps). A finished race's saved copy is deleted an hour after the feed goes quiet, and a race that's already over when the server starts isn't recorded (the replay files cover it). Pit detail and live points refresh every 15 s. Request rates stay at or below what nascar.com itself uses.
- **Sample:** the Live/Sample toggle (remembered per browser) or `?source=sample` replays each series' last completed race at its halfway lap. Completed-race files are cached in `/data` and fetched once.
- **Views refresh every 5 s** in live mode without flicker or losing selections (series, tab, Compare picks).
- **Opening series** (live mode, once per load; picks after that stick; days in US Eastern): a live race's series; otherwise **Friday–Sunday** the series whose next race starts soonest, and **Monday–Thursday** Cup. The server decides (`GET /api/v1/home`) and the page waits up to 1 s for it before drawing, so it never shows one series and jumps to another.
- **Finished races:** a race that's over stays on screen (header **Final** with the checkered flag, a **Final** badge, final running order, race control and Chase) until **Monday 00:00 ET** after it (end of the day for a Monday race), built from NASCAR's official files, per series, so Friday's Truck race is still there after Saturday's sessions start. The collector keeps its saved copy until then too. After that the series shows **Upcoming**. From the day after the race (ET dates), the finished-race Overview also puts the **Next Race** card above Running order. "Next race" never means a race that's already over, even within 6 hours of its start.
- **Nothing live for a series:** the header shows the **Upcoming** race; the Overview shows the schedule and last results; other tabs say "No live session for this series", name what is live now and give the next race. The API answers `409 { error: "no-live-session", live, next }`.
- **No fictional fallback for timing:** if data can't be fetched, timing views say so. Only the Pace card falls back to labeled fictional data.
- **Schedule quirks:** `race_date` is US Eastern wall-clock time with no offset (converted with daylight saving), and `actual_laps` is pre-filled for future races, so "finished" is decided by start time.
- **No live GPS or timing-loop data is public**, so a future track map must estimate positions from line crossings and gaps.

## Shareable cards (not built)

Image export was removed; these rules apply when cards return.

- **Principles:** one graphic, one finding; the post text states it and the card proves it. Light theme (stands out in a dark timeline). Same header/body/footer zones on every card. Readable at 375 px.
- **Layout:** 8 px grid, 56 px margins. Header: title, venue in the light accent, "race · series · year", one-line metric definition, then the series stripe band (6 px each). Body rows 56–64 px with zebra striping; rank 1 gets an accent bar. Footer: metric footnote and lap range left, "Generated by \<handle>" right.
- **Card type** (at 1080 px wide): title Barlow Condensed 64–72 px caps; venue 28 px; metric line Inter 18 px caps; last name 30 px over first name 14 px; car number 34 px; numbers JetBrains Mono 28 px; column labels 14 px; footer 13 px.
- **Formats:** 4:5 1080×1350 (rankings ≤10 rows), 16:9 1600×900 (charts), 1:1 1080×1080 (single driver), 9:16 1080×1920 (keep 80 px clear at the bottom). Export PNG at 2×.
- **Template catalog:** Top 10 Pit Stops, Four Tire Averages, Strategy Report, Lap Time Comparison (launch set); Stage Pace Rankings, Lap Time Distribution, Fuel Save, Pit Crew Summary, Pit Lane Time Ranking, Spots Gained, Predicted Pace (later). Top 10 Pace Rankings is dashboard/API only. IMSA versions add class grouping and driver lineups.
- **Card branding:** no team artwork or series logos on posted cards; series colors only in the stripe band; plain-text series and race names; attribution to your own handle.
- **Pre-posting checklist:** correct race/venue/series; lap stamp on live cards; metric definition; markers and exclusions explained; formats per this doc; readable at 375 px; 2× PNG at the right size; one-sentence alt text.

## Branding and legal

- The dashboard runs on your own server for personal use, so it uses team number artwork and track logos (loaded from NASCAR, which blocks server-side logo fetches; the browser loads them). Posted cards must not.
- No series, sponsor or manufacturer logos in the UI chrome; series identity comes from bar color and stripes.
- Data: unofficial use of NASCAR's public feeds. Keep request rates low, check terms of use, and credit "Timing data from public NASCAR feeds; unofficial" wherever it's published.
- Fonts: only licensed or open-licensed fonts (see Typography).
- **App icon** (`public/icon.svg`, plus `icon.png` 512 px and `apple-touch-icon.png` 180 px): an original drawing, a dark rounded tile with a speedometer arc in the Cup stripe colors (blue, yellow, red), ticks and a white needle. Used as the favicon, the phone home-screen icon and the Unraid Docker icon (from the repo's raw GitHub URL). Don't use SF Symbols or look-alikes for icons or logos: Apple's license forbids it (a draft built from `gauge.with.dots.needle.50percent` was rejected for this).
- Borrow structure from other creators and broadcasters, not their exact look. (An AmberConsole terminal-style variant was tried and rejected.)

## Accessibility

- Text meets 4.5:1 on its background; large numbers and non-text indicators meet 3:1 (tests enforce accents, bar text and perf colors).
- Color never carries meaning alone: performance colors sit next to signed numbers or words; flags have outlines and tooltips; chart lines have labels and a legend; the Chase tint is explained in a footnote.
- Motion respects `prefers-reduced-motion` (the Live dot stops pulsing).
- Interactive controls are real buttons/selects with labels (`aria-pressed`, `aria-current`, `aria-label`).

## Deployment

One container (Node 22, bundled server, no `node_modules` at runtime) serves the UI and API on port
8080, storing data in `/data`. Built for `linux/amd64` (Intel Unraid) from any machine; the Unraid
template (`unraid/telemetrydash.xml`) maps port 8099, `/mnt/user/appdata/telemetrydash`, and runs as
`99:100`. GitHub Actions builds the image on every push to `main` (tests run inside the build) and
publishes it to `ghcr.io/cobredev/telemetrydash` (`:latest` and `:sha-<commit>`, public, no
login); Unraid updates by hand or on a schedule with CA Auto Update Applications, outside race
hours. Steps are in the README.

## Backlog

- **Track map** on Overview with positions interpolated between line crossings.
- **Chase page** with full standings (beyond the Overview card) and the official tie-break.
- **Live video** from the user's IPTV, played in the dashboard.
- **Pace:** stage-by-stage pace and lap-time distribution; median-lap pace toggle.
- **Live polish:** highlight changed rows for 2 s; gray out pace views under caution; Predicted Pace before a race.
- **Phones:** pin Pos/Car/Driver when wide tables scroll.
- **IMSA** profiles (2027) and **IndyCar** later.
- **Cards** (see above), if image export returns.
