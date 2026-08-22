import { Rng, clamp } from './rng.js';
import { overall } from './positions.js';
import { FORM_WINDOW_WEEKS } from './development.js';
import type {
  AppliedChange,
  CareerState,
  ConsequenceId,
  DecisionResult,
  Relationships,
  RelationshipKey,
} from './types.js';

/**
 * The people around the player. Nothing here is cosmetic: the manager decides
 * whether he plays, the dressing room colours events, the fans and the board decide
 * whether the club sticks with him when form dips.
 */
export function initRelationships(): Relationships {
  return { manager: 45, teammates: 50, fans: 50, board: 50, media: 50 };
}

export function relationshipLabel(value: number): string {
  if (value >= 80) return 'rel.excellent';
  if (value >= 62) return 'rel.good';
  if (value >= 42) return 'rel.neutral';
  if (value >= 25) return 'rel.poor';
  return 'rel.hostile';
}

/** Records a change so the UI can show exactly what a choice did. */
export function track(
  changes: AppliedChange[],
  key: string,
  before: number,
  after: number,
  higherIsBetter = true,
): void {
  const delta = Math.round((after - before) * 10) / 10;
  if (Math.abs(delta) < 0.5) return;
  changes.push({
    key,
    delta,
    before: Math.round(before),
    after: Math.round(after),
    tone: delta === 0 ? 'neutral' : (delta > 0) === higherIsBetter ? 'good' : 'bad',
  });
}

export function adjustRelationship(
  state: CareerState,
  key: RelationshipKey,
  delta: number,
  changes?: AppliedChange[],
): void {
  const before = state.relationships[key];
  const after = clamp(before + delta, 0, 100);
  state.relationships[key] = after;
  if (key === 'manager') state.managerTrust = after;
  if (changes) track(changes, `change.${key}`, before, after);
}

/** Keeps the legacy managerTrust field and the relationship map in step. */
export function syncManagerTrust(state: CareerState): void {
  state.relationships.manager = state.managerTrust;
}

export interface ConsequenceOutcome {
  id: ConsequenceId;
  args?: Record<string, string | number>;
}

/**
 * Turn the current standing into things that actually happen: being dropped, being
 * listed, being fined. Called after every decision and once a week.
 */
