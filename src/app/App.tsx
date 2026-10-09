import { useContext, useEffect, useState, type CSSProperties } from 'react';
import { SeriesStripes } from './SeriesStripes';
import type { SeriesProfile } from '../series/types';
import { neutrals, themeVars } from '../tokens/tokens';
import { BODIES, type BodyId } from '../series/bodies';
import { api, type LiveStatus, type Source } from './api';
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

const SERIES_KEY = 'td.series';
const TAB_KEY = 'td.tab';
const SOURCE_KEY = 'td.source';
const LIVE_REFRESH_MS = 5_000;
/** DESIGN.md: data age turns amber after 30 s without an update. */
const STALE_MS = 30_000;

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
    <SourceContext.Provider value={{ source, refreshMs: source === 'live' ? LIVE_REFRESH_MS : 0, useSample: () => choose('sample') }}>
      <Dashboard onSource={choose} />
    </SourceContext.Provider>
  );
}

/** "3s", "2m 05s" */
const age = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

function SourceStatus({ onSource, seriesId }: { onSource: (s: Source) => void; seriesId: string }) {
  const { source } = useContext(SourceContext);
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [skew, setSkew] = useState(0); // server clock minus ours
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (source !== 'live') return;
    const load = () =>
      api.live().then(
        (r) => {
          setLive(r.live);
          setSkew(r.now - Date.now());
        },
        () => setLive(null),
      );
    void load();
    const poll = setInterval(load, LIVE_REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [source]);
  const since = live ? now + skew - live.updatedAt : 0;
  return (
    <div className="source-status">
      <div className="seg seg-bar" role="group" aria-label="Data source">
        {(['live', 'sample'] as const).map((s) => (
          <button key={s} className={source === s ? 'active' : undefined} aria-pressed={source === s} onClick={() => onSource(s)}>
            {s === 'live' ? 'Live' : 'Sample'}
          </button>
        ))}
      </div>
      {source === 'live' && live?.active && live.seriesId === seriesId && (
        <span className={`chip live-chip${since > STALE_MS ? ' is-stale' : ''}`} title="Time since the live feed last changed">
          <i aria-hidden /> Live · {age(since)}
        </span>
      )}
      {source === 'sample' && <span className="chip">Replay</span>}
    </div>
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
  const { useSample } = useContext(SourceContext);
  const [series, setSeries] = useState<SeriesProfile[]>([]);
  const [seriesId, setSeriesId] = useState<string>(savedSeries() ?? 'cup');
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.series().then(setSeries, (e) => setError(String(e)));
  }, []);

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
            <SourceStatus onSource={onSource} seriesId={seriesId} />
          </div>
        )}
        {!card && cardError != null && (
          <div className="race-meta">
            <span className="race-location">No live session for this series</span>
            <SourceStatus onSource={onSource} seriesId={seriesId} />
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
        {error && <p className="error">{error}</p>}
        {tab === 'overview' && <OverviewTab seriesId={seriesId} />}
        {tab === 'pace' && card && <PaceView card={card} />}
        {tab === 'pace' && !card && cardError != null && <DataError error={cardError} onUseSample={useSample} />}
        {tab === 'pit' && <PitRoadTab seriesId={seriesId} />}
        {tab === 'strategy' && <StrategyTab seriesId={seriesId} />}
        {tab === 'fuel' && <FuelTab seriesId={seriesId} />}
        {tab === 'compare' && <CompareTab seriesId={seriesId} key={seriesId} />}
      </main>
    </div>
  );
}
