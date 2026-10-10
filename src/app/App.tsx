import { useContext, useEffect, useState, type CSSProperties } from 'react';
import { SeriesStripes } from './SeriesStripes';
import type { SeriesProfile } from '../series/types';
import { neutrals, themeVars } from '../tokens/tokens';
import { BODIES, type BodyId } from '../series/bodies';
import { seriesList } from '../series/profiles';
import { api, isNoLive, type LiveStatus, type Source } from './api';
import { UpcomingHeader } from './UpcomingHeader';
import { DataError } from './NoLive';
import { SourceContext, useSeriesApi } from './useApi';
import { CompareTab } from './CompareTab';
import { FuelTab } from './FuelTab';
import { OverviewTab } from './OverviewTab';
import { PitRoadTab } from './PitRoadTab';
import { StrategyTab } from './StrategyTab';
import { PaceView } from './PaceView';
import { LapBar } from './LapBar';
import { RaceStatus } from './RaceStatus';
import { TrackLogo } from './TrackLogo';
import { TvLogo } from './TvLogo';

const SERIES_KEY = 'td.series';
const TAB_KEY = 'td.tab';
const SOURCE_KEY = 'td.source';
const LIVE_REFRESH_MS = 5_000;
/** The badge turns amber when the server hasn't reached NASCAR's feed for this long. */
const STALE_MS = 30_000;
/** Longest the first paint waits for the server's choice of series. */
const HOME_WAIT_MS = 1_000;

const TABS = [
  { id: 'overview', label: 'Overview', ready: true },
  { id: 'pace', label: 'Pace', ready: true },
  { id: 'pit', label: 'Pit road', ready: true },
  { id: 'strategy', label: 'Strategy', ready: true },
  { id: 'fuel', label: 'Fuel', ready: true },
  { id: 'compare', label: 'Compare', ready: true },
] as const;
type TabId = (typeof TABS)[number]['id'];

function savedTab(): TabId {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return TABS.find((x) => x.id === t && x.ready)?.id ?? 'overview';
  } catch {
    return 'overview';
  }
}

