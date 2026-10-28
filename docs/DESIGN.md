# TelemetryDash design

How TelemetryDash looks and behaves, and what every number on it means. When a decision changes,
change it here in the same commit.

## Scope

A live NASCAR stats dashboard (Cup, O'Reilly Auto Parts, Craftsman Truck), self-hosted as one
Docker container and used on desktop and phone. It also serves a versioned JSON API (`/api/v1`)
for a future app.

- Series differ only by their **series profile** (`src/series/profiles.ts`); views never branch on a
  series id. IMSA (2027, multi-class) and IndyCar are added by writing profiles.
- Shareable image cards were the original second output. They aren't built; see
  [Cards](#cards-not-built).

## Principles

1. **Numbers first.** Times, gaps and positions are the most legible things on screen.
2. **Always say when and from where.** Every view shows where the race is (stage, laps to go) and
   the source (Live, Replay, Upcoming, Final).
3. **Explain modeled numbers once.** Pace, estimated fuel, points as they run and inferred
   penalties each carry one short footnote. Nothing else gets a footnote.
4. **Never invent data.** Timing views show real data or say there is none. Only the Pace card
   falls back to fictional data, and it's labeled.
5. **No look-ahead.** Calculations use only what was known at the current lap, so a replay behaves
   like a live race.
6. **Same structure everywhere.** The top bar, tabs and card layout don't move between series.
7. **Works on a phone.** Checked at 375 px: the page never scrolls sideways; wide tables scroll in
   their card.

## Visual system

### Color

Dark theme only. Token names match a future light theme. Palettes are checked by
`src/tokens/tokens.test.ts` or the dataviz palette validator; re-run them after any change.

| Token | Value | Use |
| --- | --- | --- |
| `bg` | #0F1115 | Page |
| `surface` | #181B21 | Cards |
| `surface-alt` | #20242C | Zebra rows, active toggle |
| `border` | #2C313A | Dividers |
| `text` | #EEF0F3 | Text and numbers |
| `text-muted` | #9AA1AE | Labels, first names, footnotes |
| `perf-good` / `perf-mid` / `perf-bad` | #3DD68C / #F2B33D / #F2645E | Judgments only, always beside a signed number or word |

- **Series accent** (`accent.dark`) is the header color (Cup's yellow, O'Reilly's green,
  Craftsman's red). It marks the leader's row and fills the win chips in the Chase grid, but is
  never the color of a number, because green and red read as good and bad.
- **Series bar:** the top bar takes the series color, with three full-width stripes under it. The
  stripe in the bar's hue uses the exact bar color, and bar text meets 4.5:1 (darken the bar,
  never the text).
- **Flags** (header icon, lap bar, race control): green #2BB34B, yellow #FFD100, red #E4002B,
  white, and checkered as a pattern. Stage ends use NASCAR's stage flags (green/white checkered, or
  yellow/white under caution). These are CSS variables in `app.css`.
- **Chase drivers:** a faint yellow row tint, `rgba(255, 209, 0, 0.09)`, over the zebra stripe.
- **Stint bars:** start #4A5160, four tires #2F7FE0, two tires #D07A1A, fuel only #8A5CF0.
- **Chart lines** (Compare, Chase), in slot order: #2F7FE0, #E5484D, #12A5B8, #C48420, #8E4EC6,
  #30A46C. A driver keeps its slot while selected; removing one never repaints the others. Compare
  shows up to six lines, Chase up to four plus the field in gray.

### Type

| Role | Face | Size |
| --- | --- | --- |
| Card titles, race name, stage label | Stainless Black (licensed) | 22 / 16 / 15 px, caps |
| Series switcher | Stainless Regular | 17 px, caps |
| Body, labels, notes | Stainless Regular | 14–15 px |
| Driver last name | Barlow Condensed Bold | 18 px, caps |
| Driver first name | Stainless Regular, muted | 15 px |
| Times, gaps, positions | JetBrains Mono Semibold, tabular | 17 px |
| Column headers | Stainless, caps, +4% tracking | 14 px |

- 14 px minimum. No italics. Numbers are never in the display face and are right-aligned.
- Stainless is purchased and committed in `public/fonts`; missing faces fall back to Saira and
  Inter. NASCAR's logo face is proprietary, so the series dropdown uses the fallback. Never take
  fonts from nascar.com.
- Free fonts ship with the app, so it works offline.

### Cards and tables

- **Columns:** `Pos`, not `#`. Pos, Car and numbers shrink to fit; Driver takes the rest. Headers
  wrap only in a narrow card (container query at 480 px).
- **Names:** "Chase BRISCOE" on one line. If any name in a table doesn't fit, every row switches
  to two lines, never a mix. Narrow cards (Chase, crew averages) show last names only.
- **Car numbers:** each team's number art (NASCAR's badge images, proxied and cached weekly), 34 px
  tall with a light halo for dark artwork. The manufacturer logo (public-domain files in
  `public/makes`) sits in its own column on the running order.
