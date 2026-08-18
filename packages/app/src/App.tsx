import { useEffect } from 'react';
import { useGame, type Screen } from './state/store.js';
import { useT } from './i18n/index.js';
import { Menu } from './screens/Menu.js';
import { CreatePlayer } from './screens/CreatePlayer.js';
import { AcademyChoice } from './screens/AcademyChoice.js';
import { Hub } from './screens/Hub.js';
import { MatchCentre } from './screens/MatchCentre.js';
import { MatchesScreen } from './screens/MatchesScreen.js';
import { ClubScreen } from './screens/ClubScreen.js';
import { TrainingScreen } from './screens/TrainingScreen.js';
import { MarketScreen } from './screens/MarketScreen.js';
import { CareerScreen } from './screens/CareerScreen.js';
import { NationalScreen } from './screens/NationalScreen.js';
import { SocialScreen } from './screens/SocialScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { DecisionSheet } from './screens/DecisionSheet.js';
import { ResultSheet } from './screens/ResultSheet.js';

/**
 * One stadium photograph carries the whole game; each screen only shifts how far
 * it is dimmed, so screens with dense numbers stay readable.
 */
const STADIUM = '/bg/stadium.jpg';

const SCREEN_DIM: Partial<Record<Screen, number>> = {
  hub: 0.72,
  match: 0.78,
  matches: 0.84,
  club: 0.86,
  train: 0.86,
  market: 0.84,
  career: 0.84,
  social: 0.8,
  national: 0.8,
  settings: 0.88,
};

export function App() {
  const phase = useGame((s) => s.phase);
  const boot = useGame((s) => s.boot);

  useEffect(() => {
    void boot();
  }, [boot]);

  if (phase === 'loading') {
    return (
      <>
        <Stadium dim={0.9} />
        <div className="app">
          <div className="screen" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
            <span className="eyebrow">···</span>
          </div>
        </div>
      </>
    );
  }

  if (phase === 'menu') return <Menu />;
  if (phase === 'create') return <CreatePlayer />;
  if (phase === 'academy') return <AcademyChoice />;
  return <Game />;
}

function Game() {
  const screen = useGame((s) => s.screen);
  const state = useGame((s) => s.state);
  const result = useGame((s) => s.result);
  const pending = state?.pendingDecisions[0] ?? null;
  const dim = SCREEN_DIM[screen] ?? 0.84;

  return (
    <>
      <Stadium dim={dim} />
      <div className="app">
        {screen === 'hub' && <Hub />}
        {screen === 'match' && <MatchCentre />}
        {screen === 'matches' && <MatchesScreen />}
        {screen === 'club' && <ClubScreen />}
        {screen === 'train' && <TrainingScreen />}
        {screen === 'market' && <MarketScreen />}
        {screen === 'career' && <CareerScreen />}
        {screen === 'national' && <NationalScreen />}
        {screen === 'social' && <SocialScreen />}
        {screen === 'settings' && <SettingsScreen />}

        {!pending && !result && !state?.retired && <ContinueDock />}
        <Tabs />
        {result && <ResultSheet result={result} />}
        {!result && pending && <DecisionSheet decision={pending} />}
        <Toast />
      </div>
    </>
  );
}

/** The stadium behind everything, with a dimming veil tuned per screen. */
function Stadium({ dim }: { dim: number }) {
  return (
    <>
      <div className="backdrop" />
      <div
        className="backdrop-photo"
        style={{ backgroundImage: `url(${STADIUM})`, opacity: 1 }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          background: `linear-gradient(180deg, rgba(6,11,24,${dim * 0.8}), rgba(6,11,24,${dim}) 55%, rgba(5,9,20,${Math.min(0.97, dim + 0.12)}))`,
        }}
      />
    </>
  );
}

function ContinueDock() {
  const t = useT();
  const advance = useGame((s) => s.advance);
  const busy = useGame((s) => s.busy);
  const state = useGame((s) => s.state);
  const injured = (state?.player.condition.injuries.length ?? 0) > 0;

  return (
    <div className="continue-dock">
      <button className={`continue ${injured ? 'continue-alt' : ''}`} disabled={busy} onClick={() => advance(52)}>
        {injured ? t('action.continueTo') : t('action.continue')}
      </button>
    </div>
  );
}

const TABS: { id: Screen; key: string; icon: JSX.Element }[] = [
  { id: 'hub', key: 'nav.hub', icon: <IconHome /> },
  { id: 'matches', key: 'nav.matches', icon: <IconBall /> },
  { id: 'club', key: 'nav.club', icon: <IconShield /> },
  { id: 'social', key: 'nav.social', icon: <IconChat /> },
  { id: 'career', key: 'nav.career', icon: <IconTrophy /> },
];

function Tabs() {
  const t = useT();
  const screen = useGame((s) => s.screen);
  const goto = useGame((s) => s.goto);
  const state = useGame((s) => s.state);
  const unread = state?.inbox.filter((m) => !m.read).length ?? 0;
  const actionsLeft = state ? state.socialActions.perWeek - state.socialActions.used : 0;

  return (
    <nav className="tabs">
      {TABS.map((tab) => {
        const active =
          screen === tab.id ||
          (tab.id === 'matches' && screen === 'match') ||
          (tab.id === 'career' && (screen === 'national' || screen === 'settings')) ||
          (tab.id === 'club' && (screen === 'train' || screen === 'market'));
        const badge = tab.id === 'hub' ? unread : tab.id === 'social' ? actionsLeft : 0;
        return (
          <button key={tab.id} className={`tab ${active ? 'tab-active' : ''}`} onClick={() => goto(tab.id)}>
            {tab.icon}
            <span>{t(tab.key)}</span>
            {badge > 0 && (
              <em className="tab-badge" style={tab.id === 'social' ? { background: 'var(--amber)', color: '#17120a' } : undefined}>
                {badge}
              </em>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function Toast() {
  const toast = useGame((s) => s.toast);
  const showToast = useGame((s) => s.showToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => showToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast, showToast]);

  if (!toast) return null;
  return <div className="toast">{toast}</div>;
}

function IconHome() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function IconBall() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m12 7.5 3.6 2.6-1.4 4.3H9.8L8.4 10.1z" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M20 12a7 7 0 0 1-7 7H8l-4 3v-4.5A7 7 0 0 1 4 12a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7z" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M10 19h4M12 14v5" />
    </svg>
  );
}
