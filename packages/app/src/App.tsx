import { useEffect } from 'react';
import { useGame, type Screen } from './state/store.js';
import { useT } from './i18n/index.js';
import { Menu } from './screens/Menu.js';
import { CreatePlayer } from './screens/CreatePlayer.js';
import { AcademyChoice } from './screens/AcademyChoice.js';
import { Hub } from './screens/Hub.js';
import { MatchCentre } from './screens/MatchCentre.js';
import { ClubScreen } from './screens/ClubScreen.js';
import { TrainingScreen } from './screens/TrainingScreen.js';
import { MarketScreen } from './screens/MarketScreen.js';
import { CareerScreen } from './screens/CareerScreen.js';
import { NationalScreen } from './screens/NationalScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { DecisionSheet } from './screens/DecisionSheet.js';

export function App() {
  const phase = useGame((s) => s.phase);
  const boot = useGame((s) => s.boot);

  useEffect(() => {
    void boot();
  }, [boot]);

  if (phase === 'loading') {
    return (
      <div className="app">
        <div className="screen" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
          <span className="eyebrow">···</span>
        </div>
      </div>
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
  const pending = state?.pendingDecisions[0] ?? null;

  return (
    <div className="app">
      {screen === 'hub' && <Hub />}
      {screen === 'match' && <MatchCentre />}
      {screen === 'club' && <ClubScreen />}
      {screen === 'train' && <TrainingScreen />}
      {screen === 'market' && <MarketScreen />}
      {screen === 'career' && <CareerScreen />}
      {screen === 'national' && <NationalScreen />}
      {screen === 'settings' && <SettingsScreen />}

      {!pending && !state?.retired && <ContinueDock />}
      <Tabs />
      {pending && <DecisionSheet decision={pending} />}
      <Toast />
    </div>
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
      <button className="continue" disabled={busy} onClick={() => advance(52)}>
        {injured ? t('action.continueTo') : t('action.continue')}
      </button>
    </div>
  );
}

const TABS: { id: Screen; key: string; icon: JSX.Element }[] = [
  { id: 'hub', key: 'nav.hub', icon: <IconHome /> },
  { id: 'club', key: 'nav.club', icon: <IconShield /> },
  { id: 'train', key: 'nav.train', icon: <IconPulse /> },
  { id: 'market', key: 'nav.market', icon: <IconSwap /> },
  { id: 'career', key: 'nav.career', icon: <IconTrophy /> },
];

function Tabs() {
  const t = useT();
  const screen = useGame((s) => s.screen);
  const goto = useGame((s) => s.goto);
  const state = useGame((s) => s.state);
  const unread = state?.inbox.filter((m) => !m.read).length ?? 0;
  const offers = state?.transferOffers.length ?? 0;

  return (
    <nav className="tabs">
      {TABS.map((tab) => {
        const active = screen === tab.id || (tab.id === 'hub' && screen === 'match');
        const badge = tab.id === 'hub' ? unread : tab.id === 'market' ? offers : 0;
        return (
          <button key={tab.id} className={`tab ${active ? 'tab-active' : ''}`} onClick={() => goto(tab.id)}>
            {tab.icon}
            <span>{t(tab.key)}</span>
            {badge > 0 && <em className="tab-badge">{badge}</em>}
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

/* Icons are drawn inline: two flat strokes each, so they read at 20px on a phone. */
function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z" />
      <path d="M12 8v8M8.5 11h7" />
    </svg>
  );
}
function IconPulse() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />
    </svg>
  );
}
function IconSwap() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M10 19h4M12 14v5" />
    </svg>
  );
}