- **Rows:** zebra stripes; the leader gets a 4 px accent bar; Chase drivers get the tint; out or
  unranked cars sit at the bottom at 55% opacity.
- **Markers:** (R) rookie and (i) points-ineligible print after the last name and are explained in
  the card's footnote. Chase is the row tint, not "(C)".
- **Long lists** (stops, penalties, slim last race, race control) scroll inside their card with
  the header pinned.
- **Card titles** are sentence case in code and uppercase on screen.

### Loading

No layout shift on a fresh load (measured 0). Series profiles ship in the bundle, so the bar has
its colors on the first paint. The header holds 76 px, the track logo has a fixed 120 × 52 slot,
car badges reserve their box, images fade in over 0.25 s (off with reduced motion), and the
Stainless fonts are preloaded with `font-display: block`.

## Layout

### Top bar

```
CUP SERIES  O'REILLY…  CRAFTSMAN…                       [ NASCAR ▾ ]
                                                        [Live|Sample]
[track logo]  BANK OF AMERICA 400  Concord, NC          [usa]
              ⚑ STAGE 2         54 | 85                 (● Live)
                133 To Go     134 | 267
              ▬▬▬▬▬▬ lap bar ▬▬▬▬▬▬
Overview  Pace  Pit road  Strategy  Fuel  Compare  Chase
════════ series stripes ════════
```

| Situation | Line 1 | Line 2 |
| --- | --- | --- |
| Running | **Stage N** · lap in stage \| stage length | *X* To Go · lap \| total |
| Under 10 laps left in the stage | **Stage N** · *X* To Go | |
| Stage just ended | **Stage N** · Complete | |
| Finished | **Final** · lap \| total | |
| Practice / qualifying | **Session** · *N* laps | |
| Upcoming | **Day, Mon D** · time ET | *N* laps · *M* mi, then stage lengths |

