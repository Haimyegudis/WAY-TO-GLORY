/** Core domain model. Everything here is plain data so it can be JSON-serialised into a save. */
import type { QualifyingCampaign } from './qualifying.js';
import type { MentorState } from './mentor.js';
import type { LifeState } from './life.js';

export type Position =
  | 'GK'
  | 'CB' | 'RB' | 'LB' | 'RWB' | 'LWB'
  | 'CDM' | 'CM' | 'CAM' | 'RM' | 'LM'
  | 'RW' | 'LW' | 'CF' | 'ST';

export const POSITIONS: readonly Position[] = [
  'GK', 'CB', 'RB', 'LB', 'RWB', 'LWB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'CF', 'ST',
];

export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'ATT';

export type Foot = 'L' | 'R' | 'B';

export type AttributeKey =
  // physical
  | 'pace' | 'acceleration' | 'strength' | 'stamina' | 'agility' | 'balance' | 'jumping'
  // technical
  | 'shooting' | 'finishing' | 'passing' | 'crossing' | 'dribbling' | 'ballControl'
  | 'tackling' | 'marking' | 'heading' | 'firstTouch'
  // goalkeeping
  | 'reflexes' | 'handling' | 'positioningGK' | 'kicking'
  // mental
  | 'decisions' | 'composure' | 'workRate' | 'positioning' | 'vision' | 'concentration' | 'leadership';

export const ATTRIBUTE_KEYS: readonly AttributeKey[] = [
  'pace', 'acceleration', 'strength', 'stamina', 'agility', 'balance', 'jumping',
  'shooting', 'finishing', 'passing', 'crossing', 'dribbling', 'ballControl',
  'tackling', 'marking', 'heading', 'firstTouch',
  'reflexes', 'handling', 'positioningGK', 'kicking',
  'decisions', 'composure', 'workRate', 'positioning', 'vision', 'concentration', 'leadership',
];

export const PHYSICAL_ATTRS: readonly AttributeKey[] = [
  'pace', 'acceleration', 'strength', 'stamina', 'agility', 'balance', 'jumping',
];

export const MENTAL_ATTRS: readonly AttributeKey[] = [
  'decisions', 'composure', 'workRate', 'positioning', 'vision', 'concentration', 'leadership',
];

export type Attributes = Record<AttributeKey, number>;

export type PersonalityKey =
  | 'professionalism' | 'ambition' | 'loyalty' | 'adaptability'
  | 'pressureHandling' | 'discipline' | 'consistency' | 'determination';

export const PERSONALITY_KEYS: readonly PersonalityKey[] = [
  'professionalism', 'ambition', 'loyalty', 'adaptability',
  'pressureHandling', 'discipline', 'consistency', 'determination',
];

export type Personality = Record<PersonalityKey, number>;

export type SquadRole =
  | 'academy'
  | 'futureProspect'
  | 'prospect'
  | 'fringe'
  | 'bench'
  | 'rotation'
  | 'starter'
  | 'important'
  | 'key'
  | 'star';

/**
 * A career the world keeps for somebody other than the player.
 *
 * Only a handful of people are worth this - the boys he came through with, and the ones
 * who turn into somebody - but for those, every season is added up so that twenty years
 * later there is something to compare a life against.
 */
export interface PlayerCareer {
  firstSeason: number;
  apps: number;
  goals: number;
  assists: number;
  trophies: number;
  peakOvr: number;
  spells: { clubId: string; fromSeason: number; toSeason: number; apps: number; goals: number }[];
  retiredSeason?: number;
}

export type InjurySeverity = 'minor' | 'moderate' | 'serious' | 'major' | 'careerThreatening';

export interface Injury {
  id: string;
  type: string;             // i18n key suffix, e.g. 'hamstring'
  severity: InjurySeverity;
  weeksOut: number;
  weeksRemaining: number;
  season: number;
  recurrenceOf?: string;    // type of a previous injury this one repeats
  treatment?: 'surgery' | 'injection' | 'conservative' | 'longRest' | 'playThrough';
  aggravated?: boolean;
}

