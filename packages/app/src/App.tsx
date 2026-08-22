import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useGame, type Screen } from './state/store.js';
import { useT } from './i18n/index.js';
import { ThemeMusic } from './components/ThemeMusic.js';
import { nextFixture, openHalfTime } from './state/selectors.js';
import { primeWhistles } from './components/whistle.js';

const Menu = lazy(() => import('./screens/Menu.js').then((module) => ({ default: module.Menu })));
const CreatePlayer = lazy(() => import('./screens/CreatePlayer.js').then((module) => ({ default: module.CreatePlayer })));
const AcademyChoice = lazy(() => import('./screens/AcademyChoice.js').then((module) => ({ default: module.AcademyChoice })));
const Hub = lazy(() => import('./screens/Hub.js').then((module) => ({ default: module.Hub })));
const MatchCentre = lazy(() => import('./screens/MatchCentre.js').then((module) => ({ default: module.MatchCentre })));
const MatchesScreen = lazy(() => import('./screens/MatchesScreen.js').then((module) => ({ default: module.MatchesScreen })));
const ClubScreen = lazy(() => import('./screens/ClubScreen.js').then((module) => ({ default: module.ClubScreen })));
const TrainingScreen = lazy(() => import('./screens/TrainingScreen.js').then((module) => ({ default: module.TrainingScreen })));
const MarketScreen = lazy(() => import('./screens/MarketScreen.js').then((module) => ({ default: module.MarketScreen })));
const CareerScreen = lazy(() => import('./screens/CareerScreen.js').then((module) => ({ default: module.CareerScreen })));
const NationalScreen = lazy(() => import('./screens/NationalScreen.js').then((module) => ({ default: module.NationalScreen })));
const SocialScreen = lazy(() => import('./screens/SocialScreen.js').then((module) => ({ default: module.SocialScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen.js').then((module) => ({ default: module.SettingsScreen })));
const DecisionSheet = lazy(() => import('./screens/DecisionSheet.js').then((module) => ({ default: module.DecisionSheet })));
const MentorScreen = lazy(() => import('./screens/MentorScreen.js').then((module) => ({ default: module.MentorScreen })));
const LifeScreen = lazy(() => import('./screens/LifeScreen.js').then((module) => ({ default: module.LifeScreen })));
const ResultSheet = lazy(() => import('./screens/ResultSheet.js').then((module) => ({ default: module.ResultSheet })));
const NewsPopup = lazy(() => import('./screens/NewsPopup.js').then((module) => ({ default: module.NewsPopup })));
const Celebration = lazy(() => import('./screens/Celebration.js').then((module) => ({ default: module.Celebration })));

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
  useDialogAccessibility();

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    const persistLatest = () => {
      if (document.visibilityState === 'hidden') void useGame.getState().save();
    };
    const pageHide = () => void useGame.getState().save();
    document.addEventListener('visibilitychange', persistLatest);
    window.addEventListener('pagehide', pageHide);
    return () => {
      document.removeEventListener('visibilitychange', persistLatest);
      window.removeEventListener('pagehide', pageHide);
    };
  }, []);

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
  if (phase === 'menu') return <>{music}<Suspense fallback={<ScreenLoading />}><Menu /></Suspense><Toast /></>;
  if (phase === 'create') return <>{music}<Suspense fallback={<ScreenLoading />}><CreatePlayer /></Suspense><Toast /></>;
  if (phase === 'academy') return <>{music}<Suspense fallback={<ScreenLoading />}><AcademyChoice /></Suspense><Toast /></>;
  return <Game />;
}

function Game() {
  const screen = useGame((s) => s.screen);
  const state = useGame((s) => s.state);
  const result = useGame((s) => s.result);
  const resultDecision = useGame((s) => s.resultDecision);
  const liveMatchId = useGame((s) => s.liveMatchId);
  // While a match is being watched, nothing else may advance the week from under it.
  // Which match that is comes from the id being followed, not from whichever match the
  // engine wrote last: a youth match and a cup tie can land in the same week.
  const celebration = useGame((s) => s.celebration);
  const watchingMatch = screen === 'match' && liveMatchId !== null;
  // The dressing room at the interval counts as being in the match: he is standing
  // there in his kit, and the game has not finished. Only while he is actually on the
  // match screen, though - a half time left open on some other tab, or reloaded into,
  // used to hide the one button that could take him back to it, and the career stopped
  // dead with no way to move.
  const atTheBreak = openHalfTime(state) != null;
  const inTheMatch = watchingMatch || (atTheBreak && screen === 'match');
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
        <Suspense fallback={<ScreenLoading />}>
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
          {screen === 'life' && <LifeScreen />}

          {!pending && !result && !state?.retired && !inTheMatch && <ContinueDock />}
          <Tabs />
          {/*
            * A trophy has the screen to itself.
            *
            * It used to be raised over a question sheet that was already open, which
            * covered it: confetti behind a dialog, five seconds of nothing to see. The
            * question has waited this long and can wait six seconds more - the sheets,
            * the news and the result all hold until the paper has come down.
            */}
          {(!celebration || inTheMatch) && (result && resultDecision
            ? <DecisionSheet decision={resultDecision} result={result} />
            : result && <ResultSheet result={result} />)}
          {/* News comes up. It is read and dismissed one at a time, behind anything that
              has actually stopped the week. */}
          {!celebration && !result && !pending && !inTheMatch && <NewsPopup />}
          {(!celebration || inTheMatch) && !result && pending && <DecisionSheet decision={pending} />}
          {/* It waits for the final whistle: a trophy does not interrupt the match it
              was won in, it follows him off the pitch. */}
          {celebration && !inTheMatch && (
            <Celebration kind={celebration.kind} titleKey={celebration.titleKey} args={celebration.args} />
          )}
        </Suspense>
        <Toast />
      </div>
    </>
  );
}

