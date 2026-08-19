import { useEffect, useRef, useState } from 'react';
import { useGame, type Screen } from './state/store.js';
import { useT } from './i18n/index.js';
import { Menu } from './screens/Menu.js';
import { ThemeMusic } from './components/ThemeMusic.js';
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
import { MentorScreen } from './screens/MentorScreen.js';
import { ResultSheet } from './screens/ResultSheet.js';
import { nextFixture } from './state/selectors.js';

/**
 * One stadium photograph carries the whole game; each screen only shifts how far
 * it is dimmed, so screens with dense numbers stay readable.
 */
const STADIUM = '/bg/stadium.jpg';

const SCREEN_DIM: Partial<Record<Screen, number>> = {
  hub: 0.6,
  match: 0.68,
  matches: 0.78,
  club: 0.8,
  train: 0.8,
  market: 0.78,
  career: 0.78,
  social: 0.72,
  national: 0.7,
  settings: 0.84,
};

export function App() {
  const phase = useGame((s) => s.phase);
  const boot = useGame((s) => s.boot);
  useBackGesture();

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

  // The theme plays over the title screen and the making of a player, and stops when
  // the career starts.
  const music = <ThemeMusic playing={phase === 'menu' || phase === 'create' || phase === 'academy'} />;
  // The toast has to exist before a career does: the back gesture says "again to leave"
  // on the title screen and while a player is being made, and that has to be readable.
  if (phase === 'menu') return <>{music}<Menu /><Toast /></>;
  if (phase === 'create') return <>{music}<CreatePlayer /><Toast /></>;
  if (phase === 'academy') return <>{music}<AcademyChoice /><Toast /></>;
  return <Game />;
}

function Game() {
  const screen = useGame((s) => s.screen);
  const state = useGame((s) => s.state);
  const result = useGame((s) => s.result);
  const liveMatchId = useGame((s) => s.liveMatchId);
  // While a match is being watched, nothing else may advance the week from under it.
  const watchingMatch = screen === 'match' && liveMatchId !== null && liveMatchId === state?.lastMatch?.id;
  // The dressing room at the interval counts as being in the match: he is standing
  // there in his kit, and the game has not finished.
  const inTheMatch = watchingMatch || state?.pendingHalfTime != null;
  // Only the questions that change the career stop him. The rest are in his mail, and
  // he answers them when he opens it. Nobody asks him anything while he is still
  // playing: a reporter asking how the game went, at half time, is nonsense, so
  // whatever is waiting waits behind the final whistle.
  const pending = inTheMatch
    ? null
    : state?.pendingDecisions.find((decision) => decision.blocking !== false) ?? null;
  const dim = SCREEN_DIM[screen] ?? 0.84;

  return (
    <>
      <Stadium dim={dim} />
      {/* The ground while he is out there; the season loop everywhere else. */}
      <ThemeMusic playing={inTheMatch} track="matchday" />
      <ThemeMusic playing={!inTheMatch} track="season" />
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
        {screen === 'mentor' && <MentorScreen />}

        {!pending && !result && !state?.retired && !inTheMatch && <ContinueDock />}
        <Tabs />
        {result && <ResultSheet result={result} />}
        {!result && pending && <DecisionSheet decision={pending} />}
        <Toast />
      </div>
    </>
  );
}

