/**
 * What the manager wants out of him this season.
 *
 * A season used to simply start. The fixtures arrived, the weeks went past, and nothing
 * ever said what any of it was for - so a good season and a wasted one felt the same
 * while they were happening, and only the career page knew the difference afterwards.
 *
 * Now there is a conversation in the summer. The manager says what he expects, in the
 * terms a manager actually uses: how much of the season he expects him to play, how many
 * goals and assists he wants out of him, and where the club has to finish. The player
 * takes that brief, argues for a harder one because he thinks he is worth it, or asks
 * for a gentler one and is judged gently.
 *
 * The stake is trust, which is what team selection, contracts and everything else in a
 * career are bought with - so asking for the hard brief and delivering is the fastest
 * way up, and asking for it and failing is the fastest way out.
 */
import { clamp } from './rng.js';
import { overall } from './positions.js';
import type { CareerState, Club, Position, SeasonGoal, SquadRole } from './types.js';

export type GoalStake = SeasonGoal['stake'];

/** Roughly how much of a season a club expects from a player in this role. */
const MINUTES_BY_ROLE: Record<SquadRole, number> = {
  academy: 0,
  futureProspect: 0.12,
  prospect: 0.22,
  fringe: 0.18,
  bench: 0.3,
  rotation: 0.45,
  starter: 0.62,
  important: 0.7,
  key: 0.76,
  star: 0.82,
};

/** Goals and assists a full season in this position is worth, per ninety minutes. */
const CONTRIBUTIONS_PER_90: Record<Position, number> = {
  GK: 0,
  CB: 0.07, RB: 0.09, LB: 0.09, RWB: 0.12, LWB: 0.12,
  CDM: 0.1, CM: 0.2, CAM: 0.38, RM: 0.28, LM: 0.28,
  RW: 0.42, LW: 0.42, CF: 0.5, ST: 0.55,
};

/** How the three briefs differ. Safe is softer everywhere; bold is harder everywhere. */
const STAKES: Record<GoalStake, { minutes: number; contributions: number; places: number }> = {
  safe: { minutes: 0.78, contributions: 0.65, places: 3 },
  agreed: { minutes: 1, contributions: 1, places: 0 },
  bold: { minutes: 1.16, contributions: 1.4, places: -2 },
};

/** Matches a league season is worth, near enough for a target nobody counts to the minute. */
const SEASON_MATCHES = 34;

export interface GoalContext {
  state: CareerState;
  club: Club | null;
  /** Where the club finished last season, or where its strength says it belongs. */
  expectedPosition: number | null;
  leagueSize: number;
}

/** The brief itself, before he has said anything about it. */
export function proposedGoal(ctx: GoalContext, stake: GoalStake): SeasonGoal {
  const { state } = ctx;
  const player = state.player;
  const weights = STAKES[stake];

  const role = player.squadRole;
  const base = MINUTES_BY_ROLE[role] ?? 0.3;
  // A better player than his role suggests is expected to play more than the role does.
  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const clubLevel = ctx.club ? 30 + ctx.club.strength * 0.62 : ovr;
  const merit = clamp((ovr - clubLevel) / 40, -0.12, 0.16);
  const minutes = clamp((base + merit) * weights.minutes, 0.05, 0.92);

  const per90 = CONTRIBUTIONS_PER_90[player.primaryPos] ?? 0.15;
  const contributions = Math.max(
    0,
    Math.round(SEASON_MATCHES * minutes * per90 * weights.contributions),
  );

  const tablePosition =
    ctx.expectedPosition === null
      ? null
      : clamp(Math.round(ctx.expectedPosition + weights.places), 1, Math.max(1, ctx.leagueSize));

  return { season: state.world.season, minutes, contributions, tablePosition, stake };
}

export interface GoalProgress {
  minutesPct: number;
  contributions: number;
  position: number | null;
  metMinutes: boolean;
  metContributions: boolean;
  metPosition: boolean | null;
  /** How much of the brief he has kept, 0-1. */
  score: number;
}

/**
 * Where he stands against it. Used by the screen while the season runs and by the
 * settlement on the last day, so the number he watched all year is the number he is
 * judged on.
 */
export function goalProgress(
  goal: SeasonGoal,
  actual: { minutesPct: number; contributions: number; position: number | null },
): GoalProgress {
  const metMinutes = actual.minutesPct >= goal.minutes * 0.95;
  const metContributions = goal.contributions === 0 || actual.contributions >= goal.contributions;
  const metPosition =
    goal.tablePosition === null || actual.position === null
      ? null
      : actual.position <= goal.tablePosition;

  const parts = [metMinutes, metContributions, ...(metPosition === null ? [] : [metPosition])];
  const score = parts.filter(Boolean).length / parts.length;

  return {
    minutesPct: actual.minutesPct,
    contributions: actual.contributions,
    position: actual.position,
    metMinutes,
    metContributions,
    metPosition,
    score,
  };
}

export interface GoalVerdict {
  score: number;
  trust: number;
  morale: number;
  reputation: number;
  outcome: 'kept' | 'half' | 'missed';
}

/** What keeping it, half-keeping it or missing it is worth, given what he staked. */
export function goalVerdict(goal: SeasonGoal, progress: GoalProgress): GoalVerdict {
  const outcome: GoalVerdict['outcome'] =
    progress.score >= 0.999 ? 'kept' : progress.score >= 0.5 ? 'half' : 'missed';

  const weight = goal.stake === 'bold' ? 1.6 : goal.stake === 'safe' ? 0.65 : 1;

  if (outcome === 'kept') {
    return {
      score: progress.score,
      trust: Math.round(9 * weight),
      morale: 8,
      reputation: goal.stake === 'bold' ? 3 : 1,
      outcome,
    };
  }
  if (outcome === 'half') {
    return { score: progress.score, trust: goal.stake === 'bold' ? -2 : 2, morale: 0, reputation: 0, outcome };
  }
  return {
    score: progress.score,
    trust: -Math.round(8 * weight),
    morale: -9,
    reputation: goal.stake === 'bold' ? -2 : 0,
    outcome,
  };
}
