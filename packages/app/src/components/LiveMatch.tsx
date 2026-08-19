import { useEffect, useMemo, useRef, useState } from 'react';
import type { MatchEvent, MatchResult } from '@fc/engine';
import { useLang, useT } from '../i18n/index.js';
import { clubShortName } from '../lib/club.js';
import { useGame } from '../state/store.js';
import { club } from '../state/selectors.js';
import { Crest } from './ui.js';
import { Pitch2D } from './Pitch2D.js';
import { playerName } from '../lib/names.js';

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
export function LiveMatch({ match, onFinish }: { match: MatchResult; onFinish: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const home = club(state, match.homeClubId);
  const away = club(state, match.awayClubId);

  // Coming off the bench, there is nothing to watch before you are on: the first hour
  // is already history, so it is shown as a summary and the clock starts where you do.
  const entry = match.userLine?.cameOnMinute ?? 0;

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
  const done = minute >= 90;

  // The clock. One tick per minute, held for a beat on anything decisive so a goal
  // does not scroll past before it has been read.
  useEffect(() => {
    if (paused || done) return;
    const next = minute + 1;
    const notable = events.some((e) => e.minute === next && DECISIVE.has(e.type));
    const delay = (notable ? 2400 : 620) / speed;
    const id = window.setTimeout(() => setMinute(next), delay);
    return () => window.clearTimeout(id);
  }, [minute, paused, speed, done, events]);

  // Once he is off the pitch there is nothing left to watch, so the rest is run out
  // quickly rather than making him sit through someone else's game.
  useEffect(() => {
    const off = shown.find((e) => e.type === 'sub-off' || e.type === 'red');
    if (off && !leftPitch) {
      setLeftPitch(true);
      setSpeed(6);
    }
  }, [shown, leftPitch]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [shown.length]);

  const scorerName = (event: MatchEvent): string => {
    if (!event.playerId || event.playerId === state.player.id) return '';
    if (event.type !== 'goal' && event.type !== 'assist' && event.type !== 'concede') return '';
    const player = state.world.players[event.playerId];
    return player ? playerName(player, lang) : '';
  };

  // The move on the pitch is the last thing that happened, ambient colour included -
  // a corner and a cleared header are what make the ball move between the goals.
  const onPitch = [...shown].reverse()[0] ?? null;

  // A goal is held on screen with the two names that made it: the man who scored and,
  // when there was one, the man who put it on a plate.
  const goalMoment = useMemo(() => {
    const goal = [...shown].reverse().find((e) => e.type === 'goal' || e.type === 'penaltyScored' || e.type === 'concede');
    if (!goal || minute - goal.minute > 1) return null;
    const assist = events.find(
      (e) => e.type === 'assist' && Math.abs(e.minute - goal.minute) <= 1,
    );
    const named = (event?: MatchEvent) => {
      if (!event) return '';
      if (event.playerId === state.player.id) return playerName(state.player, lang);
      const who = event.playerId ? state.world.players[event.playerId] : undefined;
      return who ? playerName(who, lang) : '';
    };
    return { scorer: named(goal), assist: named(assist), ours: goal.type !== 'concede' };
  }, [shown, minute, events, state, lang]);

  const lastScore = [...shown].reverse().find((e) => e.score)?.score;
  const liveHome = done ? match.homeGoals : lastScore?.[0] ?? 0;
  const liveAway = done ? match.awayGoals : lastScore?.[1] ?? 0;

  const feed = [...shown].reverse();

  return (
    <div className="live">
      <div className="live-board">
        <div className="live-side">
          <Crest club={home} size="lg" />
          <span>{clubShortName(home, lang) || match.homeClubId}</span>
        </div>
        <div className="live-score">
          <span className="num">{liveHome}–{liveAway}</span>
          <span className="live-clock num">{done ? "90′" : `${minute}′`}</span>
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
          homeSquad={(state.world.squads[match.homeClubId] ?? []).flatMap((id) => { const found = state.world.players[id]; return found ? [found] : []; })}
          awaySquad={(state.world.squads[match.awayClubId] ?? []).flatMap((id) => { const found = state.world.players[id]; return found ? [found] : []; })}
          {...(state.player.shirtNumber !== undefined ? { userNumber: state.player.shirtNumber } : {})}
        />
        {goalMoment && (
          <div className={`goal-flash ${goalMoment.ours ? '' : 'goal-flash-against'}`}>
            <span className="goal-word">{t('live.goal')}</span>
            {goalMoment.scorer && <span className="goal-scorer">{goalMoment.scorer}</span>}
            {goalMoment.assist && <span className="goal-assist">{t('live.assistBy', { player: goalMoment.assist })}</span>}
          </div>
        )}
      </div>

      {before.length > 0 && (
        <div className="live-before">
          <p className="eyebrow">{t('live.beforeYouCameOn', { minute: entry })}</p>
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
        <p className="live-note">{t('live.leftPitch')}</p>
      )}

      <div className="live-feed" ref={feedRef}>
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
          <button className="btn btn-primary grow" onClick={onFinish}>{t('live.report')}</button>
        ) : (
          <>
            <button className="btn" onClick={() => setPaused((p) => !p)}>
              {paused ? t('live.resume') : t('live.pause')}
            </button>
            <button className="btn" aria-pressed={speed > 1} onClick={() => setSpeed((s) => (s >= 4 ? 1 : s * 2))}>
              ×{speed}
            </button>
            <button className="btn btn-primary grow" onClick={() => setMinute(90)}>{t('live.skip')}</button>
          </>
        )}
      </div>
    </div>
  );
}