function saved(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

/** Owns the Live/Sample choice and provides it (with the refresh rate) to every view. */
export function App() {
  const [source, setSource] = useState<Source>(saved(SOURCE_KEY) === 'sample' ? 'sample' : 'live');
  const choose = (s: Source) => {
    setSource(s);
    remember(SOURCE_KEY, s);
  };
  return (
    <SourceContext.Provider value={{ source, refreshMs: source === 'live' ? LIVE_REFRESH_MS : 0 }}>
      <Dashboard onSource={choose} />
    </SourceContext.Provider>
  );
}

/**
 * Polls what's live (any series). `stale` means the server hasn't reached NASCAR's feed for
 * STALE_MS: about the connection, not laps (qualifying or a red flag can go a long time
 * without a lap completing while the data is current).
 */
function useLiveStatus(source: Source) {
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [skew, setSkew] = useState(0); // server clock minus ours
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (source !== 'live') return;
    const load = () =>
      api.live().then(
        (r) => {
          setLive(r.live);
          setSkew(r.now - Date.now());
          setLoaded(true);
        },
        () => {
          setLive(null);
          setLoaded(true);
        },
      );
    void load();
    const poll = setInterval(load, LIVE_REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [source]);
  return { live, loaded, stale: live ? now + skew - live.polledAt > STALE_MS : false };
}

function SourceToggle({ onSource }: { onSource: (s: Source) => void }) {
  const { source } = useContext(SourceContext);
  return (
    <div className="seg seg-bar" role="group" aria-label="Data source">
      {(['live', 'sample'] as const).map((s) => (
        <button key={s} className={source === s ? 'active' : undefined} aria-pressed={source === s} onClick={() => onSource(s)}>
          {s === 'live' ? 'Live' : 'Sample'}
        </button>
      ))}
    </div>
  );
}

function LiveBadge({ live, stale, seriesId, final }: { live: LiveStatus | null; stale: boolean; seriesId: string; final?: boolean }) {
  const { source } = useContext(SourceContext);
  if (source === 'sample') return <span className="chip">Replay</span>;
  // A race that's over, shown until its weekend ends.
  if (final) return <span className="chip final-chip" title="This race is over; shown until Monday 00:00 ET">Final</span>;
  if (!live?.active || live.seriesId !== seriesId) return null;
  return (
    <span
      className={`chip live-chip${stale ? ' is-stale' : ''}`}
      title={stale ? "Can't reach NASCAR's live feed; data may be out of date" : 'Live feed connected'}
    >
      <i aria-hidden /> Live
    </span>
  );
}

function savedSeries() {
  try {
    return localStorage.getItem(SERIES_KEY);
  } catch {
    return null;
  }
}

function Dashboard({ onSource }: { onSource: (s: Source) => void }) {
  // Profiles ship in the bundle (same module the API serves), so the bar has its series colors
  // on the first paint instead of flashing the default and then switching.
  const series: SeriesProfile[] = seriesList;
  const [seriesId, setSeriesId] = useState<string>(savedSeries() ?? 'cup');
  const { source } = useContext(SourceContext);
  const { live, stale } = useLiveStatus(source);
  // On page load in live mode, open to the series the server picks (the live race; Fri-Sun the
  // series racing next; Mon-Thu Cup). Once only, so it never overrides a later pick. The page
  // waits for the answer (up to HOME_WAIT_MS) so it doesn't draw one series and jump to another.
  const [homeReady, setHomeReady] = useState(source !== 'live');
  useEffect(() => {
    if (homeReady) return;
    let done = false;
    const finish = (id?: string) => {
      if (done) return;
      done = true;
      if (id && seriesList.some((s) => s.id === id)) setSeriesId(id);
      setHomeReady(true);
    };
    api.home().then((r) => finish(r.seriesId), () => finish());
    const t = setTimeout(() => finish(), HOME_WAIT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [body, setBody] = useState<BodyId>('nascar');
  const [tab, setTab] = useState<TabId>(savedTab);
  const chooseTab = (t: TabId) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* private mode */
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(SERIES_KEY, seriesId);
    } catch {
      /* private mode */
    }
  }, [seriesId]);
  // The header (race, lap counter, flag) comes from the pace card, refreshed live.
  const { data: card, error: cardError } = useSeriesApi(api.paceRankings, seriesId);

  const profile = series.find((s) => s.id === seriesId);
  const accent = profile?.accent.dark ?? neutrals.dark['text-muted'];
  const brand = profile?.brand.dashboard;

  if (!homeReady) return <div className="dash" style={themeVars('dark', accent)} aria-busy />;
  return (
    <div className="dash" style={themeVars('dark', accent)}>
      <header
        className="topbar"
        style={
          brand && {
            '--bar-bg': brand.barBg,
            '--bar-fg': brand.barFg,
            '--bar-muted': brand.barMuted,
            '--bar-highlight': brand.highlight,
          } as CSSProperties
        }
      >
        <div className="topbar-row">
          <nav className="series-switch" aria-label="Series">
            {series.filter((s) => s.body === body).map((s) => (
              <button key={s.id} className={s.id === seriesId ? 'active' : undefined} onClick={() => setSeriesId(s.id)}>
                {s.displayName}
              </button>
            ))}
          </nav>
          <div className="topbar-right">
          <label className="body-switch">
            <span className="visually-hidden">Sanctioning body</span>
            <select value={body} onChange={(e) => setBody(e.target.value as BodyId)}>
              {BODIES.map((b) => (
                <option key={b.id} value={b.id} disabled={!b.available}>
                  {b.available ? b.name : `${b.name} (coming soon)`}
                </option>
              ))}
            </select>
          </label>
          <SourceToggle onSource={onSource} />
          </div>
        </div>
        {card && (
          <div className="race-meta">
            <div className="race-summary">
              {card.header.logoUrl && <TrackLogo url={card.header.logoUrl} alt={card.header.venue} />}
              <div className="race-info">
                <div className="race-title">
                  <span className="race-name">{card.header.raceName}</span>
                  {card.header.location && <span className="race-location">{card.header.location}</span>}
                </div>
                <div className="race-progress">
                  <RaceStatus lines={card.statusLines} flag={card.flag} />
                  {card.progress && (
                    <LapBar segments={card.flagSegments} totalLaps={card.progress.totalLaps} stageEnds={card.stageEnds} />
                  )}
                </div>
              </div>
            </div>
            <div className="race-badges">
              {card.header.tv && <TvLogo network={card.header.tv} />}
              <LiveBadge live={live} stale={stale} seriesId={seriesId} final={card.final} />
            </div>
          </div>
        )}
        {/* Holds the header's space while the first data loads, so the tabs don't jump down. */}
        {!card && cardError == null && <div className="race-meta is-pending" aria-hidden />}
        {!card && cardError != null && (
          <div className="race-meta">
            {isNoLive(cardError) ? <UpcomingHeader seriesId={seriesId} /> : <span className="race-location">Timing data unavailable</span>}
          </div>
        )}
        <nav className="tabs" aria-label="Views">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={t.id === tab ? 'active' : undefined}
              aria-current={t.id === tab ? 'page' : undefined}
              disabled={!t.ready}
              onClick={() => chooseTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      {profile && <SeriesStripes colors={profile.brand.stripes} className="topbar-stripes" />}
      <main>
        {tab === 'overview' && <OverviewTab seriesId={seriesId} showNextRace={card?.showNextRace} />}
        {tab === 'pace' && card && <PaceView card={card} />}
        {tab === 'pace' && !card && cardError != null && <DataError error={cardError} />}
        {tab === 'pit' && <PitRoadTab seriesId={seriesId} />}
        {tab === 'strategy' && <StrategyTab seriesId={seriesId} />}
        {tab === 'fuel' && <FuelTab seriesId={seriesId} />}
        {tab === 'compare' && <CompareTab seriesId={seriesId} key={seriesId} />}
      </main>
    </div>
  );
}