function ScreenLoading() {
  return <div className="screen" aria-busy="true"><span className="eyebrow">···</span></div>;
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

    /*
     * Each entry the game adds says how deep it is.
     *
     * Counting pushes is not the same as knowing where you stand - a pop moves you down
     * without the counter knowing which entry you landed on - and leaving means jumping
     * past everything below you. The depth travels with the entry, so wherever a gesture
     * puts him, the entry itself says how far the way out is.
     */
    const spare = () => {
      const depth = (window.history.state?.depth ?? 0) + 1;
      window.history.pushState({ game: true, depth }, '');
      spares++;
    };
    /*
     * Why the stack is topped up on every touch rather than once.
     *
     * Chrome does not simply honour a pushed history entry. An entry created without the
     * user having touched the page since is marked skippable, and the back gesture walks
     * straight past it - which is what an entry pushed from inside a back handler always
     * is, because a swipe is not a touch on the page. So the buffer built by the guard
     * itself is made of exactly the entries the browser is willing to ignore, and one
     * swipe could go past the lot and out of the app.
     *
     * An entry pushed while he is touching the screen is not skippable. He touches the
     * screen constantly - that is what playing is - so the stack is refilled on every
     * touch, and the entries that hold are the ones he made himself.
     */
    const WANTED = 2;
    const refill = () => {
      while (spares < WANTED) spare();
    };
    spare();
    const touched = () => {
      // The same touch unlocks sound: a browser will not let a page play anything it was
      // not asked for by hand.
      primeWhistles();
      refill();
    };
    /*
     * Which events count as "he touched it".
     *
     * Not every input event grants the page user activation, and only an entry pushed
     * with activation is one the back gesture will honour. pointerdown alone was not
     * enough, so the whole set a browser accepts is listened for - the finger going
     * down, the finger coming up, the tap that follows, a key either way.
     */
    const touch = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown', 'keyup'] as const;
    for (const event of touch) window.addEventListener(event, touched, { passive: true });
    // Coming back to the app from another one - or out of the phone's back stack - is a
    // fresh start for all of this.
    window.addEventListener('pageshow', refill);

    const onPop = () => {
      if (leaving) return;
      spares = Math.max(0, spares - 1);
      // Landing on an entry the game never pushed means the browser walked past the
      // buffer. Build it again before doing anything else, or the next swipe is out.
      if (!window.history.state?.game) spares = 0;
      refill();
      const game = useGame.getState();

      // The screen in front of him first: a form in the middle of its own steps.
      if (game.backHandler?.()) {
        armedAt = 0;
        return;
      }

      // Then the way he came. A match is the one thing with no way back out of it.
      const inTheMatch = game.liveMatchId !== null || game.state?.pendingHalfTime != null;
      const canStepBack =
        game.phase === 'playing' && !inTheMatch && (game.trail.length > 0 || game.screen !== 'hub');
      if (canStepBack) {
        game.back();
        armedAt = 0;
        return;
      }

      // Nowhere left to go. Say it once, and mean it the second time.
      if (Date.now() - armedAt < EXIT_WINDOW) {
        leaving = true;
        game.showToast(null);
        // Past every entry below him and the one the app was loaded on, which is what
        // leaving actually means: installed on a phone, that closes it. One step would
        // only land on the entry the app itself occupies, and he would still be here.
        window.history.go(-((window.history.state?.depth ?? 0) + 1));
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
      game.showToast(say.current('action.backAgainToExit'));
    };

    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      for (const event of touch) window.removeEventListener(event, touched);
      window.removeEventListener('pageshow', refill);
    };
  }, []);
}