export function evaluateConsequences(rng: Rng, state: CareerState): ConsequenceOutcome[] {
  const out: ConsequenceOutcome[] = [];
  const rel = state.relationships;
  const flags = state.flags;
  const inSquad = state.player.squadRole !== 'academy';

  const benchedUntil = Number(flags['benchedUntilWeek'] ?? 0);
  const absoluteWeek = state.world.season * 52 + state.world.week;

  // Manager has lost patience.
  if (inSquad && rel.manager < 24 && absoluteWeek >= benchedUntil && !flags['droppedNotified']) {
    flags['benchedUntilWeek'] = absoluteWeek + rng.int(3, 6);
    flags['droppedNotified'] = true;
    out.push({ id: 'droppedFromSquad' });
  }
  if (rel.manager >= 42 && flags['droppedNotified']) {
    flags['droppedNotified'] = false;
    flags['benchedUntilWeek'] = 0;
    out.push({ id: 'backInFavour' });
  }

  /*
   * Losing the shirt over a bad run.
   *
   * This is separate from being frozen out after a dispute: he stays in the squad and
   * changes matches from the bench. Two things were wrong with it. It only applied to
   * senior football, so a boy in an academy could play badly for a season and start
   * every Sunday regardless - and it ended only when the form line reached 48, which a
   * run of twenty-minute cameos can take half a year to do. It is a few matches now,
   * and there is a way back out of it that does not depend on chances he is no longer
   * on the pitch to take.
   */
  const hasClub = state.player.clubId !== null;
  /*
   * Three bad afternoons in a row, judged as three bad afternoons.
   *
   * The form line alone was the whole test, and it is a five-match average smoothed a
   * quarter of the way each week: three straight games at 5.8 with two decent ones
   * still in the window land him on 36 or 40, never under the 34 the drop asked for.
   * Which is how a player kept his shirt through a run everyone watching could see was
   * bad. A manager does not average the last five, he watches the last three.
   *
   * Only real appearances count - a run of twenty-minute cameos is not evidence a
   * starter has gone off, and matches older than the form window are not evidence of
   * anything - and the three have to have come since he last won his place back, so a
   * spell that ends cannot immediately re-trigger itself on the very games that caused
   * it.
   */
  const clearedAt = Number(flags['formBenchClearedWeek'] ?? 0);
  const lastThree = state.matchLog
    .filter((match) => (
      match.userLine?.played
      && match.userLine.minutes >= 45
      && !match.competitionId.startsWith('friendly')
      && match.season * 52 + match.week >= clearedAt
      && absoluteWeek - (match.season * 52 + match.week) <= FORM_WINDOW_WEEKS
    ))
    .slice(0, 3)
    .map((match) => match.userLine!.rating);
  const badRun = lastThree.length === 3
    && lastThree.every((rating) => rating < 6.3)
    && lastThree.reduce((a, b) => a + b, 0) / 3 < 6.1;

  if (hasClub && (state.player.form < 34 || badRun) && !flags['formBenchNotified']) {
    flags['formBenchNotified'] = true;
    flags['formBenchFromWeek'] = absoluteWeek;
    flags['formBenchUntilWeek'] = absoluteWeek + rng.int(2, 3);
    out.push({ id: 'benchedForForm' });
  }
  if (flags['formBenchNotified']) {
    const servedUntil = Number(flags['formBenchUntilWeek'] ?? 0);
    const droppedAt = Number(flags['formBenchFromWeek'] ?? servedUntil - 3);
    // What he has done since he was dropped, and only that: the matches that cost him
    // the shirt are not evidence that he deserves it back.
    const sinceDropped = state.matchLog
      .filter((match) => (
        match.userLine?.played
        && !match.competitionId.startsWith('friendly')
        && match.season * 52 + match.week >= droppedAt
      ))
      .slice(0, 4)
      .map((match) => match.userLine!.rating);
    const best = sinceDropped.length > 0 ? Math.max(...sinceDropped) : 0;
    const served = absoluteWeek >= servedUntil;
    /*
     * Three ways back into the side, because there has to be one.
     *
     * The form line recovering is the plain one. Otherwise the spell is served and he
     * has looked like a footballer again in one of his cameos - and failing all of
     * that, a manager does not leave a fit senior player on the bench for half a season
     * over form. He either plays him or the club moves him on, and being moved on is
     * somebody else's rule.
     */
    const played = sinceDropped.length;
    if (
      state.player.form >= 48
      || (served && played > 0 && (state.player.form >= 40 || best >= 6.5))
      || absoluteWeek >= servedUntil + 3
    ) {
      flags['formBenchNotified'] = false;
      flags['formBenchUntilWeek'] = 0;
      flags['formBenchFromWeek'] = 0;
      // The games that cost him the shirt are spent. He has to play three more bad ones
      // to lose it again, rather than being dropped straight back on the same evidence.
      flags['formBenchClearedWeek'] = absoluteWeek;
      out.push({ id: 'backInForm' });
    }
  }

  // The club starts looking for a replacement, then lists him.
  if (inSquad && rel.manager < 30 && rel.board < 40 && !flags['transferListed']) {
    if (!flags['replacementSought']) {
      flags['replacementSought'] = true;
      out.push({ id: 'clubSeeksReplacement' });
    } else if (rng.chance(0.4)) {
      flags['transferListed'] = true;
      out.push({ id: 'transferListed' });
    }
  }
  if (flags['transferListed'] && rel.manager > 52 && rel.board > 52) {
    flags['transferListed'] = false;
    flags['replacementSought'] = false;
    out.push({ id: 'offTransferList' });
  }

  if (rel.teammates < 22 && !flags['dressingRoomFallout']) {
    flags['dressingRoomFallout'] = true;
    out.push({ id: 'dressingRoomFallout' });
  }
  if (rel.teammates > 45) flags['dressingRoomFallout'] = false;

  if (rel.fans < 22 && !flags['fansTurned']) {
    flags['fansTurned'] = true;
    out.push({ id: 'fansTurned' });
  }
  if (rel.fans > 60 && flags['fansTurned']) {
    flags['fansTurned'] = false;
    out.push({ id: 'fansBehindYou' });
  }

  if (rel.board < 22 && !flags['boardWarning']) {
    flags['boardWarning'] = true;
    out.push({ id: 'boardWarning' });
  }
  if (rel.board > 45) flags['boardWarning'] = false;

  return out;
}

/** True while the manager is deliberately leaving him out. */
export function isFrozenOut(state: CareerState): boolean {
  const absoluteWeek = state.world.season * 52 + state.world.week;
  return absoluteWeek < Number(state.flags['benchedUntilWeek'] ?? 0);
}

// ---------------------------------------------------------------- player actions

export type PlayerActionId =
  | 'askManagerTrust'
  | 'askManagerFeedback'
  | 'reviewMatchVideo'
  | 'individualFormSession'
  | 'requestSeniorTraining'
  | 'apologiseManager'
  | 'acceptBenchRole'
  | 'demandPlayingTime'
  | 'requestTransferTalk'
  | 'thankFans'
  | 'admitBadForm'
  | 'apologiseFans'
  | 'signAutographs'
  | 'teamDinner'
  | 'extraTrainingWithTeammates'
  | 'apologiseTeammates'
  | 'askCaptainAdvice'
  | 'meetBoard'
  | 'praiseClubInMedia'
  | 'frontClubCommunityDay'
  | 'visitSupportersClub'
  | 'giveExclusiveInterview'
  | 'defendTeamPublicly'
  | 'answerCritics'
  | 'quietWeek';