export interface Suspension {
  matchesRemaining: number;
  reason: 'yellowAccumulation' | 'secondYellow' | 'redCard';
  competitionId: string;
}

export interface Condition {
  fatigue: number;                  // 0-100, high is bad
  sharpness: number;                // 0-100, match sharpness
  injuries: Injury[];               // active injuries
  injuryHistory: Injury[];
  suspensions: Suspension[];
  yellowCards: Record<string, number>; // competitionId -> running total this season
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number;
  birthCountry: string;             // country code
  citizenships: string[];
  heightCm: number;
  weightKg: number;
  foot: Foot;
  primaryPos: Position;
  secondaryPos: Position[];
  attributes: Attributes;
  potential: number;
  personality: Personality;
  form: number;                     // 0-100
  fitness: number;                  // 0-100
  morale: number;                   // 0-100
  condition: Condition;
  clubId: string | null;
  squadRole: SquadRole;
  /** The number on his back. Chosen at creation for the user, cosmetic for the rest. */
  shirtNumber?: number;
  reputation: number;               // 0-100
  fame: number;                     // 0-100
  isUser: boolean;
  /** The world has been told to keep this one: he has a career of his own. */
  tracked?: boolean;
  career?: PlayerCareer;
  isReal?: boolean;                 // came from the real-names data pack
  retired?: boolean;
}

export interface Club {
  id: string;
  name: string;
  /** Club name in Hebrew, taken from the club's own Hebrew Wikipedia article. */
  nameHe?: string;
  shortName: string;
  /** Crest file shipped with the app, relative to /crests. */
  crest?: string;
  /** Dominant crest colour, used to tint the club's card. */
  color?: string;
  country: string;
  competitionId: string;
  tier: number;
  city?: string;
  /** The standing the club started the game with; reputation is pulled back to it. */
  prestige?: number;
  /** Clubs this one has history with. A fixture against them is never just a fixture. */
  rivals?: string[];
  /**
   * The rivals that share a town with this club. A derby is two clubs from one city -
   * every other grudge, however old, is a rivalry - and the city field is missing for
   * enough leagues that the famous ones are listed by hand.
   */
  derbies?: string[];
  reputation: number;   // 0-100
  academy: number;      // 0-100 youth development
  training: number;     // 0-100 facilities/coaching
  finances: number;     // 0-100 wage power
  strength: number;     // 0-100 current on-pitch strength, moves season to season
  colors?: [string, string];
  source?: 'openfootball' | 'manual';
}

export interface CardRules {
  yellowSuspensionThreshold: number;
  /** Yellow totals reset after this matchday (0 = never). */
  resetAfterMatchday: number;
  secondYellowSuspension: number;
  redSuspension: number;
}

export type LeagueTieBreaker = 'headToHead' | 'wins' | 'goalDifference' | 'goalsFor' | 'id';

export interface LeagueRules {
  pointsForWin: number;
  pointsForDraw: number;
  tieBreakers: LeagueTieBreaker[];
}

export interface CompetitionCalendar {
  firstWeek: number;
  lastWeek: number;
  /** Domestic shutdown weeks, if any, inside the playing window. */
  breakWeeks?: number[];
}

export interface LeagueSplitRules {
  regularRounds: number;
  regularLastWeek: number;
  upperTeams: number;
  /** Passes the championship group plays among itself after the split. */
  upperRounds: number;
  /** Passes the relegation group plays. Israel's lower eight meet once, not twice. */
  lowerRounds: number;
}

