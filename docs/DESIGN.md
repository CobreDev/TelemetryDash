# Race Stats Graphics — Design Guidelines

Oct 9, 2026 · @Cooper

## Purpose and scope

These guidelines define one visual system for a live race-stats dashboard and the shareable graphics exported from it. NASCAR Cup Series is the primary target. The O'Reilly Auto Parts Series and Craftsman Truck Series must work with no design changes beyond their series theme.

IMSA is a bonus for the 2027 season, so the system must handle multi-class racing from day one, even if IMSA screens ship later. Every other series, such as IndyCar, is added by writing a new series profile (see Series theming), not by redesigning anything.

Two outputs share these rules:

- **Live dashboard:** a screen used during a race to watch pace, pit stops, strategy and fuel as they develop.
- **Shareable cards:** static images exported from the dashboard and posted to X or elsewhere, live or after the race.

## Design principles

1. **One graphic, one finding.** Each card answers a single question, such as "who has the best pace this stage?" The post text states the finding; the card proves it.
2. **Numbers first.** Times, gaps and ranks are the largest, most legible elements after the title. Decoration never competes with data.
3. **Always say when.** A live card shows the lap range or "so far" timestamp it covers. A reader should never wonder whether a number is final.
4. **Explain the metric in one line.** Every custom metric (pace score, fuel save percentage) carries a one-line definition in the footer.
5. **Same structure everywhere.** Header, body and footer sit in the same places on every card, so followers learn to read them instantly.
6. **Series-agnostic core.** Layouts, type and data rules never assume NASCAR. Series differences live only in the series profile.
7. **Readable on a phone.** Cards are judged at roughly 375 px wide in a timeline. If it can't be read there, it has too much on it.

## Series theming system

Every series is described by one **series profile**: a small config file that the dashboard and card templates read. The shared design system (type, spacing, neutrals, data colors, layouts) never changes per series. Adding IndyCar means writing one new profile and testing the templates against it.

A series profile contains these fields:

| Field | What it controls | Example (Cup) |
| --- | --- | --- |
| `id` / display name | Header sub-line, series switcher | `cup` / "Cup Series" |
| Accent color | Venue line, rank-1 highlight, buttons | The series color, one value per theme: `#8F6B00` light / `#FFD100` dark |
| Brand | Header stripes on cards and dashboard; dashboard top bar colors | Yellow / red / blue stripes, black bar |
| Competitor unit | Whether rows are drivers or cars | Driver |
| Classes | Multi-class grouping and class colors | None (single class) |
| Driver markers | Suffixes shown after names | Series-defined set, e.g. (R), (i) |
| Stop types | Pit stop categories tracked | Four tire, two tire, fuel only |
| Segment name | What a race segment is called | Stage |
| Enabled templates | Which cards make sense | All NASCAR templates |

How the five planned series differ:

| Series | Status | Competitor unit | Classes | Strategy notes |
| --- | --- | --- | --- | --- |
| Cup Series | Primary | Driver | One | Stages, four/two tire stops, fuel only stops |
| O'Reilly Auto Parts Series | Launch | Driver | One | Same as Cup; Cup drivers appear as points-ineligible |
| Craftsman Truck Series | Launch | Driver | One | Same as Cup; shorter races, fewer stops |
| IMSA | Bonus, 2027 | Car (with driver lineup) | GTP, LMP2, GTD Pro, GTD | Multi-class traffic, driver changes, timed races |
| IndyCar | Later | Driver | One | Primary vs. alternate tires, push-to-pass, no stages |

To add a series: copy the closest existing profile, change the fields above, then render every enabled template with real data from one race and check the pre-posting checklist. Templates that don't make sense (Stage Pace Rankings for IndyCar) are simply disabled in the profile.

## Color system

Use a light theme for shareable cards and a dark theme for the live dashboard. Light cards stand out in a dark X timeline; dark screens are easier on the eyes over a three-hour race. Both themes use the same token names, so templates switch themes without changes.

**Neutrals**