export interface PlayerActionDef {
  id: PlayerActionId;
  category: 'manager' | 'fans' | 'teammates' | 'board' | 'media' | 'personal';
  cost: number;                    // how much of the weekly social budget it uses
  riskKey?: 'risk.low' | 'risk.medium' | 'risk.high';
  /** Only offered when this returns true. */
  available: (state: CareerState) => boolean;
}

/**
 * How long before he can do it again.
 *
 * Asking the manager for a run of games is a conversation you have once and then live
 * with; apologising twice in a fortnight is not an apology. Without this the whole
 * screen is a button you press twenty times to farm relationship points, which is not
 * a game, it is a spreadsheet with a bug.
 */
const ACTION_COOLDOWN_WEEKS: Partial<Record<PlayerActionId, number>> = {
  askManagerTrust: 16,
  askManagerFeedback: 8,
  reviewMatchVideo: 6,
  individualFormSession: 5,
  requestSeniorTraining: 12,
  apologiseManager: 12,
  acceptBenchRole: 20,
  demandPlayingTime: 20,
  requestTransferTalk: 24,
  thankFans: 8,
  admitBadForm: 14,
  apologiseFans: 12,
  signAutographs: 6,
  teamDinner: 12,
  extraTrainingWithTeammates: 8,
  apologiseTeammates: 12,
  askCaptainAdvice: 8,
  meetBoard: 24,
  praiseClubInMedia: 10,
  frontClubCommunityDay: 12,
  visitSupportersClub: 10,
  giveExclusiveInterview: 12,
  defendTeamPublicly: 10,
  answerCritics: 14,
  quietWeek: 4,
};

const DEFAULT_COOLDOWN_WEEKS = 10;

function absoluteWeek(state: CareerState): number {
  return state.world.season * 52 + state.world.week;
}

/** True when he has done this recently enough that doing it again would be noise. */
export function actionOnCooldown(state: CareerState, id: PlayerActionId): boolean {
  const until = state.actionCooldowns?.[id];
  return until !== undefined && absoluteWeek(state) < until;
}

/** Weeks until he can do it again, for the screen to show. */
export function actionCooldownLeft(state: CareerState, id: PlayerActionId): number {
  const until = state.actionCooldowns?.[id];
  if (until === undefined) return 0;
  return Math.max(0, until - absoluteWeek(state));
}

const hasClub = (state: CareerState) => state.player.clubId !== null;

/**
 * Whether an action makes sense right now.
 *
 * A player does not apologise for nothing, does not demand games while he is playing
 * every week, and does not thank a crowd that has just booed him off. Every option on
 * the people screen has to be something this player would actually do this week, or
 * the screen turns into a list of buttons rather than a set of decisions.
 */
const seniorAtClub = (state: CareerState) =>
  hasClub(state) && state.player.squadRole !== 'academy' && !state.retired;

/** How much of the football he is getting, from the role the club gave him. */
const benched = (state: CareerState) =>
  ['fringe', 'bench', 'rotation', 'prospect', 'futureProspect'].includes(state.player.squadRole);

/** Recent form on the pitch, from this season's matches. */
function recentRating(state: CareerState): number | null {
  const rated = state.matchLog.filter((m) => m.userLine?.played).slice(0, 4);
  if (rated.length === 0) return null;
  return rated.reduce((sum, m) => sum + (m.userLine?.rating ?? 0), 0) / rated.length;
}

function youthAverage(state: CareerState): number {
  const form = state.world.youth?.form;
  return form && form.apps > 0 ? form.ratingSum / form.apps : 0;
}

/** True after a defeat, a heavy one, or a sending off - the weeks you say sorry. */
/**
 * The last match, but only while it is still the last match anybody is talking about.
 *
 * This used to read matchLog[0] with no sense of when it was played, so a defeat in May
 * was still "the bad week" the following September - which is why the game kept offering
 * an apology to a manager after a pre-season in which nothing whatsoever had happened.
 */
function recentMatch(state: CareerState) {
  const last = state.matchLog[0];
  if (!last) return null;
  const weeksAgo = state.world.season * 52 + state.world.week - (last.season * 52 + last.week);
  return weeksAgo >= 0 && weeksAgo <= 2 ? last : null;
}

function badWeek(state: CareerState): boolean {
  const last = recentMatch(state);
  if (!last) return false;
  const club = state.player.clubId;
  if (!club) return false;
  const isHome = last.homeClubId === club;
  const forGoals = isHome ? last.homeGoals : last.awayGoals;
  const against = isHome ? last.awayGoals : last.homeGoals;
  const sentOff = (last.userLine?.red ?? 0) > 0;
  return sentOff || forGoals < against;
}

/** Whether there is football on. Half of these only make sense during a season. */
function inSeason(state: CareerState): boolean {
  return state.world.week >= 3 && state.world.week <= 47;
}