export interface Competition {
  id: string;
  name: string;
  nameHe?: string;
  country: string;
  tier: number;
  type: 'league' | 'cup' | 'continental';
  teams: number;
  rounds: number;                 // 1 = single round robin, 2 = home and away
  groups?: number;                // for split third tiers
  /** Divide the table after the regular season, with points carried forward. */
  split?: LeagueSplitRules;
  promotion?: { auto: number; playoff?: number; to?: string };
  relegation?: { auto: number; playoff?: number; to?: string };
  /**
   * Places in Europe. The plain fields go straight into the group stage; the `Qual`
   * fields have to be won in the summer, which is how a champion of a smaller league
   * reaches the Champions League - or does not.
   */
  europeanSlots?: {
    ucl?: number; uel?: number; uecl?: number;
    uclQual?: number; uelQual?: number; ueclQual?: number;
  };
  cards: CardRules;
  leagueRules?: LeagueRules;
  calendar?: CompetitionCalendar;
  reputation: number;             // 0-100
  seasonStartMonth: number;       // 1-12
}

export interface Country {
  code: string;
  name: string;
  nameHe: string;
  reputation: number;
  competitionIds: string[];
  nameLocale: string;             // which name pool generated players use
  /**
   * Which continent's competitions it belongs to.
   *
   * Everything used to be Europe, so "does this nation play a Euro" was the same
   * question as "is this nation in the pack". It stopped being the same question the
   * day Brazil was added.
   */
  confederation?: 'UEFA' | 'CONMEBOL' | 'CONCACAF';
  /** The domestic cup, by its real name. */
  cupName?: string;
  cupNameHe?: string;
  /** The league cup, where the country actually plays one - Israel's Toto, England's EFL. */
  leagueCupName?: string;
  leagueCupNameHe?: string;
}

/**
 * What he did in one shirt, inside one season.
 *
 * A season record carries a single clubId, and a mid-season move overwrites it - so
 * eleven goals scored at two clubs were all filed under whichever badge he happened to
 * be wearing in May, and every screen reading that record credited the new club with the
 * old club's football. The season total is still the season; this is the same season broken
 * down by the shirt it was played in.
 */
export interface SeasonSpell {
  clubId: string;
  competitionId: string | null;
  apps: number;
  goals: number;
  assists: number;
  minutes: number;
  ratingSum: number;
  ratedApps: number;
}

export interface SeasonStats {
  season: number;
  clubId: string | null;
  competitionId: string | null;
  apps: number;
  starts: number;
  subApps: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  motm: number;
  ratingSum: number;
  ratedApps: number;
  /** The same season, split by the club he was at. One entry unless he moved. */
  spells?: SeasonSpell[];
}

/**
 * What the manager wants out of him this season.
 *
 * Set in the summer, in his own words, and settled on the last day. The stake is his:
 * take what he is offered, ask for a harder brief because he believes he is worth it,
 * or take the safe one and be judged gently. What it costs and pays is trust, which is
 * the currency everything else in a season is bought with.
 */
export interface SeasonGoal {
  season: number;
  /** Share of the club's minutes he is expected to play, 0-1. */
  minutes: number;
  /** Goals and assists together: one number, because a winger is judged on both. */
  contributions: number;
  /** Where the club is expected to finish, when it has a league to finish in. */
  tablePosition: number | null;
  stake: 'safe' | 'agreed' | 'bold';
  settled?: boolean;
}

export interface CareerSeasonRecord extends SeasonStats {
  age: number;
  ovrStart: number;
  ovrEnd: number;
  valueStart: number;
  valueEnd: number;
  leaguePosition: number | null;
  trophies: string[];
  onLoanFrom?: string;
}

export interface Contract {
  clubId: string;
  salaryPerWeek: number;          // in EUR
  startSeason: number;
  endSeason: number;              // inclusive
  squadRole: SquadRole;
  signingBonus: number;
  appearanceBonus: number;
  goalBonus: number;
  releaseClause: number | null;
  isLoan?: boolean;
  parentClubId?: string;
}

export type AgentTier = 'none' | 'local' | 'national' | 'international' | 'superAgent';

export interface Agent {
  id: string;
  name: string;
  tier: AgentTier;
  connections: number;            // 0-100
  negotiation: number;
  loyalty: number;
  greed: number;                  // commission appetite
  careerPlanning: number;
  internationalNetwork: number;
  commissionPct: number;
  relationship: number;           // 0-100 with the user
  countries: string[];            // where its connections reach
}