- **Flag icon:** the current flag (not the last completed lap's); the stage-end flag on the lap a
  stage ends.
- **Lap bar:** completed laps in their flag color, notches at stage ends; hidden for practice and
  upcoming races.
- **TV network** logo on a white tile (public-domain logos from Wikimedia Commons; unknown
  networks fall back to text).
- **Badge:** Live (pulsing dot; amber if the server hasn't reached NASCAR for 30 s), Final,
  Upcoming, or Replay in sample mode.
- **Times** are US Eastern, labelled "ET", in the browser's 12- or 24-hour style.

### Overview

- **During a race:** Running order on the left; on the right, a 420 px column with Race control,
  Penalties and Live Chase standings. The column sits in the same spot live and off-week, and the
  cards are centered.
- **Running order:** Pos, make, Car, Driver, Last lap, To leader, To next, Since pit, Est. fuel,
  10-lap avg. Live tags: **Pit** on pit road, **DVP** (red) on the damaged vehicle clock. In
  practice and qualifying it becomes **Practice timing**, ranked by best lap. A finished race's is
  titled **Results**.
- **Race control:** NASCAR's lap notes plus flag changes, newest first, car numbers in bold. The
  header shows cautions and caution laps (NASCAR's counts live, counted from the lap flags
  otherwise).
  - Flags are labelled by laps completed when they came out (white at 133 in a 134-lap race; the
    opening green is "Start").
  - A red flag stays in the history: Caution → Red flag → Red flag lifted: caution → Green flag:
    restart. A red NASCAR noted but the lap flags missed is added from the note.
  - A caution NASCAR's notes call a competition caution reads **Competition Caution**.
  - Each finished stage gets a **Stage N winner** entry listing every point scorer.
  - The **Checkered flag** goes on the last lap.
  - No entry is made for a flag change right after a recording gap.
- **Penalties:** Car, Driver, Penalty, Punishment, newest first (the lap on hover); see
  [Penalties](#penalties).
- **Live Chase standings:** Pos, ±, Car, Driver, Pts, Gap, Gain, ordered as they run. ± is the move
  from where they entered the race; hovering shows the entering position and points. Off-week the
  card is **Chase standings** after the last race, with a Finish column.
- **Between races:** Next race (titled **Weekend schedule** once the first session has started:
  TV and radio, then sessions in ET, done ones muted, **Cancelled** when a session never ran), Last
  race results, and Chase standings. Wide screens show the three side by side; phones show one
  column with Chase last. From the day after a series' race, the Next race card also sits above
  that race's results.
- **Qualifying mode** (nothing racing; qualifying for the next race is live, done, or replaced by a
  rulebook lineup): the main card is **Qualifying** (Time, MPH, Gap to the pole) or **Starting
  lineup**, and Last race moves to a slim scrolling card under Chase.

### Other tabs

| Tab | Contents |
| --- | --- |
| **Pace** | Pace rankings for the full field (excluded cars unranked at the bottom), and **Fastest driver**: each car's best lap, its average mph and the lap it ran it. |
| **Pit road** | **Latest stops** (every stop, newest first: lap with green/caution dot, service, box, lane, ±) beside **Live pit stops** (cars on pit road now: position now, on entry, ±, most gained first), then four-tire and two-tire crew averages. |
| **Strategy** | One stint bar per car in running order, colored by the stop that started it, with stage notches and one red line down the column at the current lap. Stops and total lane time. |
| **Fuel** | Est. fuel gauge, laps left, and whether each car reaches the finish or stage end, or is short. |
| **Compare** | Lap times for up to six drivers (top three by default), last 20, last 50 or all laps, and a summary table. Green-flag laps only; cautions shaded; faster plots lower. |
| **Chase** | The whole Chase for the series, from the schedule's playoff races (Cup 10, O'Reilly 9, Trucks 7), live and off-week: summary tiles, full standings (gap to the leader and to the next driver, Chase and season stats; click a row to chart it), points after each race, and each driver's finish in every race (the live race shows the running position). |

## Numbers

### Formats

| Value | Format | Example |
| --- | --- | --- |
| Lap time | 3 decimals; minutes above 99.999 s | 31.340s, 1:58.219 |
| Pit time | 2 decimals | 8.30s |
| Gap | Signed, 3 decimals; laps down as "+1 Lap" | +0.212s |
| Gap to best | 2 decimals | 0.69% |
| Position or points change | Signed; zero is an en dash | +3, −1, – |
| Points behind | Minus sign; none is an en dash | −74 |
| Fuel (modeled) | % of a full tank | 64% |
| Speed | mph, 3 decimals | 182.605 |

Ties share a rank and order by car number. (NASCAR's Chase tie-break, starting with wins, isn't
applied yet.)

### Definitions

- **Running order and gaps:** cars are ordered by laps completed, then line-crossing time. Live,
  "now" is the latest crossing seen; replays stop at the leader's crossing. Gaps are taken at the
  last line both cars crossed. A car that misses the line for four of its normal laps, or that the
  feed marks as not running, is **out**. Before the green, the order is the starting lineup.
- **Pace score:** each car's mean clean green-flag lap with tire falloff removed (its expected lap
  on fresh tires). Clean means green, not a restart or pit lap, and within 7% of the car's median.
  Cars need max(10, half the typical clean-lap count) clean laps to be ranked.
- **10-lap avg:** mean of the car's last 10 laps, including caution and pit laps.
- **Est. fuel:** modeled, as NASCAR publishes no fuel data. Every stop fills the tank, a caution
  lap burns 35% of a green lap, and a tank lasts as long as the field's longest run so far.
- **Crew averages:** box times, leaving out stops over 1.5× the field median (repairs, penalties).
- **Points as they run:** live, NASCAR's live points file as is, which counts finished stages but
  not the stage in progress (so it can differ from TV). Replays rebuild it from the race's actual
  payout. Fastest-lap and bonus points come at the finish.
- **Markers:** NASCAR's name tokens `#` (rookie, shown as "(R)") and `(i)`. Its `(C)` token
  over-marks, so the Chase field comes from the `is_in_chase` flag.
- **Estimated laps:** laps the server missed are split evenly and marked. They never count toward
  pace, best laps or charts, and are replaced by NASCAR's official lap times (races) or each car's
  feed-reported best lap.

### Penalties

NASCAR publishes no penalty data (the results file's `infractions` is always empty), so penalties
are read from the race notes: speeding, uncontrolled tire, commitment line, vehicle interference,
crew over the wall, removing equipment, pitting outside the box, blend line, restart violations
and safety violations. Every car named before the infraction counts ("#42, #66 and #3
speeding"); mentions of one already served are skipped. The punishment is the note's when it
gives one; otherwise it's the standard: pass-through under green, tail of the field under
caution.

## Live data

- **Polling:** NASCAR's CDN refreshes the live feed every 30 s. During a session the server times
  each poll from the `Age` header to land just after a new copy (retrying every 2 s); idle, once a
  minute. Pit detail, points and notes refresh every 15 s. Rates stay at or below nascar.com's own.
- **What counts as live:** the feed changed in the last 10 minutes, or an unfinished race is within
  90 minutes before to 6 hours after its scheduled start (pre-race and delays leave the feed
  unchanged). Laps to go come from the feed.
- **Refreshing the page:** `/live` reports `dataAt`, the last change to anything shown. The browser
  checks it every 2 s during a session and refreshes the live series when it moves (30 s fallback).
  Other series refresh once a minute; with nothing live it checks every 15 s. A failed refresh
  keeps the last data on screen.
- **Restarts:** the session is saved to `/data/live/current.json` after every poll and reloads on
  start. Missed laps are estimated, then replaced as above; pits, points and notes are re-fetched
  whole. It's deleted when the race weekend ends.
- **NASCAR unreachable:** cached files fall back to the last copy on disk, and a failed fetch is
  remembered for 2 minutes rather than retried every request.
- **Finished races** stay on screen (Final) until Monday 00:00 ET, built from the official files,
  then the series shows Upcoming.
- **Opening series** (once per load, US Eastern days): the live race's; Friday–Sunday the next
  race's; Monday–Thursday Cup. The page waits up to 1 s for the server's choice.
- **Nothing live:** timing tabs say so and name what is live and the next race; the API answers
  `409 { error: "no-live-session", live, next }`.
- **Sample mode** replays each series' last race at halfway, from files cached in `/data`.
- **Feed quirks:** `race_date` is Eastern wall-clock time with no offset; `actual_laps` is pre-filled
  for future races; per-car status codes are undocumented (1 is running; the server logs others);
  `is_on_track: false` means on pit road. No GPS or timing-loop data is public.

## Branding and legal

- Personal use on your own server, so team number art, track logos and manufacturer logos appear
  in the data. Track logos load in the browser (NASCAR blocks server fetches). Series identity
  comes from bar color and stripes; no series or sponsor logos in the chrome.
- Unofficial use of NASCAR's public feeds. Keep request rates low and credit "Timing data from
  public NASCAR feeds; unofficial" wherever it's published.
- **App icon** (`public/icon.svg`, `icon.png`, `apple-touch-icon.png`): an original speedometer
  drawing in the Cup stripe colors, used as favicon, home-screen and Unraid icon. Don't use SF
  Symbols or look-alikes; Apple's license forbids it.

## Accessibility

- Text meets 4.5:1; large numbers and indicators 3:1 (tests enforce accents, bar text and perf
  colors).
- Color never carries meaning alone: perf colors sit beside signed numbers, flags have outlines
  and tooltips, chart lines have labels and a legend, and the Chase tint is explained.
- Motion respects `prefers-reduced-motion`. Controls are real buttons and selects with labels.

## Cards (not built)

Image export was removed; these rules apply if it returns. Light theme, one finding per card, the
same header/body/footer on every card, 8 px grid with 56 px margins, readable at 375 px, PNG at 2×.
Formats: 1080×1350 (rankings), 1600×900 (charts), 1080×1080 (one driver), 1080×1920. No team art or
series logos on posted cards; credit your own handle.

## Backlog

- Track map with positions estimated between line crossings.
- Chase tie-break (wins first).
- Pace by stage, lap-time distribution, a median-lap pace option.
- Highlight changed rows for 2 s; gray out pace views under caution.
- Pin Pos/Car/Driver when wide tables scroll on phones.
- IMSA (2027) and IndyCar profiles.