/** Sent off in the last fortnight, which is the classic reason to go and say sorry. */
function sentOffRecently(state: CareerState): boolean {
  const last = recentMatch(state);
  return (last?.userLine?.red ?? 0) > 0;
}

/** True after a win, or a personal performance worth being thanked for. */
function goodWeek(state: CareerState): boolean {
  const last = recentMatch(state);
  if (!last || !last.userLine?.played) return false;
  const club = state.player.clubId;
  if (!club) return false;
  const isHome = last.homeClubId === club;
  const forGoals = isHome ? last.homeGoals : last.awayGoals;
  const against = isHome ? last.awayGoals : last.homeGoals;
  return forGoals > against || (last.userLine.rating ?? 0) >= 7.5;
}

export const PLAYER_ACTIONS: PlayerActionDef[] = [
  {
    // Only worth asking when you are not in the side, or the manager has cooled on you.
    id: 'askManagerTrust',
    category: 'manager',
    cost: 1,
    riskKey: 'risk.medium',
    available: (s) => seniorAtClub(s) && (benched(s) || s.relationships.manager < 60),
  },
  {
    id: 'askManagerFeedback',
    category: 'manager',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && !s.retired,
  },
  {
    id: 'reviewMatchVideo',
    category: 'manager',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && !s.retired && (s.player.form < 58 || (recentRating(s) ?? 7) < 6.6),
  },
  {
    id: 'individualFormSession',
    category: 'personal',
    cost: 1,
    riskKey: 'risk.medium',
    available: (s) => hasClub(s) && !s.retired && s.player.form < 62 && s.player.condition.fatigue < 82,
  },
  {
    id: 'requestSeniorTraining',
    category: 'manager',
    cost: 1,
    riskKey: 'risk.medium',
    available: (s) => {
      const age = s.world.season - s.player.birthYear;
      const form = s.world.youth?.form;
      return s.player.squadRole === 'academy'
        && age >= 16
        && Boolean(form && form.apps >= 3 && youthAverage(s) >= 6.7)
        && !s.flags['calledUpToSeniors'];
    },
  },
  {
    id: 'apologiseManager',
    category: 'manager',
    cost: 1,
    riskKey: 'risk.low',
    // You apologise for something that happened: an unresolved row or your own red
    // card. A defeat and an ordinary trust score are football, not a personal conflict.
    available: (s) =>
      hasClub(s) &&
      (Boolean(s.flags['incidentWithManager']) ||
        sentOffRecently(s)),
  },
  {
    id: 'acceptBenchRole',
    category: 'manager',
    cost: 1,
    riskKey: 'risk.low',
    // Accepting a role you do not have makes no sense.
    available: (s) => seniorAtClub(s) && benched(s),
  },
  {
    id: 'demandPlayingTime',
    category: 'manager',
    cost: 1,
    riskKey: 'risk.high',
    // Demanding games while you play every week is not a conversation, it is a tantrum.
    available: (s) => seniorAtClub(s) && benched(s),
  },
  {
    id: 'requestTransferTalk',
    category: 'board',
    cost: 2,
    riskKey: 'risk.high',
    // You ask to leave when you are not playing, not wanted, or unhappy.
    available: (s) =>
      seniorAtClub(s) && (benched(s) || Boolean(s.flags['transferListed']) || s.player.morale < 40),
  },
  {
    // Thanking the crowd belongs to a week that went well.
    id: 'thankFans',
    category: 'fans',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && goodWeek(s),
  },
  {
    id: 'admitBadForm',
    category: 'fans',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && (s.player.form < 45 || (recentRating(s) ?? 7) < 6.2),
  },
  {
    id: 'apologiseFans',
    category: 'fans',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) =>
      hasClub(s) &&
      (Boolean(s.flags['incidentWithFans']) || sentOffRecently(s) || (badWeek(s) && s.relationships.fans < 58)),
  },
  {
    // Nobody waits outside a training ground in the middle of the summer.
    id: 'signAutographs',
    category: 'fans',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && !s.retired && inSeason(s),
  },
  {
    // Dinner is for a squad you are part of, and it costs money you have.
    id: 'teamDinner',
    category: 'teammates',
    cost: 2,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && !s.retired && inSeason(s) && s.finances.balance > 5_000,
  },
  {
    id: 'extraTrainingWithTeammates',
    category: 'teammates',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && !s.retired && inSeason(s) && s.player.condition.fatigue < 70,
  },
  {
    id: 'apologiseTeammates',
    category: 'teammates',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) =>
      hasClub(s) && (Boolean(s.flags['dressingRoomFallout']) || (sentOffRecently(s) && s.relationships.teammates < 55)),
  },
  {
    id: 'askCaptainAdvice',
    category: 'teammates',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && !s.retired && inSeason(s),
  },
  {
    id: 'meetBoard',
    category: 'board',
    cost: 2,
    riskKey: 'risk.medium',
    // The board sees senior players with something to discuss: a contract, or a future.
    available: (s) =>
      seniorAtClub(s) &&
      (s.contract === null ||
        s.contract.endSeason - s.world.season <= 1 ||
        Boolean(s.flags['transferListed']) ||
        s.player.reputation >= 55),
  },
  {
    id: 'praiseClubInMedia',
    category: 'board',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && !s.retired && s.relationships.board < 75,
  },
  {
    id: 'frontClubCommunityDay',
    category: 'board',
    cost: 2,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && !s.retired && inSeason(s),
  },
  {
    id: 'visitSupportersClub',
    category: 'fans',
    cost: 2,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && !s.retired && inSeason(s),
  },
  {
    id: 'giveExclusiveInterview',
    category: 'media',
    cost: 1,
    riskKey: 'risk.medium',
    available: (s) => hasClub(s) && !s.retired && inSeason(s) && s.player.reputation >= 22,
  },
  {
    id: 'defendTeamPublicly',
    category: 'media',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && !s.retired && badWeek(s),
  },
  {
    id: 'answerCritics',
    category: 'media',
    cost: 1,
    riskKey: 'risk.high',
    available: (s) =>
      hasClub(s) && !s.retired && inSeason(s) && (s.relationships.media < 45 || (recentRating(s) ?? 7) < 6.25),
  },
  { id: 'quietWeek', category: 'personal', cost: 1, riskKey: 'risk.low', available: () => true },
];