export interface MatchEvent {
  minute: number;
  type:
    | 'goal' | 'assist' | 'miss' | 'save' | 'concede' | 'keyPass' | 'tackle' | 'blockedShot'
    | 'yellow' | 'red' | 'injury' | 'sub-on' | 'sub-off' | 'penaltyAwarded' | 'penaltyScored' | 'penaltyMissed'
    // Broadcast colour: things that happen in a game without changing the score.
    | 'kickOff' | 'halfTime' | 'fullTime' | 'corner' | 'freeKick' | 'offside'
    | 'chance' | 'woodwork' | 'oppMiss';
  playerId?: string;
  byUser: boolean;
  detailKey?: string;
  score?: [number, number];
  /** Which side the incident belongs to when `byUser` alone cannot say it. */
  forUserTeam?: boolean;
  /** Colour for the live broadcast; left out of the written match report. */
  ambient?: boolean;
}

export interface MatchResult {
  id: string;
  season: number;
  week: number;
  competitionId: string;
  homeClubId: string;
  awayClubId: string;
  homeGoals: number;
  awayGoals: number;
  detailLevel: 1 | 2 | 3;
  importance?: MatchImportance;
  /** The instruction that genuinely shaped the second half, when one was chosen. */
  instruction?:
    | 'pushForward' | 'holdShape' | 'createForOthers' | 'takeThemOn' | 'saveLegs' | 'chaseEverything'
    | 'shootFromDistance' | 'playAlone' | 'passMore' | 'defendMore' | 'pressHigher';
  /** Instructions issued while the clock was running, in chronological order. */
  instructionChanges?: LiveInstructionChange[];
  /** Only present for detail level 1 (matches the user was involved in). */
  userLine?: UserMatchLine;
  /** How many were there, what the sky was doing, and who had the whistle. */
  attendance?: number;
  weather?: 'clear' | 'rain' | 'heavyRain' | 'wind' | 'heat' | 'cold';
  referee?: { name: string; strictness: number };
  /**
   * The club he played this one for. A season can be played at two clubs, and once he
   * has moved there is nothing in the fixture itself that says which side he was on.
   */
  userClubId?: string;
  events?: MatchEvent[];
  scorers?: { playerId: string; clubId: string; minute: number }[];
}

export type MatchImportance =
  | 'normal' | 'friendly' | 'derby' | 'rival' | 'titleDecider' | 'relegationSixPointer'
  /** One of the sides at the top of the table, whoever he happens to be. */
  | 'topSide'
  | 'cupFinal' | 'cupSemi' | 'europeanNight' | 'debut' | 'firstProMatch'
  | 'vsFormerClub' | 'internationalDebut' | 'finalMatch';

export interface UserMatchLine {
  played: boolean;
  started: boolean;
  minutes: number;
  /** The man in the opposite shirt, and whether he had the better of him. */
  duel?: { name: string; won: boolean };
  /** Into his own net. Rare, and the one line of a match report he will remember. */
  ownGoals?: number;
  position: Position | null;
  goals: number;
  assists: number;
  shots: number;
  keyPasses: number;
  tackles: number;
  saves: number;
  yellow: number;
  red: number;
  rating: number;
  motm: boolean;
  /** The minute he came on, if he started on the bench. */
  cameOnMinute?: number;
  /** The minute he came off, if he did not see it out. */
  offMinute?: number;
  reasonNotPlayed?: 'injured' | 'suspended' | 'notSelected' | 'notInSquad';
}

export interface LeagueTableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface CompetitionSeasonState {
  competitionId: string;
  season: number;
  clubIds: string[];
  table: Record<string, LeagueTableRow>;
  fixtures: Fixture[];
  currentRound: number;
  scorers: Record<string, number>;     // playerId -> goals
  /** Copied into the save so an old career keeps the rules it began with. */
  leagueRules?: LeagueRules;
  /** playerId -> assists, so the charts are not only about who finished. */
  assists?: Record<string, number>;
  /** playerId -> cards picked up in this competition. */
  cards?: Record<string, { yellow: number; red: number }>;
  finished: boolean;
  champion?: string;
  promoted?: string[];
  relegated?: string[];
  /** Membership is locked when a league divides into championship and relegation groups. */
  splitGroups?: { upper: string[]; lower: string[] };
}

