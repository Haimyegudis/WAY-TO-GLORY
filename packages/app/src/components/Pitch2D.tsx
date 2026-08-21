import { useEffect, useMemo, useRef, useState } from 'react';
import type { Club, MatchEvent } from '@fc/engine';
import { Football } from './Football.js';
import { clubColor } from '../lib/club.js';

/**
 * The match, on a pitch.
 *
 * The engine has already decided what happened - this is not a simulation, it is a
 * reconstruction. Each event in the feed is turned into a short piece of choreography:
 * a corner starts at the corner flag, a goal is two or three passes and a finish, a
 * penalty is placed on the spot and struck from eleven metres. The ball travels between
 * those points and the players slide with it, the way a two-dimensional match engine has
 * looked since the nineties, because that is the view that lets you read a game at a
 * glance on a phone.
 *
 * Everything is drawn to real proportions: 105 by 68 metres, an 18-yard box that is
 * actually 16.5 metres deep, a penalty spot that is actually eleven metres out.
 */

const PITCH_LENGTH = 105;
const PITCH_WIDTH = 68;

function rgbOf(colour: string): [number, number, number] {
  const hex = colour.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const value = Number.parseInt(full.slice(0, 6) || '888888', 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Black on a yellow shirt, white on a navy one. A number nobody can read is decoration. */
function inkOn(colour: string): string {
  const [r, g, b] = rgbOf(colour);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#14181f' : '#ffffff';
}

/**
 * Two sides in the same colours is the one thing a real match never allows, so the
 * visiting side changes when the home side is too close to it - the same reason away
 * kits exist at all.
 */
function keepThemApart(home: string, away: string): string {
  const [hr, hg, hb] = rgbOf(home);
  const [ar, ag, ab] = rgbOf(away);
  const distance = Math.abs(hr - ar) + Math.abs(hg - ag) + Math.abs(hb - ab);
  if (distance > 150) return away;
  const homeIsLight = (hr * 299 + hg * 587 + hb * 114) / 1000 > 150;
  return homeIsLight ? '#1c2a5e' : '#f2f4f8';
}

/** A place the ball travels to, and how it gets there. */
interface Beat {
  x: number;
  y: number;
  ms: number;
  kind: 'set' | 'pass' | 'carry' | 'cross' | 'shot';
}

interface Play {
  beats: Beat[];
  /** True when the move runs left to right on screen. */
  rightwards: boolean;
  flash?: 'goal' | 'card' | 'stop';
}

/** Where eleven players stand, attacking to the right. Metres, from the goal line. */
const SHAPE: { x: number; y: number; number: number }[] = [
  { x: 5, y: 34, number: 1 },
  { x: 20, y: 12, number: 2 },
  { x: 17, y: 26, number: 5 },
  { x: 17, y: 42, number: 6 },
  { x: 20, y: 56, number: 3 },
  { x: 40, y: 20, number: 8 },
  { x: 38, y: 34, number: 4 },
  { x: 40, y: 48, number: 10 },
  { x: 70, y: 14, number: 7 },
  { x: 78, y: 34, number: 9 },
  { x: 70, y: 54, number: 11 },
];

/**
 * A move, written out. The engine tells us what happened and roughly where on the pitch
 * it belongs; the rest is the same handful of shapes football actually makes.
 */
function playFor(event: MatchEvent, rightwards: boolean): Play {
  const flip = (x: number) => (rightwards ? x : PITCH_LENGTH - x);
  const mirror = (y: number) => (rightwards ? y : PITCH_WIDTH - y);
  // Past the line, into the net. Stopping the ball on the goal line was the reason a
  // goal did not look like a goal.
  const inTheNet = { x: rightwards ? PITCH_LENGTH + 1.4 : -1.4, y: mirror(34) };
  const centre = { x: PITCH_LENGTH / 2, y: PITCH_WIDTH / 2 };

  const build = (beats: Beat[], flash?: Play['flash']): Play => ({ beats, rightwards, ...(flash ? { flash } : {}) });

  switch (event.type) {
    case 'kickOff':
    case 'halfTime':
      // Everything restarts from the middle, which is the one thing every football
      // watcher expects to see and the thing that makes a restart read as a restart.
      return build([
        { ...centre, ms: 500, kind: 'set' },
        { x: flip(42), y: mirror(30), ms: 700, kind: 'pass' },
      ]);

    case 'fullTime':
      return build([{ ...centre, ms: 600, kind: 'set' }], 'stop');

    case 'goal':
    case 'concede':
      return build(
        [
          { x: flip(55), y: mirror(46), ms: 520, kind: 'pass' },
          { x: flip(72), y: mirror(52), ms: 480, kind: 'carry' },
          { x: flip(86), y: mirror(38), ms: 430, kind: 'cross' },
          { ...inTheNet, ms: 300, kind: 'shot' },
        ],
        'goal',
      );

    case 'penaltyScored':
      return build(
        [
          { x: flip(94), y: mirror(34), ms: 700, kind: 'set' },
          { ...inTheNet, ms: 280, kind: 'shot' },
        ],
        'goal',
      );

    case 'penaltyMissed':
      return build([
        { x: flip(94), y: mirror(34), ms: 700, kind: 'set' },
        { x: flip(106), y: mirror(20), ms: 320, kind: 'shot' },
      ]);

    case 'corner':
      return build([
        { x: flip(105), y: mirror(1), ms: 620, kind: 'set' },
        { x: flip(90), y: mirror(32), ms: 560, kind: 'cross' },
        { x: flip(84), y: mirror(44), ms: 420, kind: 'pass' },
      ]);

    case 'freeKick':
      return build([
        { x: flip(76), y: mirror(24), ms: 640, kind: 'set' },
        { x: flip(97), y: mirror(30), ms: 420, kind: 'shot' },
      ]);

    case 'miss':
    case 'oppMiss':
    case 'chance':
      return build([
        { x: flip(64), y: mirror(26), ms: 480, kind: 'pass' },
        { x: flip(84), y: mirror(34), ms: 420, kind: 'carry' },
        { x: flip(107), y: mirror(46), ms: 340, kind: 'shot' },
      ]);

    case 'woodwork':
      return build([
        { x: flip(72), y: mirror(42), ms: 460, kind: 'carry' },
        { x: flip(102), y: mirror(28), ms: 330, kind: 'shot' },
        { x: flip(88), y: mirror(38), ms: 420, kind: 'pass' },
      ]);

    case 'save':
      return build([
        { x: flip(70), y: mirror(38), ms: 460, kind: 'pass' },
        { x: flip(99), y: mirror(34), ms: 340, kind: 'shot' },
        { x: flip(92), y: mirror(48), ms: 460, kind: 'pass' },
      ]);

    case 'keyPass':
    case 'assist':
      return build([
        { x: flip(58), y: mirror(30), ms: 460, kind: 'pass' },
        { x: flip(80), y: mirror(46), ms: 420, kind: 'pass' },
      ]);

    case 'tackle':
    case 'blockedShot':
      return build([
        { x: flip(38), y: mirror(40), ms: 460, kind: 'carry' },
        { x: flip(26), y: mirror(26), ms: 500, kind: 'pass' },
      ]);

    case 'offside':
      return build([
        { x: flip(78), y: mirror(18), ms: 520, kind: 'pass' },
        { x: flip(78), y: mirror(18), ms: 400, kind: 'set' },
      ]);

    case 'yellow':
    case 'red':
    case 'injury':
      return build([{ x: flip(52), y: mirror(40), ms: 700, kind: 'set' }], 'card');

    default:
      return build([
        { x: flip(46), y: mirror(28), ms: 520, kind: 'pass' },
        { x: flip(58), y: mirror(42), ms: 520, kind: 'pass' },
      ]);
  }
}

/**
 * Where the players stand for this phase. Both sides slide up and down the pitch with
 * the ball - the team in possession pushes on, the other drops - which is most of what
 * makes a two-dimensional match look like football rather than like table hockey.
 */
function positionsFor(
  ballX: number,
  ballY: number,
  attackingRight: boolean,
  isHome: boolean,
  /** True for the side the move belongs to: one of them has the ball at his feet. */
  inPossession: boolean,
) {
  const attackingThisWay = isHome === attackingRight;
  const men = SHAPE.map((slot) => {
    const own = isHome ? slot : { ...slot, x: PITCH_LENGTH - slot.x, y: PITCH_WIDTH - slot.y };
    const goalkeeper = slot.number === 1;

    // Everyone drifts toward the ball, the keeper barely at all - but a team keeps its
    // shape. Without the leash both sides ended up in the same third of the pitch and it
    // stopped looking like two teams.
    const pull = goalkeeper ? 0.05 : attackingThisWay ? 0.24 : 0.18;
    const leash = goalkeeper ? 6 : 22;
    const wanted = own.x + (ballX - own.x) * pull;
    const x = Math.max(own.x - leash, Math.min(own.x + leash, wanted));

    // And a team pushes toward the ball across the pitch as well, a little.
    const y = own.y + (ballY - own.y) * (goalkeeper ? 0.12 : 0.16);
    return {
      ...own,
      x: Math.max(2, Math.min(PITCH_LENGTH - 2, x)),
      y: Math.max(3, Math.min(PITCH_WIDTH - 3, y)),
    };
  });

  /*
   * Somebody is on the ball.
   *
   * Drifting toward it is not the same as having it: the whole side leaned the right
   * way and the ball still sat in a gap ten metres from the nearest man, which is the
   * one thing that never happens in football. So the closest man of the side the move
   * belongs to is put on it, a stride behind it in the direction he is going, and that
   * reads as a player carrying the ball rather than a ball travelling on its own.
   *
   * Only him, only when he is close enough that stepping across is a run and not a
   * teleport, and never when the ball has crossed the line - a ball in the net belongs
   * to nobody.
   */
  if (!inPossession) return men;
  if (ballX <= 0 || ballX >= PITCH_LENGTH) return men;

  let carrier = -1;
  let closest = Infinity;
  men.forEach((man, i) => {
    if (SHAPE[i]!.number === 1) return;
    const distance = Math.hypot(man.x - ballX, man.y - ballY);
    if (distance < closest) {
      closest = distance;
      carrier = i;
    }
  });
  if (carrier < 0 || closest > 16) return men;

  const behind = attackingRight ? -1.9 : 1.9;
  men[carrier] = {
    ...men[carrier]!,
    x: Math.max(2, Math.min(PITCH_LENGTH - 2, ballX + behind)),
    y: Math.max(3, Math.min(PITCH_WIDTH - 3, ballY + 0.6)),
  };
  return men;
}

/** Shirt numbers for a side, taken from the squad where we know it. */
function numbersFor(squad: { shirtNumber?: number }[] | undefined): number[] {
  const fallback = SHAPE.map((slot) => slot.number);
  if (!squad || squad.length === 0) return fallback;
  const taken = squad.slice(0, 11).map((player, i) => player.shirtNumber ?? fallback[i] ?? i + 1);
  while (taken.length < 11) taken.push(fallback[taken.length]!);
  return taken;
}

export function Pitch2D({
  home,
  away,
  event,
  userIsHome,
  homeSquad,
  awaySquad,
  userNumber,
  replayLabel,
}: {
  home: Club | null | undefined;
  away: Club | null | undefined;
  event: MatchEvent | null;
  userIsHome: boolean;
  homeSquad?: { shirtNumber?: number }[];
  awaySquad?: { shirtNumber?: number }[];
  /** His own shirt, so he can find himself on the pitch. */
  userNumber?: number;
  /** The word for a second look at the goal, in his language. */
  replayLabel: string;
}) {
  const [ball, setBall] = useState({ x: PITCH_LENGTH / 2, y: PITCH_WIDTH / 2 });
  const [travel, setTravel] = useState(600);
  const [flash, setFlash] = useState<Play['flash'] | null>(null);
  const [netHit, setNetHit] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const held = useRef<MatchEvent | null>(null);
  held.current = event;
  // What actually identifies this moment: the minute it happened on and what it was.
  const beat = event ? `${event.minute}:${event.type}:${event.detailKey ?? ''}` : '';
  const [attackingRight, setAttackingRight] = useState(true);
  const timers = useRef<number[]>([]);

  const homeColour = clubColor(home);
  const awayColour = keepThemApart(homeColour, clubColor(away));
  const homeNumbers = useMemo(() => numbersFor(homeSquad), [homeSquad]);
  const awayNumbers = useMemo(() => numbersFor(awaySquad), [awaySquad]);

  // Whose move this is, taken from the line the player is reading rather than guessed:
  // the commentary already says whether it was their corner or ours, so the ball goes
  // the way the text says it went.
  useEffect(() => {
    const event = held.current;
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
    // A new match beat owns a clean broadcast state. In particular, it must remove a
    // replay badge even if the previous event changed before its final timer fired.
    setReplaying(false);
    setNetHit(false);
    setFlash(null);
    if (!event) return;

    const theirs =
      event.type === 'concede' ||
      event.type === 'oppMiss' ||
      /opp/i.test(event.detailKey ?? '');
    const rightwards = userIsHome ? !theirs : theirs;
    setAttackingRight(rightwards);

    const play = playFor(event, rightwards);

    const run = (beats: typeof play.beats, slow: number, offset: number) => {
      let at = offset;
      for (const beat of beats) {
        const ms = Math.round(beat.ms * slow);
        const id = window.setTimeout(() => {
          setTravel(ms);
          setBall({ x: beat.x, y: beat.y });
        }, at);
        timers.current.push(id);
        at += ms;
      }
      return at;
    };

    let elapsed = run(play.beats, 1, 0);

    if (play.flash === 'goal') {
      // The net moves, the board comes up, and then the whole thing is shown again at
      // half speed - which is what everybody actually watches a goal for.
      timers.current.push(window.setTimeout(() => setFlash('goal'), Math.max(0, elapsed - 260)));
      timers.current.push(window.setTimeout(() => setNetHit(true), Math.max(0, elapsed - 260)));
      timers.current.push(window.setTimeout(() => setNetHit(false), elapsed + 700));

      const replayFrom = elapsed + 1500;
      timers.current.push(window.setTimeout(() => setReplaying(true), replayFrom));
      const replayEnd = run(play.beats, 1.7, replayFrom);
      timers.current.push(window.setTimeout(() => setNetHit(true), replayEnd - 200));
      // The on-air label belongs only to the slow-motion replay, not to the short
      // settling animation after the ball reaches the net.
      timers.current.push(window.setTimeout(() => setReplaying(false), replayEnd));
      timers.current.push(
        window.setTimeout(() => {
          setNetHit(false);
          setFlash(null);
        }, replayEnd + 700),
      );
      elapsed = replayEnd;
    } else if (play.flash) {
      timers.current.push(window.setTimeout(() => setFlash(play.flash!), Math.max(0, elapsed - 300)));
      timers.current.push(window.setTimeout(() => setFlash(null), elapsed + 1200));
    }

    return () => {
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
    };
  }, [beat, userIsHome]);

  // The move runs the way the side in possession attacks, so that side is the one with
  // a man on the ball.
  const homePlayers = positionsFor(ball.x, ball.y, attackingRight, true, attackingRight);
  const awayPlayers = positionsFor(ball.x, ball.y, attackingRight, false, !attackingRight);

  // The referee keeps a diagonal, a few metres off the ball, like a real one.
  const referee = {
    x: Math.max(6, Math.min(PITCH_LENGTH - 6, ball.x - 7)),
    y: Math.max(6, Math.min(PITCH_WIDTH - 6, ball.y + 8)),
  };

  return (
    <div className={`pitch2d ${flash === 'goal' ? 'pitch-goal' : ''}`}>
      <svg viewBox={`-2 -2 ${PITCH_LENGTH + 4} ${PITCH_WIDTH + 4}`} role="img" aria-label="pitch">
        <defs>
          <pattern id="mow" width="13.125" height={PITCH_WIDTH} patternUnits="userSpaceOnUse">
            <rect width="13.125" height={PITCH_WIDTH} fill="#2f6d3a" />
            <rect x="6.5625" width="6.5625" height={PITCH_WIDTH} fill="#357a41" />
          </pattern>
          <pattern id="net" width="0.9" height="0.9" patternUnits="userSpaceOnUse">
            <rect width="0.9" height="0.9" fill="rgba(255,255,255,0.10)" />
            <path d="M0 0 H0.9 M0 0 V0.9" stroke="rgba(255,255,255,0.45)" strokeWidth="0.09" />
          </pattern>
        </defs>

        <rect x="-2" y="-2" width={PITCH_LENGTH + 4} height={PITCH_WIDTH + 4} rx="1.5" fill="#265c31" />
        <rect width={PITCH_LENGTH} height={PITCH_WIDTH} fill="url(#mow)" />

        <g stroke="rgba(255,255,255,0.72)" strokeWidth="0.35" fill="none">
          <rect x="0" y="0" width={PITCH_LENGTH} height={PITCH_WIDTH} />
          <line x1={PITCH_LENGTH / 2} y1="0" x2={PITCH_LENGTH / 2} y2={PITCH_WIDTH} />
          <circle cx={PITCH_LENGTH / 2} cy={PITCH_WIDTH / 2} r="9.15" />

          {/* Penalty areas: 16.5 metres deep, 40.32 wide. Six-yard boxes inside them. */}
          <rect x="0" y={(PITCH_WIDTH - 40.32) / 2} width="16.5" height="40.32" />
          <rect x={PITCH_LENGTH - 16.5} y={(PITCH_WIDTH - 40.32) / 2} width="16.5" height="40.32" />
          <rect x="0" y={(PITCH_WIDTH - 18.32) / 2} width="5.5" height="18.32" />
          <rect x={PITCH_LENGTH - 5.5} y={(PITCH_WIDTH - 18.32) / 2} width="5.5" height="18.32" />

          {/* The D, and the goals themselves. */}
          <path d={`M 16.5 ${PITCH_WIDTH / 2 - 7.3} A 9.15 9.15 0 0 1 16.5 ${PITCH_WIDTH / 2 + 7.3}`} />
          <path
            d={`M ${PITCH_LENGTH - 16.5} ${PITCH_WIDTH / 2 - 7.3} A 9.15 9.15 0 0 0 ${PITCH_LENGTH - 16.5} ${PITCH_WIDTH / 2 + 7.3}`}
          />
          <g className={netHit && !attackingRight ? 'net net-hit' : 'net'}>
            <rect x="-2.6" y={(PITCH_WIDTH - 7.32) / 2} width="2.6" height="7.32" fill="url(#net)" stroke="rgba(255,255,255,0.85)" strokeWidth="0.3" />
          </g>
          <g className={netHit && attackingRight ? 'net net-hit' : 'net'}>
            <rect x={PITCH_LENGTH} y={(PITCH_WIDTH - 7.32) / 2} width="2.6" height="7.32" fill="url(#net)" stroke="rgba(255,255,255,0.85)" strokeWidth="0.3" />
          </g>
        </g>

        <g fill="rgba(255,255,255,0.8)">
          <circle cx={PITCH_LENGTH / 2} cy={PITCH_WIDTH / 2} r="0.5" />
          <circle cx="11" cy={PITCH_WIDTH / 2} r="0.5" />
          <circle cx={PITCH_LENGTH - 11} cy={PITCH_WIDTH / 2} r="0.5" />
        </g>

        {/* Corner arcs. */}
        <g stroke="rgba(255,255,255,0.6)" strokeWidth="0.3" fill="none">
          <path d="M 0 1 A 1 1 0 0 0 1 0" />
          <path d={`M ${PITCH_LENGTH - 1} 0 A 1 1 0 0 0 ${PITCH_LENGTH} 1`} />
          <path d={`M 0 ${PITCH_WIDTH - 1} A 1 1 0 0 1 1 ${PITCH_WIDTH}`} />
          <path d={`M ${PITCH_LENGTH} ${PITCH_WIDTH - 1} A 1 1 0 0 1 ${PITCH_LENGTH - 1} ${PITCH_WIDTH}`} />
        </g>

        {homePlayers.map((slot, i) => (
          <Man
            key={`h${i}`}
            x={slot.x}
            y={slot.y}
            colour={homeColour}
            number={homeNumbers[i] ?? slot.number}
            isUser={userIsHome && userNumber !== undefined && homeNumbers[i] === userNumber}
          />
        ))}
        {awayPlayers.map((slot, i) => (
          <Man
            key={`a${i}`}
            x={slot.x}
            y={slot.y}
            colour={awayColour}
            number={awayNumbers[i] ?? slot.number}
            isUser={!userIsHome && userNumber !== undefined && awayNumbers[i] === userNumber}
          />
        ))}

        {/* The referee, in the colour referees have worn since anyone can remember. */}
        <g style={{ transform: `translate(${referee.x}px, ${referee.y}px)`, transition: `transform ${travel}ms linear` }}>
          <circle r="1.6" fill="#f6d445" stroke="#14181f" strokeWidth="0.5" />
          <text y="0.6" textAnchor="middle" fontSize="1.9" fontWeight="800" fill="#14181f">
            R
          </text>
        </g>

        <g
          className="pitch-ball"
          style={{ transform: `translate(${ball.x}px, ${ball.y}px)`, transition: `transform ${travel}ms cubic-bezier(0.35,0,0.3,1)` }}
        >
          <Football r={1.25} />
        </g>
      </svg>
      {replaying && <span className="pitch-replay">{replayLabel}</span>}
    </div>
  );
}

/** One player: his club's colour, his number on his back. */
function Man({
  x,
  y,
  colour,
  number,
  isUser,
}: {
  x: number;
  y: number;
  colour: string;
  number: number;
  isUser: boolean;
}) {
  return (
    <g
      style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform 620ms ease-out' }}
      className={isUser ? 'pitch-man pitch-me' : 'pitch-man'}
    >
      <circle r="2.2" fill={colour} stroke={isUser ? '#ffd76e' : 'rgba(0,0,0,0.6)'} strokeWidth={isUser ? 0.6 : 0.3} />
      <text y="0.85" textAnchor="middle" fontSize="2.5" fontWeight="700" fill={inkOn(colour)}>
        {number}
      </text>
    </g>
  );
}