export function availableActions(state: CareerState): PlayerActionDef[] {
  if (state.retired) return [];
  const left = state.socialActions.perWeek - state.socialActions.used;
  return PLAYER_ACTIONS.filter(
    (action) => action.available(state) && action.cost <= left && !actionOnCooldown(state, action.id),
  );
}

/**
 * Carry out a conversation or a gesture. Outcomes lean on personality and on how
 * the person already feels about him, so the same words land differently over time.
 */
export function performAction(rng: Rng, state: CareerState, id: PlayerActionId): DecisionResult {
  const def = PLAYER_ACTIONS.find((a) => a.id === id);
  const changes: AppliedChange[] = [];
  const consequences: ConsequenceOutcome[] = [];
  if (!def || !def.available(state) || actionOnCooldown(state, id)) return { changes, consequences };

  const player = state.player;
  const rel = state.relationships;
  const charisma = (player.attributes.leadership + player.personality.professionalism) / 2;
  const swing = (base: number) => base * (0.7 + charisma / 160) * rng.range(0.75, 1.25);
  const moraleBefore = player.morale;
  const formBefore = player.form;
  let narrativeKey = `action.${id}.result`;

  switch (id) {
    case 'askManagerTrust': {
      // Asking for a run of games works when he is playing well, and grates when he is not.
      const merit = (player.form - 50) / 12 + (rel.manager - 45) / 14;
      if (merit + rng.gauss(0, 1.2) > 0) {
        adjustRelationship(state, 'manager', swing(6), changes);
        player.morale = clamp(player.morale + 5, 0, 100);
        narrativeKey = `action.${id}.good`;
      } else {
        adjustRelationship(state, 'manager', -swing(5), changes);
        player.morale = clamp(player.morale - 4, 0, 100);
        narrativeKey = `action.${id}.bad`;
      }
      break;
    }
    case 'askManagerFeedback': {
      adjustRelationship(state, 'manager', swing(3), changes);
      const focus = rng.pick(['decisions', 'positioning', 'composure', 'workRate'] as const);
      const before = player.attributes[focus];
      player.attributes[focus] = clamp(before + rng.range(0.4, 1.2), 1, 99);
      track(changes, `change.attr.${focus}`, before, player.attributes[focus]);

      // Being told what is wrong with you is not always useful. Some coaches are working
      // from a video of a bad afternoon, and a player who takes it all to heart starts
      // thinking on the pitch instead of playing.
      const harsh = rng.chance(clamp(0.34 - (rel.manager - 50) / 260, 0.12, 0.5));
      if (harsh) {
        const dented = rng.pick(['composure', 'dribbling', 'vision'] as const);
        const wasAt = player.attributes[dented];
        player.attributes[dented] = clamp(wasAt - rng.range(0.4, 1.1), 1, 99);
        track(changes, `change.attr.${dented}`, wasAt, player.attributes[dented]);
        player.morale = clamp(player.morale - 4, 0, 100);
        narrativeKey = `action.${id}.harsh`;
        break;
      }
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'reviewMatchVideo': {
      adjustRelationship(state, 'manager', swing(2), changes);
      const first = rng.pick(['decisions', 'positioning', 'concentration'] as const);
      const second = first === 'decisions' ? 'composure' : 'decisions';
      for (const key of [first, second] as const) {
        const before = player.attributes[key];
        player.attributes[key] = clamp(before + rng.range(0.25, 0.7), 1, 99);
        track(changes, `change.attr.${key}`, before, player.attributes[key]);
      }
      player.morale = clamp(player.morale + 2, 0, 100);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'individualFormSession': {
      const sharpnessBefore = player.condition.sharpness;
      player.condition.sharpness = clamp(sharpnessBefore + rng.range(5, 9), 0, 100);
      player.condition.fatigue = clamp(player.condition.fatigue + rng.range(6, 10), 0, 100);
      player.form = clamp(player.form + rng.range(2, 5), 0, 100);
      track(changes, 'change.sharpness', sharpnessBefore, player.condition.sharpness);
      const overworked = rng.chance(clamp(player.condition.fatigue / 230, 0.08, 0.38));
      if (overworked) {
        player.fitness = clamp(player.fitness - rng.range(2, 5), 0, 100);
        player.morale = clamp(player.morale - 2, 0, 100);
        narrativeKey = `action.${id}.overworked`;
      } else {
        narrativeKey = `action.${id}.good`;
      }
      break;
    }
    case 'requestSeniorTraining': {
      const form = state.world.youth?.form;
      const average = form && form.apps > 0 ? form.ratingSum / form.apps : 0;
      const accepted = rng.chance(clamp(0.32 + (average - 6.5) * 0.28 + rel.manager / 250, 0.2, 0.9));
      if (accepted && player.clubId) {
        state.flags['calledUpToSeniors'] = true;
        player.squadRole = state.world.season - player.birthYear >= 17 ? 'prospect' : 'futureProspect';
        const list = state.world.squads[player.clubId] ?? (state.world.squads[player.clubId] = []);
        if (!list.includes(player.id)) list.push(player.id);
        adjustRelationship(state, 'manager', swing(5), changes);
        player.morale = clamp(player.morale + 7, 0, 100);
        narrativeKey = `action.${id}.good`;
      } else {
        adjustRelationship(state, 'manager', -swing(2), changes);
        player.morale = clamp(player.morale - 2, 0, 100);
        narrativeKey = `action.${id}.notYet`;
      }
      break;
    }
    case 'apologiseManager': {
      const accepted = rng.chance(clamp(0.45 + rel.manager / 200 + player.personality.professionalism / 300, 0.25, 0.9));
      if (accepted) {
        adjustRelationship(state, 'manager', swing(9), changes);
        state.flags['incidentWithManager'] = false;
        consequences.push({ id: 'apologyAccepted' });
        narrativeKey = `action.${id}.good`;
      } else {
        adjustRelationship(state, 'manager', swing(2), changes);
        consequences.push({ id: 'apologyRejected' });
        narrativeKey = `action.${id}.bad`;
      }
      break;
    }
    case 'acceptBenchRole': {
      adjustRelationship(state, 'manager', swing(7), changes);
      adjustRelationship(state, 'teammates', swing(3), changes);
      player.morale = clamp(player.morale - 6, 0, 100);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'demandPlayingTime': {
      const listened = rng.chance(clamp(0.25 + (player.reputation - 40) / 130 + (rel.manager - 45) / 160, 0.05, 0.7));
      if (listened) {
        adjustRelationship(state, 'manager', swing(4), changes);
        player.morale = clamp(player.morale + 8, 0, 100);
        narrativeKey = `action.${id}.good`;
      } else {
        adjustRelationship(state, 'manager', -swing(12), changes);
        adjustRelationship(state, 'board', -swing(4), changes);
        player.morale = clamp(player.morale + 3, 0, 100);
        state.flags['incidentWithManager'] = true;
        narrativeKey = `action.${id}.bad`;
      }
      break;
    }
    case 'requestTransferTalk': {
      state.flags['transferRequested'] = true;
      adjustRelationship(state, 'board', -swing(10), changes);
      adjustRelationship(state, 'fans', -swing(8), changes);
      adjustRelationship(state, 'manager', -swing(6), changes);
      narrativeKey = `action.${id}.result`;
      break;
    }
    case 'thankFans': {
      adjustRelationship(state, 'fans', swing(6), changes);
      player.fame = clamp(player.fame + 1, 0, 100);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'admitBadForm': {
      adjustRelationship(state, 'fans', swing(8), changes);
      adjustRelationship(state, 'media', swing(4), changes);
      player.morale = clamp(player.morale + 3, 0, 100);
      // Owning it publicly settles the head: a small confidence bump.
      const before = player.attributes.composure;
      player.attributes.composure = clamp(before + rng.range(0.3, 0.9), 1, 99);
      track(changes, 'change.attr.composure', before, player.attributes.composure);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'apologiseFans': {
      const accepted = rng.chance(clamp(0.5 + rel.fans / 200, 0.3, 0.9));
      adjustRelationship(state, 'fans', accepted ? swing(11) : swing(3), changes);
      state.flags['incidentWithFans'] = false;
      consequences.push({ id: accepted ? 'apologyAccepted' : 'apologyRejected' });
      narrativeKey = accepted ? `action.${id}.good` : `action.${id}.bad`;
      break;
    }
    case 'signAutographs': {
      adjustRelationship(state, 'fans', swing(4), changes);
      player.fame = clamp(player.fame + 1.5, 0, 100);
      player.condition.fatigue = clamp(player.condition.fatigue + 2, 0, 100);

      // An hour outside the ground is an hour on your feet, and there is always one who
      // has come to say something rather than to get a signature.
      if (rng.chance(0.28)) {
        const before = player.attributes.concentration;
        player.attributes.concentration = clamp(before - rng.range(0.3, 0.9), 1, 99);
        track(changes, 'change.attr.concentration', before, player.attributes.concentration);
        player.morale = clamp(player.morale - 3, 0, 100);
        narrativeKey = `action.${id}.sour`;
        break;
      }
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'teamDinner': {
      adjustRelationship(state, 'teammates', swing(10), changes);
      player.morale = clamp(player.morale + 5, 0, 100);
      player.condition.fatigue = clamp(player.condition.fatigue + 6, 0, 100);
      state.finances.balance -= 4000;

      // Some of these finish at eleven and some of them do not. A professional gets away
      // with it more often, which is most of what being a professional is.
      const late = rng.chance(clamp(0.42 - player.personality.professionalism / 280, 0.12, 0.55));
      if (late) {
        player.fitness = clamp(player.fitness - rng.range(3, 7), 0, 100);
        const before = player.condition.sharpness;
        player.condition.sharpness = clamp(before - rng.range(3, 8), 0, 100);
        track(changes, 'change.sharpness', before, player.condition.sharpness);
        player.personality.professionalism = clamp(player.personality.professionalism - 0.6, 1, 99);
        narrativeKey = `action.${id}.late`;
        break;
      }
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'extraTrainingWithTeammates': {
      adjustRelationship(state, 'teammates', swing(5), changes);
      adjustRelationship(state, 'manager', swing(3), changes);
      player.condition.fatigue = clamp(player.condition.fatigue + 7, 0, 100);
      const before = player.condition.sharpness;
      player.condition.sharpness = clamp(before + 6, 0, 100);
      track(changes, 'change.sharpness', before, player.condition.sharpness);

      // Extra work on top of a full week is where legs go. The more tired he already is,
      // the more likely this is the session he regrets.
      const overcooked = rng.chance(clamp(player.condition.fatigue / 220, 0.08, 0.45));
      if (overcooked) {
        player.fitness = clamp(player.fitness - rng.range(4, 9), 0, 100);
        const pace = player.attributes.pace;
        player.attributes.pace = clamp(pace - rng.range(0.2, 0.7), 1, 99);
        track(changes, 'change.attr.pace', pace, player.attributes.pace);
        narrativeKey = `action.${id}.overcooked`;
        break;
      }
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'apologiseTeammates': {
      const accepted = rng.chance(clamp(0.55 + rel.teammates / 220, 0.3, 0.92));
      adjustRelationship(state, 'teammates', accepted ? swing(12) : swing(4), changes);
      if (accepted) state.flags['dressingRoomFallout'] = false;
      consequences.push({ id: accepted ? 'apologyAccepted' : 'apologyRejected' });
      narrativeKey = accepted ? `action.${id}.good` : `action.${id}.bad`;
      break;
    }
    case 'askCaptainAdvice': {
      adjustRelationship(state, 'teammates', swing(6), changes);
      adjustRelationship(state, 'manager', swing(1.5), changes);
      const focus = rng.pick(['decisions', 'positioning', 'leadership'] as const);
      const before = player.attributes[focus];
      player.attributes[focus] = clamp(before + rng.range(0.35, 0.9), 1, 99);
      track(changes, `change.attr.${focus}`, before, player.attributes[focus]);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'meetBoard': {
      const persuaded = rng.chance(clamp(0.35 + (player.reputation - 45) / 140, 0.1, 0.8));
      adjustRelationship(state, 'board', persuaded ? swing(9) : -swing(4), changes);
      if (persuaded && state.flags['transferListed']) {
        state.flags['transferListed'] = false;
        consequences.push({ id: 'offTransferList' });
      }
      narrativeKey = persuaded ? `action.${id}.good` : `action.${id}.bad`;
      break;
    }
    case 'praiseClubInMedia': {
      adjustRelationship(state, 'board', swing(5), changes);
      adjustRelationship(state, 'fans', swing(4), changes);
      adjustRelationship(state, 'media', swing(3), changes);

      // The dressing room has a word for a player who says all the right things in front
      // of a camera, and it is not a compliment.
      if (rng.chance(0.3)) {
        adjustRelationship(state, 'teammates', -swing(6), changes);
        narrativeKey = `action.${id}.creep`;
        break;
      }
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'frontClubCommunityDay': {
      adjustRelationship(state, 'board', swing(5), changes);
      adjustRelationship(state, 'fans', swing(7), changes);
      player.fame = clamp(player.fame + 1.5, 0, 100);
      player.condition.fatigue = clamp(player.condition.fatigue + 4, 0, 100);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'visitSupportersClub': {
      adjustRelationship(state, 'fans', swing(9), changes);
      adjustRelationship(state, 'board', swing(2), changes);
      player.morale = clamp(player.morale + 3, 0, 100);
      player.condition.fatigue = clamp(player.condition.fatigue + 3, 0, 100);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'giveExclusiveInterview': {
      adjustRelationship(state, 'media', swing(8), changes);
      adjustRelationship(state, 'fans', swing(3), changes);
      player.fame = clamp(player.fame + 3, 0, 100);
      player.condition.fatigue = clamp(player.condition.fatigue + 2, 0, 100);
      // A long profile can sound like self-promotion to the people sharing the shirt.
      if (rng.chance(clamp(0.38 - player.personality.professionalism / 300, 0.12, 0.42))) {
        adjustRelationship(state, 'teammates', -swing(5), changes);
        narrativeKey = `action.${id}.selfish`;
        break;
      }
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'defendTeamPublicly': {
      adjustRelationship(state, 'teammates', swing(8), changes);
      adjustRelationship(state, 'manager', swing(3), changes);
      adjustRelationship(state, 'fans', swing(3), changes);
      // Refusing to give the press a scapegoat protects the room and costs access.
      adjustRelationship(state, 'media', -swing(2), changes);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'answerCritics': {
      const nerve = player.attributes.composure + player.personality.pressureHandling + player.reputation;
      const landed = rng.chance(clamp(0.18 + nerve / 360, 0.22, 0.78));
      if (landed) {
        adjustRelationship(state, 'media', swing(10), changes);
        adjustRelationship(state, 'fans', swing(5), changes);
        player.morale = clamp(player.morale + 5, 0, 100);
        narrativeKey = `action.${id}.good`;
      } else {
        adjustRelationship(state, 'media', -swing(9), changes);
        adjustRelationship(state, 'manager', -swing(5), changes);
        player.morale = clamp(player.morale - 4, 0, 100);
        narrativeKey = `action.${id}.bad`;
      }
      break;
    }
    case 'quietWeek': {
      player.condition.fatigue = clamp(player.condition.fatigue - 10, 0, 100);
      player.morale = clamp(player.morale + 2, 0, 100);

      // Rest is not free. A week of doing nothing takes the edge off, and the edge is
      // what the first twenty minutes on Saturday are made of.
      const before = player.condition.sharpness;
      player.condition.sharpness = clamp(before - rng.range(2, 6), 0, 100);
      track(changes, 'change.sharpness', before, player.condition.sharpness);
      narrativeKey = `action.${id}.good`;
      break;
    }
  }

  track(changes, 'change.morale', moraleBefore, player.morale);
  track(changes, 'change.form', formBefore, player.form);

  state.socialActions.used += def.cost;
  // And that is that for a while.
  state.actionCooldowns = state.actionCooldowns ?? {};
  state.actionCooldowns[id] = absoluteWeek(state) + (ACTION_COOLDOWN_WEEKS[id] ?? DEFAULT_COOLDOWN_WEEKS);
  consequences.push(...evaluateConsequences(rng, state));

  return { changes, consequences, narrativeKey };
}

/**
 * Weekly drift. Relationships sag when the player is not contributing and recover
 * when he is, so standing is something he keeps earning rather than a one-off score.
 */
export function driftRelationships(
  rng: Rng,
  state: CareerState,
  context: { minutesPct: number; recentRating: number | null; played: boolean },
): void {
  const performance = context.recentRating === null ? 0 : context.recentRating - 6.6;
  const minutes = context.minutesPct;
  const ovr = overall(state.player.attributes, state.player.primaryPos, state.player.secondaryPos);

  // Pulls are small and mean-reverting: standing has to be re-earned constantly, and
  // nobody ends up permanently pinned at 0 or 100 after a long career.
  const pulls: Record<RelationshipKey, number> = {
    manager: performance * 0.7 + (minutes - 0.35) * 1.0,
    fans: performance * 0.8 + (state.player.fame - 45) / 130 + (minutes - 0.3) * 0.6,
    teammates: (state.player.personality.professionalism - 50) / 90 + performance * 0.3,
    board: (minutes - 0.4) * 0.8 + (ovr - 62) / 120,
    media: performance * 0.5 + (state.player.fame - 45) / 120,
  };

  for (const key of Object.keys(pulls) as RelationshipKey[]) {
    const current = state.relationships[key];
    const reversion = (52 - current) * 0.035;
    const delta = clamp(pulls[key] + reversion + rng.gauss(0, 0.2), -1.6, 1.6);
    adjustRelationship(state, key, delta);
  }
}