export interface Fixture {
  round: number;
  week: number;
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  phase?: 'regular' | 'championship' | 'relegation';
  result?: [number, number];
  /**
   * Who scored them, for the divisions we model player by player. A round of results
   * with no names in it is a row of numbers; this is what makes it a matchday.
   */
  goals?: FixtureGoal[];
}

export interface FixtureGoal {
  playerId: string;
  clubId: string;
  assistId?: string;
}

export type TrainingIntensity = 'light' | 'normal' | 'intensive' | 'extreme';
export type TrainingFocus =
  | 'balanced' | 'physical' | 'technical' | 'mental' | 'finishing' | 'defending' | 'goalkeeping' | 'recovery';
export type DietLevel = 'poor' | 'normal' | 'professional' | 'nutritionist';

export interface TrainingPlan {
  intensity: TrainingIntensity;
  focus: TrainingFocus;
  diet: DietLevel;
}

/**
 * Everyone whose opinion of the player matters. These move on results, on choices
 * and on how the player behaves, and they feed selection, offers and events.
 */
export interface Relationships {
  manager: number;    // 0-100 trust from the head coach
  teammates: number;  // 0-100 standing in the dressing room
  fans: number;       // 0-100 how the stands feel about him
  board: number;      // 0-100 how the club's management sees him
  media: number;      // 0-100 press goodwill
}

export type RelationshipKey = keyof Relationships;

/** A single visible change produced by a decision or an action. */
export interface AppliedChange {
  key: string;              // i18n label key, e.g. 'change.morale'
  delta: number;
  before: number;
  after: number;
  tone: 'good' | 'bad' | 'neutral';
}

export type ConsequenceId =
  | 'droppedFromSquad'
  | 'backInFavour'
  | 'transferListed'
  | 'offTransferList'
  | 'fined'
  | 'dressingRoomFallout'
  | 'fansTurned'
  | 'fansBehindYou'
  | 'boardWarning'
  | 'captaincyLost'
  | 'clubSeeksReplacement'
  | 'benchedForForm'
  | 'backInForm'
  | 'injuryPickedUp'
  | 'apologyAccepted'
  | 'apologyRejected';

export interface DecisionResult {
  changes: AppliedChange[];
  consequences: { id: ConsequenceId; args?: Record<string, string | number> }[];
  narrativeKey?: string;
  /**
   * What he actually said or did, as a copy key.
   *
   * Most stories have no written outcome line - there are three hundred of them and ten
   * lines - and the result sheet quietly showed a list of numbers with nothing above it.
   * The answer he gave is a sentence the game already owns, so it stands in as the
   * headline and every decision ends with something in words.
   */
  answerKey?: string;
}

/** How a manager sees players before he has seen this one. */
export type ManagerStyle = 'trusting' | 'demanding' | 'youthBuilder' | 'pragmatist';

export interface Manager {
  name: string;
  style: ManagerStyle;
  /** The season he took the job, so the game can say how long he has been there. */
  since: number;
  clubId: string;
}

export interface NationalTeamState {
  countryCode: string | null;         // committed senior association
  eligibleCountries: string[];
  level: 'none' | 'u17' | 'u19' | 'u21' | 'senior';
  caps: number;
  goals: number;
  /** Appearances at u17, u19 and u21. A youth career is a career and is remembered. */
  youthCaps: number;
  youthGoals: number;
  callUpHistory: { season: number; level: string; countryCode: string }[];
  capturedBySenior: boolean;          // has played a competitive senior cap
  interest: Record<string, number>;   // countryCode -> 0-100 interest
}