function ContinueDock() {
  const t = useT();
  const advance = useGame((s) => s.advance);
  const skipInjury = useGame((s) => s.skipInjury);
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
  // A match stopped at the interval is the only thing the week is waiting on, so
  // wherever he has wandered off to, the button leads back to the dressing room.
  const backToTheBreak = openHalfTime(state) != null && screen !== 'match';
  // A button should say what happens when it is pressed. With his club playing this
  // week, pressing it kicks a match off; the rest of the year it walks the calendar on.
  const upcoming = state && !afterMatch && !backToTheBreak ? nextFixture(state) : null;
  const kickOff = upcoming != null && upcoming.fixture.week === state?.world.week;
  // A press used to run the calendar until something stopped it, which meant match,
  // match, match with nothing in between. A week at a time gives him somewhere to read
  // his mail, look at his training and see what the last game did to his numbers.
  const label = backToTheBreak
    ? t('action.backToMatch')
    : afterMatch
      ? t('action.doneWithMatch')
      : kickOff
        ? t('action.startMatch')
        : injured
          ? t('action.continueTo')
          : t('action.nextWeek');

  // Sitting out a long injury a week at a time is not a decision, it is a chore.
  const canSkipInjury = injured && !afterMatch && !kickOff && !backToTheBreak
    && (state?.player.condition.injuries[0]?.weeksRemaining ?? 0) >= 3;

  return (
    <div className="continue-dock">
      <button
        className={`continue ${injured && !afterMatch && !kickOff && !backToTheBreak ? 'continue-alt' : ''}`}
        disabled={busy}
        onClick={() => (afterMatch || backToTheBreak ? goto(afterMatch ? 'hub' : 'match') : advance(1))}
      >
        {label}
      </button>
      {canSkipInjury && (
        <button className="continue continue-skip" disabled={busy} onClick={() => skipInjury()}>
          {t('action.skipInjury')}
        </button>
      )}
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

/**
 * Everything else, named for what it is rather than for where it was filed.
 *
 * Only what is not already on the bar. Two of these rows used to lead to the club and
 * the matches screens, which are one tap away underneath the sheet he opened to find
 * them - a longer road to the same place, which reads as a different place.
 */
const MORE: { id: Screen; key: string; hint: string }[] = [
  { id: 'train', key: 'nav.train', hint: 'nav.train.hint' },
  { id: 'market', key: 'nav.market', hint: 'nav.market.hint' },
  { id: 'mentor', key: 'nav.mentor', hint: 'nav.mentor.hint' },
  { id: 'life', key: 'nav.life', hint: 'nav.life.hint' },
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
  return <div className="toast" role="status" aria-live="polite">{toast}</div>;
}

/** Focus stays inside the top sheet; dismissible backdrops also understand Escape. */
function useDialogAccessibility(): void {
  useEffect(() => {
    let active: HTMLElement | null = null;
    const previous = new WeakMap<HTMLElement, Element | null>();
    const focusable = (dialog: HTMLElement) => [...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )];

    const sync = () => {
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')];
      const next = dialogs[dialogs.length - 1] ?? null;
      if (next === active) return;
      const old = active;
      active = next;
      if (next) {
        previous.set(next, document.activeElement);
        if (!next.hasAttribute('tabindex')) next.tabIndex = -1;
        window.requestAnimationFrame(() => (focusable(next)[0] ?? next).focus());
      } else if (old) {
        const restore = previous.get(old);
        if (restore instanceof HTMLElement && restore.isConnected) restore.focus();
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    const onKey = (event: KeyboardEvent) => {
      if (!active) return;
      if (event.key === 'Escape') {
        const backdrop = active.closest<HTMLElement>('.sheet-backdrop');
        backdrop?.click();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable(active);
      if (items.length === 0) {
        event.preventDefault();
        active.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', onKey);
    };
  }, []);
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
