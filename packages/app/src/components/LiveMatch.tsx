import { useEffect, useMemo, useRef, useState } from 'react';
import type { MatchEvent, MatchResult, Player } from '@fc/engine';
import { useLang, useT } from '../i18n/index.js';
import { competitionLabel } from '../lib/names.js';
import { clubShortName } from '../lib/club.js';
import { getPack, useGame } from '../state/store.js';
import { club } from '../state/selectors.js';
import { Crest } from './ui.js';
import { Pitch2D } from './Pitch2D.js';
import { FootballIcon } from './Football.js';
import { blowWhistle } from './whistle.js';
import { findPlayer, playerName } from '../lib/names.js';

/** Beats worth stopping on: the clock hangs for a moment so they land. */
const DECISIVE = new Set<MatchEvent['type']>([
  'goal', 'concede', 'penaltyScored', 'penaltyMissed', 'red', 'injury', 'woodwork',
]);

/** Three phrasings for the beats that come round often, picked by minute. */
function variantKey(key: string, minute: number): string {
  const varied = [
    'match.event.userMiss', 'match.event.userSaved', 'match.event.userTackle', 'match.event.teamGoal',
    'match.live.corner', 'match.live.chance', 'match.live.userPass', 'match.live.userDribble',
  ];
  if (!varied.includes(key)) return key;
  const variant = minute % 3;
  return variant === 0 ? key : `${key}${variant + 1}`;
}

/**
 * The eleven on the pitch for a club, from whichever register this match belongs to: a
 * Sunday morning in the age group is played by boys the senior world has never heard of.
 */
function squadOf(
  state: { world: { squads: Record<string, string[]>; players: Record<string, Player>; youth?: { squads: Record<string, string[]>; players: Record<string, Player> } } },
  clubId: string,
): Player[] {
  const senior = (state.world.squads[clubId] ?? []).flatMap((id) => {
    const found = state.world.players[id];
    return found ? [found] : [];
  });
  if (senior.length > 0) return senior;
  const youth = state.world.youth;
  return (youth?.squads[clubId] ?? []).flatMap((id) => {
    const found = youth?.players[id];
    return found ? [found] : [];
  });
}

function toneOf(event: MatchEvent): string {
  if (event.type === 'goal' || event.type === 'assist') return event.byUser ? 'live-great' : 'live-good';
  if (event.type === 'concede' || event.type === 'red' || event.type === 'injury') return 'live-bad';
  if (event.type === 'save' || event.type === 'tackle') return 'live-good';
  if (event.type === 'yellow' || event.type === 'miss' || event.type === 'woodwork') return 'live-warn';
  if (event.type === 'halfTime' || event.type === 'fullTime' || event.type === 'kickOff') return 'live-whistle';
  return '';
}

/**
 * The match as it happens. The result is already simulated - the engine decided it in
 * one pass - but a footballer lives the ninety minutes, so we play them back: the
 * clock runs, the moves arrive, and the player can sit through it or skip straight to
 * the whistle. If he comes off before the end, the rest is played out for him.
 */