/**
 * A branch of a gamble. The option is taken, then this is rolled: it either comes off
 * or it does not, and the same choice can play out differently on another career.
 */
export interface EventOutcome {
  /** Suffix for the copy shown afterwards: `event.<id>.<option>.<key>`. */
  key: string;
  /** Relative likelihood before the player's own qualities are taken into account. */
  weight: number;
  /** What tilts the roll: the player's standing, his form, or the manager's trust. */
  swayedBy?: 'reputation' | 'form' | 'managerTrust' | 'determination' | 'fame';
  /** How strongly it is tilted. Positive means the quality makes this outcome likelier. */
  sway?: number;
  effects: EventEffect[];
}

export interface CareerEventOption {
  id: string;
  labelKey: string;
  riskKey?: string;
  effects: EventEffect[];
  /** When present, one of these is rolled after the option's own effects are applied. */
  outcomes?: EventOutcome[];
}

export interface EventEffect {
  kind:
    | 'morale' | 'managerTrust' | 'relationship' | 'form' | 'fitness' | 'fatigue' | 'reputation' | 'fame'
    | 'attribute' | 'personality' | 'potential' | 'injuryRisk' | 'money' | 'squadRole'
    | 'learnPosition' | 'transferRequest' | 'agentRelationship' | 'custom';
  key?: string;
  value?: number;
  chance?: number;                    // applied probabilistically
}

export interface CareerEventDef {
  id: string;
  category: 'club' | 'manager' | 'agent' | 'medical' | 'transfer' | 'national' | 'personal' | 'media' | 'sponsor';
  weight: number;
  cooldownWeeks: number;
  oncePerCareer?: boolean;
  trigger: EventTrigger;
  textKey: string;
  options: CareerEventOption[];
}

export interface EventTrigger {
  ageRange?: [number, number];
  seasonWeekRange?: [number, number];
  minMinutesSeasonPct?: number;
  maxMinutesSeasonPct?: number;
  /** Competitive matches behind him, youth football included. Friendlies do not count. */
  minCareerApps?: number;
  squadRoleIn?: SquadRole[];
  minOvr?: number;
  maxOvr?: number;
  minMorale?: number;
  maxMorale?: number;
  minManagerTrust?: number;
  maxManagerTrust?: number;
  hasAgent?: boolean;
  injured?: boolean;
  tierIn?: number[];
  requiresContractExpiringIn?: number;   // seasons
}

export type DecisionKind = 'event' | 'transfer' | 'agent';

export interface PendingDecision {
  id: string;
  kind: DecisionKind;
  eventId: string;
  category: CareerEventDef['category'];
  textKey: string;
  textArgs?: Record<string, string | number>;
  options: CareerEventOption[];
  /** Clubs on the table, when this is a transfer or loan approach. */
  offers?: TransferOffer[];
  /** Agents who want to represent him. */
  agents?: Agent[];
  /**
   * Whether this question stops his week. Moves, contracts, operations and countries do;
   * the rest waits in the inbox until he opens it.
   */
  blocking: boolean;
  expiresWeek?: number;
}

export interface TransferOffer {
  id: string;
  clubId: string;
  fee: number;
  salaryPerWeek: number;
  years: number;
  squadRole: SquadRole;
  expectedMinutesPct: number;
  isLoan: boolean;
  season: number;
  week: number;
  interestLevel: number;
  competitionId: string;
  /** The player is leaving academy football for this club's first team. */
  seniorPathway?: boolean;
  /**
   * Which side of the club is signing him. An academy player can be offered a better
   * academy or a senior squad, and the two are nothing alike: only first-team football
   * justifies dropping to a weaker club, so the offer has to say which it is.
   */
  joinAs?: 'academy' | 'senior';
  /**
   * Where this club sits against the one he is at: a step up, a move sideways, or a
   * level below him. A boy is regularly and correctly offered first-team football at a
   * smaller club - that is how a career starts - but he is entitled to see, before he
   * answers, that the badge on the shirt is a smaller one than the badge he has.
   */
  levelStep?: 'up' | 'sideways' | 'down';
  /** Terms won at the table, and how many times he has been back to it. */
  signingBonus?: number;
  releaseClause?: number | null;
  asksMade?: number;
}

