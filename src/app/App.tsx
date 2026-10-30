import { useEffect, useState, type CSSProperties } from 'react';
import { BODIES, type BodyId } from '../series/bodies';
import { seriesList } from '../series/profiles';
import { neutrals, themeVars } from '../tokens/tokens';
import { api } from './api';
import { ChaseTab } from './ChaseTab';
import { CompareTab } from './CompareTab';
import { FuelTab } from './FuelTab';
import { DataError } from './NoLive';
import { OverviewTab } from './OverviewTab';
import { PaceView } from './PaceView';
import { PitRoadTab } from './PitRoadTab';
import { RaceHeader } from './RaceHeader';
import { SeriesStripes } from './SeriesStripes';
import { load, store } from './storage';
import { StrategyTab } from './StrategyTab';
import { LiveContext, useSeriesApi } from './useApi';
import { useLiveStatus, type LiveState } from './useLiveStatus';
import { useTheme } from './useTheme';

const KEYS = { series: 'td.series', tab: 'td.tab' };
/** Longest the first paint waits for the server's choice of series. */
const HOME_WAIT_MS = 1_000;

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pace', label: 'Pace' },
  { id: 'pit', label: 'Pit road' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'compare', label: 'Compare' },
  { id: 'chase', label: 'Chase' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Owns what's live and shares it with every view. */
export function App() {
  const status = useLiveStatus();
  return (
    <LiveContext.Provider value={{ liveSeriesId: status.live?.active ? status.live.seriesId : null, liveDataAt: status.live?.dataAt }}>
      <Dashboard status={status} />
    </LiveContext.Provider>
  );
}

/**
 * On page load, the series the server picks (the live race's; Friday-Sunday the next
 * race's; else Cup), once. The page waits for it (up to HOME_WAIT_MS) rather than drawing one
 * series and jumping to another.
 */
function useHomeSeries(setSeriesId: (id: string) => void) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    let done = false;
    const finish = (id?: string) => {
      if (done) return;
      done = true;
      if (id && seriesList.some((s) => s.id === id)) setSeriesId(id);
      setReady(true);
    };
    api.home().then((r) => finish(r.seriesId), () => finish());
    const t = setTimeout(() => finish(), HOME_WAIT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready;
}

function Dashboard({ status }: { status: LiveState }) {
  const [seriesId, setSeriesId] = useState(load(KEYS.series) ?? 'cup');
  const [tab, setTab] = useState<TabId>(() => TABS.find((t) => t.id === load(KEYS.tab))?.id ?? 'overview');
  const [body, setBody] = useState<BodyId>('nascar');
  const homeReady = useHomeSeries(setSeriesId);
  useEffect(() => store(KEYS.series, seriesId), [seriesId]);
  const chooseTab = (t: TabId) => {
    setTab(t);
    store(KEYS.tab, t);
  };
  // The header (race, lap counter, flag) comes from the pace card.
  const { data: card, error: cardError } = useSeriesApi(api.paceRankings, seriesId);

  // Profiles ship in the bundle, so the bar has its series colors on the first paint.
  const profile = seriesList.find((s) => s.id === seriesId);
  const mode = useTheme();
  const theme = themeVars(mode, profile?.accent[mode] ?? neutrals[mode]['text-muted']);
  const brand = profile?.brand.dashboard;
  const barColors = brand && ({ '--bar-bg': brand.barBg, '--bar-fg': brand.barFg, '--bar-muted': brand.barMuted, '--bar-highlight': brand.highlight } as CSSProperties);

  if (!homeReady) return <div className="dash" style={theme} aria-busy />;
  return (
    <div className="dash" style={theme}>
      <header className="topbar" style={barColors}>
        <div className="topbar-row">
          <nav className="series-switch" aria-label="Series">
            {seriesList
              .filter((s) => s.body === body)
              .map((s) => (
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
          </div>
        </div>
        <RaceHeader seriesId={seriesId} card={card} cardError={cardError} live={status.live} stale={status.stale} />
        <nav className="tabs" aria-label="Views">
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'active' : undefined} aria-current={t.id === tab ? 'page' : undefined} onClick={() => chooseTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      {profile && <SeriesStripes colors={profile.brand.stripes} className="topbar-stripes" />}
      <main>
        {tab === 'overview' && <OverviewTab seriesId={seriesId} showNextRace={card?.showNextRace} final={card?.final} />}
        {tab === 'pace' && card && <PaceView card={card} />}
        {tab === 'pace' && !card && cardError != null && <DataError error={cardError} />}
        {tab === 'pit' && <PitRoadTab seriesId={seriesId} />}
        {tab === 'strategy' && <StrategyTab seriesId={seriesId} />}
        {tab === 'fuel' && <FuelTab seriesId={seriesId} />}
        {tab === 'compare' && <CompareTab seriesId={seriesId} key={seriesId} />}
        {tab === 'chase' && <ChaseTab seriesId={seriesId} key={seriesId} />}
      </main>
    </div>
  );
}