| Token | Light (cards) | Dark (dashboard) | Use |
| --- | --- | --- | --- |
| `bg` | #F4F5F7 | #0F1115 | Page or card background |
| `surface` | #FFFFFF | #181B21 | Panels, table rows |
| `surface-alt` | #E9EBEF | #20242C | Zebra rows, header bands |
| `border` | #D5D9E0 | #2C313A | Dividers |
| `text` | #12151B | #EEF0F3 | Primary text and numbers |
| `text-muted` | #5B6270 | #9AA1AE | Labels, footnotes |

**Performance colors** carry meaning and are used only for good/middle/bad judgments, never decoration.

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| `perf-good` | #1E9E5A | #3DD68C | Best, faster, gained spots |
| `perf-mid` | #D98A00 | #F2B33D | Middle of field |
| `perf-bad` | #D33A3A | #F2645E | Slowest, lost spots |

**Strategy colors** are used in stint bars only: starting stint `#4A5160`, four tires `#2F7FE0`, two tires `#F29B1F`, fuel only `#8A5CF0`.

**Line-chart series** use a fixed categorical palette, assigned in rank order: `#2F7FE0`, `#E5484D`, `#F2B33D`, `#30A46C`, `#8E4EC6`, `#12A5B8`. Six lines is the maximum on one chart; past that, split it.