export interface InboxMessage {
  id: string;
  season: number;
  week: number;
  category: 'club' | 'manager' | 'agent' | 'medical' | 'transfer' | 'national' | 'personal' | 'media' | 'sponsor' | 'system';
  titleKey: string;
  bodyKey?: string;
  args?: Record<string, string | number>;
  read: boolean;
  decisionId?: string;
  /** A concrete task offered by the sender, not merely prose that looks actionable. */
  action?: {
    type: 'setTrainingFocus';
    focus: TrainingFocus;
    /** The load the staff asked for, alongside the work itself. */
    intensity?: TrainingIntensity;
  };
}

export interface LiveInstructionChange {
  minute: number;
  instruction: import('./halftime.js').HalfTimeInstructionId;
}

export interface NewsItem {
  season: number;
  week: number;
  key: string;
  args?: Record<string, string | number>;
  importance: 'low' | 'medium' | 'high';
}

export interface Achievement {
  id: string;
  season: number;
  args?: Record<string, string | number>;
}

export type { YouthWorld, YouthForm } from './youth.js';

export interface WorldState {
  /**
   * Players the world is not allowed to forget. Everybody else is scenery that can be
   * regenerated; these have careers attached and outlive any squad rebuild.
   */
  tracked?: string[];
  season: number;                    // e.g. 2026 means season 2026/27
  week: number;                      // 1-based week within the season calendar
  clubs: Record<string, Club>;
  competitions: Record<string, CompetitionSeasonState>;
  /** Squads we actually model: user's club (full) + named stars of clubs in the user's league. */
  squads: Record<string, string[]>;  // clubId -> playerIds
  players: Record<string, Player>;   // only modelled players
  seasonStats: Record<string, SeasonStats>; // playerId -> current season stats
  /**
   * The youth pyramid: a division per senior tier, with real squads in the one he is
   * actually in. Present while he is young enough to be in it.
   */
  youth?: import('./youth.js').YouthWorld;
  /** A schema 1 save's single youth table, kept only until the migration has read it. */
  youthLegacy?: CompetitionSeasonState;
  /** Domestic cups, one per country, rebuilt each season. */
  cups: Record<string, import('./cup.js').CupState>;
  /** The three European competitions, rebuilt each season from who qualified. */
  europe?: Record<string, import('./europe.js').EuroState>;
  /** Who qualified for next season's Europe, decided when this season ends. */
  europeNext?: Record<string, string[]>;
  history: {
    champions: { season: number; competitionId: string; clubId: string }[];
    topScorers: { season: number; competitionId: string; playerId: string; goals: number }[];
    cupWinners: { season: number; cupId: string; clubId: string }[];
    europeanWinners?: { season: number; tier: string; clubId: string }[];
    awards?: { season: number; award: string; playerId: string; playerName?: string; detail?: number }[];
  };
}