/** The stadium behind everything, inside the phone frame, dimmed per screen. */
function Stadium({ dim }: { dim: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="device-frame">
      {failed && <div className="backdrop" />}
      {!failed && <img src={STADIUM} alt="" className="backdrop-photo" onError={() => setFailed(true)} />}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(6,11,24,${dim * 0.78}), rgba(6,11,24,${dim}) 55%, rgba(5,9,20,${Math.min(0.97, dim + 0.1)}))`,
        }}
      />
    </div>
  );
}

/**
 * The back gesture: a swipe from the edge on a phone, the arrow in a browser.
 *
 * Left alone it leaves the game, which is a brutal thing to do to somebody four seasons
 * into a career - or six screens into making a player. So the game keeps an entry of its
 * own on the history stack, the gesture pops it, and the game puts another back in the
 * same breath, so the browser never reaches the entry underneath.
 *
 * The entry is only pushed once he has touched the screen, and this is the whole trick:
 * Chrome marks history entries pushed before any interaction as skippable and the back
 * gesture walks straight past them, which is exactly why the guard did nothing on the
 * screen where a player is made. Once the document has been touched, the entries stand.
 *
 * What the gesture means, in order: whatever screen is open gets first refusal - a form
 * with steps of its own steps back through them - then the screens he came through, then
 * his own screen. Only when there is nowhere left to go does it mean leaving, and even
 * then not on the first ask: the first one says so and the second one does it.
 */
const EXIT_WINDOW = 2600;

function useBackGesture(): void {
  const t = useT();
  const say = useRef(t);
  say.current = t;

  useEffect(() => {
    let spares = 0;
    let armedAt = 0;
    let leaving = false;

    const spare = () => {
      window.history.pushState({ game: true }, '');
      spares++;
    };
    // One goes on straight away, and a second the moment he touches the screen. Both are
    // needed: Chrome treats an entry pushed before any interaction as noise and walks
    // past it on the way back, so the one that actually holds is the one pushed after a
    // touch - and until he has touched anything, the one pushed at load is all there is.
    spare();
    let armed = false;
    const arm = () => {
      if (armed) return;
      armed = true;
      spare();
    };
    const touch = ['pointerdown', 'keydown', 'touchstart'] as const;
    for (const event of touch) window.addEventListener(event, arm, { passive: true });

    const onPop = () => {
      if (leaving) return;
      spares = Math.max(0, spares - 1);
      const game = useGame.getState();

      // The screen in front of him first: a form in the middle of its own steps.
      if (game.backHandler?.()) {
        spare();
        armedAt = 0;
        return;
      }

      // Then the way he came. A match is the one thing with no way back out of it.
      const inTheMatch = game.liveMatchId !== null || game.state?.pendingHalfTime != null;
      const canStepBack =
        game.phase === 'playing' && !inTheMatch && (game.trail.length > 0 || game.screen !== 'hub');
      if (canStepBack) {
        spare();
        game.back();
        armedAt = 0;
        return;
      }

      // Nowhere left to go. Say it once, and mean it the second time.
      if (Date.now() - armedAt < EXIT_WINDOW) {
        leaving = true;
        game.showToast(null);
        // Past every entry the game put on the stack and the one it was loaded on, which
        // is what leaving actually means: installed on a phone, that closes the app. One
        // step would only land on the entry the app itself occupies, and he would still
        // be here.
        window.history.go(-(spares + 1));
        // Opened as a plain tab with nothing behind it, the browser cannot go anywhere
        // and he is still on this screen, so the guard has to come back rather than
        // leaving him with a gesture that does nothing for ever.
        window.setTimeout(() => {
          leaving = false;
          armedAt = 0;
          if (spares === 0) spare();
        }, 600);
        return;
      }
      armedAt = Date.now();
      spare();
      game.showToast(say.current('action.backAgainToExit'));
    };

    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      for (const event of touch) window.removeEventListener(event, arm);
    };
  }, []);
}

function ContinueDock() {
  const t = useT();
  const advance = useGame((s) => s.advance);
  const goto = useGame((s) => s.goto);
  const screen = useGame((s) => s.screen);
  const busy = useGame((s) => s.busy);
  const state = useGame((s) => s.state);
  const injured = (state?.player.condition.injuries.length ?? 0) > 0;
  // The final whistle is not the start of the next week. Leaving the match report used
  // to run the clock straight into the following fixture, so his mail, his training and
  // everything else his club wanted from him went past unread. Now the whistle puts him
  // back on his own screen, and the week only moves when he says so.
  const afterMatch = screen === 'match' && state?.lastMatch != null;
  // A button should say what happens when it is pressed. With his club playing this
  // week, pressing it kicks a match off; the rest of the year it walks the calendar on.
  const upcoming = state && !afterMatch ? nextFixture(state) : null;
  const kickOff = upcoming != null && upcoming.fixture.week === state?.world.week;
  const label = afterMatch
    ? t('action.doneWithMatch')
    : kickOff
      ? t('action.startMatch')
      : injured
        ? t('action.continueTo')
        : t('action.continue');

  return (
    <div className="continue-dock">
      <button
        className={`continue ${injured && !afterMatch && !kickOff ? 'continue-alt' : ''}`}
        disabled={busy}
        onClick={() => (afterMatch ? goto('hub') : advance(52))}
      >
        {label}
      </button>
    </div>
  );
}

/**
 * Four places he goes constantly, and everything else behind one button.
 *
 * The bar used to be five tabs where three of them were doors to somewhere else: club
 * hid training and the transfer market, career hid the national team and settings. That
 * meant the way to reach half the game was to guess which tab it was filed under. Now
 * the four he actually lives in are on the bar and the rest is a list he can read.
 */
const TABS: { id: Screen; key: string; icon: JSX.Element }[] = [
  { id: 'hub', key: 'nav.hub', icon: <IconHome /> },
  { id: 'matches', key: 'nav.matches', icon: <IconBall /> },
  { id: 'club', key: 'nav.club', icon: <IconShield /> },
  { id: 'social', key: 'nav.social', icon: <IconChat /> },
];

/** Everything else, named for what it is rather than for where it was filed. */
const MORE: { id: Screen; key: string; hint: string }[] = [
  { id: 'train', key: 'nav.train', hint: 'nav.train.hint' },
  { id: 'market', key: 'nav.market', hint: 'nav.market.hint' },
  { id: 'club', key: 'nav.tables', hint: 'nav.tables.hint' },
  { id: 'matches', key: 'nav.results', hint: 'nav.results.hint' },
  { id: 'mentor', key: 'nav.mentor', hint: 'nav.mentor.hint' },
  { id: 'national', key: 'nav.national', hint: 'nav.national.hint' },
  { id: 'career', key: 'nav.career', hint: 'nav.career.hint' },
  { id: 'settings', key: 'nav.settings', hint: 'nav.settings.hint' },
];

function Tabs() {
  const t = useT();
  const screen = useGame((s) => s.screen);
  const goto = useGame((s) => s.goto);
  const state = useGame((s) => s.state);
  const [openMore, setOpenMore] = useState(false);
  const unread = state?.inbox.filter((m) => !m.read).length ?? 0;
  const actionsLeft = state ? state.socialActions.perWeek - state.socialActions.used : 0;
  const offers = state?.transferOffers.length ?? 0;

  return (
    <>
      {openMore && (
        <div className="sheet-backdrop" onClick={() => setOpenMore(false)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.more')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-grip" />
            <p className="eyebrow" style={{ color: 'var(--amber)' }}>{t('nav.more')}</p>
            <ul className="list" style={{ marginBlockStart: 8 }}>
              {MORE.map((entry) => (
                <li key={entry.key} className="list-item">
                  <button
                    className="inbox-row"
                    onClick={() => {
                      setOpenMore(false);
                      goto(entry.id);
                    }}
                  >
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="inbox-title">{t(entry.key)}</span>
                      <span className="inbox-when faint">{t(entry.hint)}</span>
                    </span>
                    {entry.id === 'market' && offers > 0 && <em className="tab-badge">{offers}</em>}
                    <span className="inbox-chevron">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <nav className="tabs">
        {TABS.map((tab) => {
          const active = screen === tab.id || (tab.id === 'matches' && screen === 'match');
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

        <button
          className={`tab ${MORE.some((entry) => entry.id === screen) && !TABS.some((tab) => tab.id === screen) ? 'tab-active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={openMore}
          onClick={() => setOpenMore((open) => !open)}
        >
          <IconMore />
          <span>{t('nav.more')}</span>
          {offers > 0 && <em className="tab-badge">{offers}</em>}
        </button>
      </nav>
    </>
  );
}

/** Three lines. Everybody on earth knows what it means. */
function IconMore() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
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