**Series accent** is the series color, from the series profile, and is used only for the venue line, the rank-1 highlight and buttons. It has a light and a dark value, because a color that reads on the dark dashboard (Cup yellow) can vanish on a light card; the light value must meet 3:1 on the card backgrounds. The dark value is exactly the dashboard header color (the bar color, or Cup's yellow highlight); it only draws the rank-1 bar, which repeats the rank number, so it is exempt from 3:1. Text on the accent is black or white, whichever has more contrast. O'Reilly green and Craftsman red sit close to `perf-good` and `perf-bad`, so the accent is never used on a number; performance colors still always sit next to a signed value.

**Series brand** also comes from the profile. Cards get a full-width band of series stripes under the header (Cup: yellow, red, blue). Every series has three stripes, so the band keeps the same height: O'Reilly runs green, red, green, and Craftsman red, black, red, top to bottom. The dashboard top bar takes the series bar color and the same stripes. Its font is Saira ExtraBold Italic for every series, a free lookalike, so the header doesn't shift when switching series. Colors are approximations sampled from the series logos, because no official values are published. Card bodies (driver rows, numbers) never change per series. Top-bar text must still meet 4.5:1 on the bar color, so darken the bar if needed (O'Reilly's bar is `#007A38` and Craftsman's `#B81E24`; their stripes use exactly the same values so the bar and band match).

## Typography

Three free Google Fonts cover everything: a condensed italic display face for titles, a clean sans for labels, and a monospaced face with even-width digits so times line up in columns.

| Role | Font | Style | Card size (at 1080 px wide) |
| --- | --- | --- | --- |
| Card title | Barlow Condensed | Bold italic, all caps | 64–72 px |
| Venue / race line | Barlow Condensed | Semibold, all caps | 28 px |
| Subtitle (metric definition) | Inter | Semibold italic, all caps | 18 px |
| Driver last name | Barlow Condensed | Bold, all caps | 30 px |
| Driver first name | Inter | Regular, all caps | 14 px, stacked above last name |
| Car number | Barlow Condensed | Black italic | 34 px |
| Times, gaps, ranks | JetBrains Mono | Semibold, tabular | 28 px |
| Column labels | Inter | Semibold, all caps, +4% tracking | 14 px |
| Footer | Inter | Regular italic | 13 px |

On the dashboard, scale everything to 60% of these sizes, with 14 px as the minimum. The dashboard uses no italics anywhere. Dashboard headers (series names, race name, panel titles) use Stainless Black and body text uses Stainless Regular, with the body switcher in NASCAR's logo face. These are licensed (purchased) fonts kept in `public/fonts`; Saira and Inter stand in for any face that's missing. The license generally doesn't allow redistribution, so keep the repository private. Right-align all numeric columns so decimals line up. Never set numbers in the display face.

## Layout, spacing and export sizes

Every card uses the same three zones, on an 8 px spacing grid with 56 px outer margins.

1. **Header:** title, then venue in the series accent, then race name · series · year, then the one-line metric definition. A full-width band of series stripes (6 px each) sits under the header.
2. **Body:** the table, chart or stint bars. Rows are 56–64 px tall with zebra striping. Rank 1 gets an accent left bar.
3. **Footer:** left side holds the metric footnote and lap range; right side holds the attribution ("Generated by \<your handle>").

| Format | Size (px) | Use |
| --- | --- | --- |
| Portrait 4:5 | 1080 × 1350 | Default for rankings and lists of up to 10 rows |
| Landscape 16:9 | 1600 × 900 | Line charts, lap distributions, wide strategy reports |
| Square 1:1 | 1080 × 1080 | Single-driver cards (pit crew summary, fuel save) |
| Tall 9:16 | 1080 × 1920 | Strategy reports with more than 5 drivers |

Export at 2× pixel density (PNG) so text stays sharp after X compresses the image. Keep 80 px clear at the bottom of 9:16 cards, where some apps overlay controls.

## Graphic templates catalog

Twelve templates cover what race-stats accounts post most. Build the first five for launch; the rest can follow.

| Template | Question it answers | Body | Format | Series | Phase |
| --- | --- | --- | --- | --- | --- |
| Top 10 Pace Rankings | Who has been fastest, adjusted for tire age? | Ranked table: car, name, pace score, gap to best % | 4:5 | All | Dropped: dashboard and API only, no image export |
| Top 10 Pit Stops | Which stops were quickest? | Ranked table with crew names under rank 1 | 4:5 | NASCAR | Launch |
| Four Tire Averages | Which crews are fastest on average? | Bar list, bars colored by performance | 4:5 | NASCAR | Launch |
| Strategy Report | How did the leaders' strategies differ? | Stint bars per driver plus stops, pit time, fuel | 4:5 or 9:16 | All | Launch |
| Lap Time Comparison | Who is faster over the last few laps? | Line chart, up to 6 drivers | 16:9 | All | Launch |
| Stage Pace Rankings | How did pace change stage to stage? | Three ranked columns with rank change | 16:9 | NASCAR | Later |
| Lap Time Distribution | Whose pace is fastest and most consistent? | One distribution per driver, median marked | 16:9 | All | Later |
| Fuel Save | Who is saving fuel, and how much? | Stat tiles: green flag laps, save laps, save %, optimal lap | 1:1 or 16:9 for two | All | Later |
| Pit Crew Summary | How did one crew perform? | Stop list plus crew roster | 1:1 | NASCAR | Later |
| Pit Lane Time Ranking | Who loses least time on pit road? | Ranked table: average lane time, stops | 4:5 | All | Later |
| Spots Gained | Who has moved forward most? | Ranked table, signed change colored | 4:5 | All | Later |
| Predicted Pace | Who should be fast before the race? | Ranked table with predicted lap time | 4:5 | All | Later |

IMSA versions add a class column or class grouping to every ranked table, and a driver-lineup line under the car number. Pit crew templates are disabled for IMSA and IndyCar until crew data is available.

## Data display rules

Consistent formatting matters more than any visual choice: followers compare cards across weeks.

| Value | Format | Example |
| --- | --- | --- |
| Lap time | Seconds, 3 decimals; minutes only above 99.999 s | 31.340s, 1:58.219 |
| Pit stop time | Seconds, 2 decimals | 8.30s |
| Gap to best (time) | Signed, 3 decimals | +0.212s |
| Gap to best (percent) | 2 decimals; leader shows 0.00% in `perf-good` | 0.69% |
| Fuel | Gallons for NASCAR, liters for IMSA and IndyCar, 1 decimal | 80.8 GAL |
| Position change | Signed integer, colored good/bad; zero shows an en dash | +10, −1, – |
| Lap range | Finished: "Laps 221–240". Live: stage, laps left in it, and lap of total | Stage 2: 31 laps to go · Lap 134/267 |

Other rules:

- **Names:** first name small above last name in caps. Use the name as the series lists it; keep suffixes like Jr.
- **Car numbers:** show exactly as listed, including leading zeros (00). The dashboard shows each team's stylized number artwork, served through `/api/v1/series/:id/car-badges/:number.png` from NASCAR's public badge images, with a thin light halo so dark artwork reads on dark rows. Fall back to the number in Barlow Condensed when no badge exists, and for fictional sample data. Use car numbers, not team logos.
- **Markers:** show the series' official suffixes, such as (R) for rookie and (i) for points-ineligible, defined in the series profile. Explain any marker in the footer the first time it appears on a card.
- **Ties:** equal values share a rank and are ordered by car number.
- **Exclusions:** if a driver is left out (damage, too few laps), say so in the footer, as in "Larson excluded: diffuser damage."
- **Live freshness:** every live card shows the last lap included. The dashboard shows data age, and turns it amber after 30 seconds without an update.

## Live dashboard UI

The dashboard is a dark-theme web page with a top bar and six tabs. It must work on a phone in the media center as well as on a laptop.

**Top bar:** series switcher, race name, current lap / total laps, flag state, and data age. The flag state is a colored chip: green, yellow, red, white or checkered.

| Tab | Shows | Export to card |
| --- | --- | --- |
| Overview | Running order, positions gained, last lap time per car | Spots Gained |
| Pace | Pace rankings by race and stage, lap time comparison picker | Lap Time Comparison, Distribution |
| Pit road | Latest stops, four and two tire averages, lane times | Top 10 Pit Stops, Four Tire Averages, Pit Crew Summary |
| Strategy | Stint bars for any selected drivers | Strategy Report |
| Fuel | Fuel save laps and percentages per car | Fuel Save |
| Compare | Two to six drivers side by side | Lap Time Comparison |

Behavior rules:

- Poll for new data every 5–10 seconds; never reload the page or lose the user's selections.
- Highlight changed rows for 2 seconds after an update, then return to normal.
- Under caution, gray out pace views and note that caution laps are excluded.
- Every view has an "Export card" button that opens the matching template, pre-filled, at its default size.
- Before the race, show the Predicted Pace view; after the checkered flag, label all views "Final."

## Branding, attribution and legal notes

Cards are branded with your own handle, not series marks. This keeps the graphics clearly independent and avoids trademark problems.

- Put "Generated by \<your handle>" in the bottom-right footer of every card, in `text-muted`.
- Do not use series, sponsor, manufacturer or team logos. The dashboard's team number badges are the one exception: it runs privately on your own server, and nothing is exported for posting.
- Series colors appear only as header stripes on cards and as the dashboard top bar. Card bodies stay neutral so posted graphics read as independent, not official.
- Series and race names are written in plain text, as the series names them.
- Note the data source once in your profile or a pinned post, such as "Timing data from public NASCAR live feeds; unofficial."
- Check each series' website terms of use before relying on its data feeds, and keep request rates low (no faster than the official site polls).
- Do not imitate another creator's card designs closely; borrow structure, not their exact look.

## Accessibility and pre-posting checklist

Text must meet 4.5:1 contrast against its background; large numbers and titles must meet 3:1. Color never carries meaning alone: performance colors always sit next to a signed number, and chart lines are labeled at their right end, not only in a legend. Test the line palette with a color-blindness simulator before launch.

Before posting a card:

- [ ] Title, venue, race name and series are correct for this race
- [ ] Lap range or "so far" stamp is present on live cards
- [ ] Metric definition is in the footer
- [ ] Any excluded drivers and markers are explained
- [ ] Numbers follow the formats in Data display rules
- [ ] Card is readable at phone size (check at 375 px wide)
- [ ] Exported at 2× as PNG at the right size for its template
- [ ] Alt text written for the post, stating the finding in one sentence