export function LiveMatch({
  match,
  onFinish,
  from,
  to = 90,
}: {
  match: MatchResult;
  onFinish: () => void;
  /** Where the clock starts. Set when the second half is picked up after a team talk. */
  from?: number;
  /** Where it stops. 45 while the match is waiting on a decision in the dressing room. */
  to?: number;
}) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const home = club(state, match.homeClubId);
  const away = club(state, match.awayClubId);
  // Which competition this is. A Sunday morning in the youth league and a Saturday in
  // the first division look identical on a scoreboard, and they are not the same match.
  const competition = competitionLabel(match.competitionId, getPack(), lang, t);

  // Coming off the bench, there is nothing to watch before you are on: the first hour
  // is already history, so it is shown as a summary and the clock starts where you do.
  const entry = from ?? match.userLine?.cameOnMinute ?? 0;

  const [minute, setMinute] = useState(entry);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [leftPitch, setLeftPitch] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const events = useMemo(
    () => [...(match.events ?? [])].sort((a, b) => a.minute - b.minute),
    [match],
  );

  const before = useMemo(
    () => events.filter((e) => e.minute < entry && !e.ambient),
    [events, entry],
  );
  const shown = useMemo(
    () => events.filter((e) => e.minute <= minute && e.minute >= entry),
    [events, minute, entry],
  );
  const done = minute >= to;

  // The clock. One tick per minute, held for a beat on anything decisive so a goal
  // does not scroll past before it has been read.
  useEffect(() => {
    if (paused || done) return;
    const next = minute + 1;
    // How long to sit on what is on screen now. This used to look at the minute we were
    // about to move to, so the clock paused just before a goal and then moved straight
    // off it - the goal itself flashed past in the time given to a throw-in, and the
    // replay was cut off before it started.
    const notable = events.some((e) => e.minute === minute && DECISIVE.has(e.type));
    // A goal is the move, the net, the board and then the whole thing again in slow
    // motion, so the clock waits for all of it rather than moving on mid-replay.
    const isGoal = events.some(
      (e) => e.minute === minute && (e.type === 'goal' || e.type === 'concede' || e.type === 'penaltyScored'),
    );
    const delay = (isGoal ? 6200 : notable ? 2400 : 620) / speed;
    const id = window.setTimeout(() => setMinute(next), delay);
    return () => window.clearTimeout(id);
  }, [minute, paused, speed, done, events]);

  // Once he is off the pitch there is nothing left to watch, so the rest is run out
  // quickly rather than making him sit through someone else's game.
  useEffect(() => {
    const off = shown.find((e) => e.type === 'sub-off' || e.type === 'red');
    if (off && !leftPitch) {
      setLeftPitch(true);
      // Fast, but not so fast that the rest of the match is a blur: at six times the
      // clock simply vanished and it read as the game skipping to the end on its own.
      setSpeed(4);
    }
  }, [shown, leftPitch]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [shown.length]);

  const scorerName = (event: MatchEvent): string => {
    if (!event.playerId || event.playerId === state.player.id) return '';
    if (event.type !== 'goal' && event.type !== 'assist' && event.type !== 'concede') return '';
    const player = findPlayer(state, event.playerId);
    return player ? playerName(player, lang) : '';
  };

  // The move on the pitch is the most important thing that happened this minute, not
  // simply the last line printed. A goal and its assist arrive on the same minute and
  // the assist is written second, which is why the goal itself was never being animated.
  const onPitch = useMemo(() => {
    if (shown.length === 0) return null;
    const rank = (event: MatchEvent): number => {
      switch (event.type) {
        case 'goal':
        case 'concede':
        case 'penaltyScored':
          return 6;
        case 'penaltyMissed':
        case 'woodwork':
          return 5;
        case 'red':
        case 'injury':
          return 4;
        case 'save':
        case 'miss':
        case 'oppMiss':
          return 3;
        case 'corner':
        case 'freeKick':
          return 2;
        default:
          return 1;
      }
    };
    const latest = shown[shown.length - 1]!.minute;
    const thisMinute = shown.filter((event) => event.minute === latest);
    return thisMinute.reduce((best, event) => (rank(event) > rank(best) ? event : best), thisMinute[0]!);
  }, [shown]);

  // A goal is held on screen with the two names that made it: the man who scored and,
  // when there was one, the man who put it on a plate.
  const goalMoment = useMemo(() => {
    const goal = [...shown].reverse().find((e) => e.type === 'goal' || e.type === 'penaltyScored' || e.type === 'concede');
    if (!goal || minute - goal.minute > 1) return null;

    // The assist the engine wrote for this goal is the one on the same minute.
    const assist = events.find((e) => e.type === 'assist' && e.minute === goal.minute);
    const named = (event?: MatchEvent) => {
      if (!event) return '';
      if (event.playerId === state.player.id) return playerName(state.player, lang);
      const who = findPlayer(state, event.playerId);
      return who ? playerName(who, lang) : '';
    };
    return {
      scorer: named(goal),
      assist: named(assist),
      ours: goal.type !== 'concede',
      minute: goal.minute,
      score: goal.score,
    };
  }, [shown, minute, events, state, lang]);

  // The moment itself, as opposed to the board that stays up after it: the ball is
  // still crossing the screen on the minute it went in, and not a minute later.
  const goalSplash = goalMoment && goalMoment.minute === minute ? goalMoment : null;

  // The whistle, and the word that goes with it. Half time when the playback stops at
  // the interval, the end of the match when it stops at ninety - both are the referee
  // putting it to his mouth, so both are heard as well as read.
  const [whistled, setWhistled] = useState(false);
  // Held in a ref as well as in state: state settles a render later, and in development
  // the effect is deliberately run twice, which blew the whistle twice over itself.
  const blown = useRef(false);
  useEffect(() => {
    if (!done || blown.current) return;
    blown.current = true;
    setWhistled(true);
    blowWhistle(to <= 45 ? 'halfTime' : 'fullTime');
  }, [done, to]);

  const lastScore = [...shown].reverse().find((e) => e.score)?.score;
  // Coming back on for the second half, the board does not reset: the goals from the
  // half he already watched are on it before a ball is kicked.
  const carried = useMemo(
    () => [...events].reverse().find((e) => e.score && e.minute < entry)?.score,
    [events, entry],
  );
  const liveHome = done ? match.homeGoals : lastScore?.[0] ?? carried?.[0] ?? 0;
  const liveAway = done ? match.awayGoals : lastScore?.[1] ?? carried?.[1] ?? 0;

  const feed = [...shown].reverse();

  return (
    <div className="live">
      <p className="eyebrow" style={{ textAlign: 'center', marginBlockEnd: 6, color: 'var(--amber)' }}>
        {competition}
      </p>
      <div className="live-board">
        <div className="live-side">
          <Crest club={home} size="lg" />
          <span>{clubShortName(home, lang) || match.homeClubId}</span>
        </div>
        <div className="live-score">
          <span className="num">{liveHome}–{liveAway}</span>
          <span className="live-clock num">{done ? `${to}′` : `${minute}′`}</span>
        </div>
        <div className="live-side">
          <Crest club={away} size="lg" />
          <span>{clubShortName(away, lang) || match.awayClubId}</span>
        </div>
      </div>

      <div className="live-progress"><i style={{ width: `${Math.min(100, (minute / 90) * 100)}%` }} /></div>

      <div className="pitch-wrap">
        <Pitch2D
          home={home}
          away={away}
          event={onPitch}
          userIsHome={state.player.clubId === match.homeClubId}
          homeSquad={squadOf(state, match.homeClubId)}
          awaySquad={squadOf(state, match.awayClubId)}
          {...(state.player.shirtNumber !== undefined ? { userNumber: state.player.shirtNumber } : {})}
          replayLabel={t('live.replay')}
        />
        {done && whistled && (
          <div className="whistle-splash" key={`whistle-${to}`} role="status">
            <span className="whistle-mark" aria-hidden="true" />
            <span className="whistle-word">{t(to <= 45 ? 'live.halfTimeCall' : 'live.fullTimeCall')}</span>
            <span className="whistle-score num" dir="ltr">
              {match.homeGoals}–{match.awayGoals}
            </span>
          </div>
        )}
        {goalSplash && (
          <div
            className={`goal-splash ${goalSplash.ours ? '' : 'goal-splash-against'}`}
            key={`${goalSplash.minute}-${goalSplash.ours}`}
            aria-hidden="true"
          >
            <FootballIcon size={96} className="goal-splash-ball" />
            <span className="goal-splash-word">GOAL!!!</span>
            {goalSplash.scorer && (
              <span className="goal-splash-scorer">
                {goalSplash.scorer} <span className="num">{goalSplash.minute}′</span>
              </span>
            )}
          </div>
        )}
        {goalMoment && !goalSplash && (
          <div className={`goal-card ${goalMoment.ours ? '' : 'goal-card-against'}`} role="status">
            <span className="goal-word">{t('live.goal')}</span>
            <span className="goal-line">
              <Crest club={home} size="sm" />
              <b className="num">{goalMoment.score ? goalMoment.score[0] : liveHome}</b>
              <span className="goal-dash">–</span>
              <b className="num">{goalMoment.score ? goalMoment.score[1] : liveAway}</b>
              <Crest club={away} size="sm" />
            </span>
            {goalMoment.scorer && (
              <span className="goal-scorer">
                {goalMoment.scorer} <span className="num goal-minute">{goalMoment.minute}′</span>
              </span>
            )}
            {goalMoment.assist && <span className="goal-assist">{t('live.assistBy', { player: goalMoment.assist })}</span>}
          </div>
        )}
      </div>

      {before.length > 0 && (
        <div className="live-before">
          {/* Two different things read the same box: a substitute has missed the first
              hour, and a player coming back out for the second half has not. */}
          <p className="eyebrow">
            {from !== undefined
              ? t('live.firstHalfRecap')
              : t('live.beforeYouCameOn', { minute: entry })}
          </p>
          {before.map((event, i) => (
            <div key={`b-${i}`} className="live-before-row">
              <span className="live-minute num">{event.minute}′</span>
              <p>
                {t(variantKey(event.detailKey ?? `match.event.${event.type}`, event.minute))}
                {scorerName(event) && <span className="who"> · {scorerName(event)}</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      {leftPitch && !done && (
        <p className="live-note live-note-loud">{t('live.leftPitch')}</p>
      )}

      <div className="live-feed" ref={feedRef} aria-live="polite" aria-relevant="additions text">
        {feed.length === 0 && <p className="faint" style={{ fontSize: 13 }}>{t('live.warmup')}</p>}
        {feed.map((event, i) => (
          <div key={`${event.minute}-${i}-${event.detailKey}`} className={`live-row ${toneOf(event)}`}>
            <span className="live-minute num">{event.minute}′</span>
            <p>
              {t(variantKey(event.detailKey ?? `match.event.${event.type}`, event.minute))}
              {scorerName(event) && <span className="who"> · {scorerName(event)}</span>}
            </p>
            {event.score && (
              <span className="num live-row-score">{event.score[0]}–{event.score[1]}</span>
            )}
          </div>
        ))}
      </div>

      <div className="live-controls">
        {done ? (
          <button className="btn btn-primary grow" onClick={onFinish}>
            {to < 90 ? t('live.toTheDressingRoom') : t('live.report')}
          </button>
        ) : (
          <>
            <button className="btn" onClick={() => setPaused((p) => !p)}>
              {paused ? t('live.resume') : t('live.pause')}
            </button>
            <button className="btn" aria-pressed={speed > 1} onClick={() => setSpeed((s) => (s >= 4 ? 1 : s * 2))}>
              ×{speed}
            </button>
            <button className="btn btn-primary grow" onClick={() => setMinute(to)}>{t('live.skip')}</button>
          </>
        )}
      </div>
    </div>
  );
}