export interface CareerState {
  schemaVersion: number;
  gameVersion: string;
  careerSeed: number;
  rngState: number;
  createdAt: string;
  savedAt: string;
  player: Player;
  /** Attribute snapshot from week one, used to show honest in-season development. */
  seasonStartAttributes?: Attributes;
  contract: Contract | null;
  agent: Agent | null;
  agentOffers: Agent[];
  training: TrainingPlan;
  managerTrust: number;          // mirrors relationships.manager, kept for save compatibility
  /** The man in the dugout. Undefined on careers saved before managers had names. */
  manager?: Manager;
  /**
   * The job he has decided to do in this week's match, against the fixture it was
   * chosen for. A plan belongs to one opponent: it does not carry into next Saturday.
   */
  matchPlan?: { key: string; plan: string };
  relationships: Relationships;
  /** Conversations and gestures cost time: a small budget refreshed every week. */
  socialActions: { used: number; perWeek: number };
  /** Absolute week each conversation becomes available again: you cannot ask twice. */
  actionCooldowns?: Record<string, number>;
  lastResult: DecisionResult | null;
  /** A match waiting on a team talk. Present only between the two whistles. */
  pendingHalfTime?: PendingHalfTime;
  world: WorldState;
  nationalTeam: NationalTeamState;
  /** The old player who took an interest in him, if he has asked one to. */
  mentor?: MentorState;
  /** The qualifying campaign his country is playing for the next tournament, if any. */
  campaign?: QualifyingCampaign;
  /** Campaigns already settled, so a career remembers the summers it missed. */
  campaignHistory?: QualifyingCampaign[];
  seasonHistory: CareerSeasonRecord[];
  /** What the manager asked of him this season, and what it is worth. */
  seasonGoal?: SeasonGoal;
  /** Sponsors, and the things he has bought with what football paid him. */
  life?: LifeState;
  matchLog: MatchResult[];           // recent matches only (compacted)
  lastMatch: MatchResult | null;
  trophies: { season: number; competitionId: string; kind: 'league' | 'cup' | 'promotion' }[];
  /** Individual honours the player has won, newest last. */
  awards?: { season: number; award: string; competitionId?: string; detail?: number }[];
  /** Summer tournaments he played in: World Cups and European Championships. */
  tournaments?: import('./tournament.js').TournamentResult[];
  /** Honours he was shortlisted for but did not win - being in the conversation counts. */
  awardNominations?: { season: number; award: string }[];
  inbox: InboxMessage[];
  news: NewsItem[];
  achievements: Achievement[];
  pendingDecisions: PendingDecision[];
  transferOffers: TransferOffer[];
  eventCooldowns: Record<string, number>;   // eventId -> absolute week when usable again
  firedOnceEvents: string[];
  finances: { balance: number; careerEarnings: number };
  marketValue: number;
  retired: boolean;
  retirementSeason?: number;
  careerScore?: number;
  flags: Record<string, number | string | boolean>;
}

export interface TickResult {
  state: CareerState;
  stopped: 'decision' | 'match' | 'seasonEnd' | 'retired' | 'week' | 'halfTime';
  log: string[];
}

/**
 * A match stopped at the break.
 *
 * Nothing in it has touched the world yet: the fixture is still unplayed, the table has
 * not moved, and the player has not been given so much as a minute. What is held here
 * is the seed the match was rolled from and the team sheet it was rolled with, which is
 * enough to play the same first half again and then play a different second one.
 */
export interface PendingHalfTime {
  matchId: string;
  competitionId: string;
  homeClubId: string;
  awayClubId: string;
  importance: MatchImportance;
  /** Set when the stopped match is a youth fixture. */
  youthOpponentRating?: number;
  matchSeed: number;
  lineup: import('./selection.js').Lineup;
  minutes: import('./selection.js').MinutesOutcome;
  firstHalfEvents: MatchEvent[];
  /** Home goals, away goals - in that order, whichever side he is on. */
  score: [number, number];
  /** How he has played so far, so the dressing room has something to react to. */
  rating: number;
  /** Locked at kick-off so a half-time relationship change cannot rewrite the first half. */
  mental?: number;
  /** The crowd, the sky and the referee, held so the second half is the same afternoon. */
  atmosphere?: {
    attendance: number;
    weather: 'clear' | 'rain' | 'heavyRain' | 'wind' | 'heat' | 'cold';
    referee: { name: string; strictness: number };
  };
  /** Penalty duty as it stood at kick-off. */
  penaltyTaker?: boolean;
  /** What the manager wants, or null when it is left to the player. */
  demand: import('./halftime.js').HalfTimeInstructionId | null;
  options: import('./halftime.js').HalfTimeInstructionId[];
  /** Filled in when he answers, and read by the resumed simulation. */
  chosen?: import('./halftime.js').HalfTimeInstructionId;
  obeyed?: boolean;
  /** Player instructions issued while watching the first half. */
  liveInstructions?: LiveInstructionChange[];
}
