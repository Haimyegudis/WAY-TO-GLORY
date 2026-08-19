/** Core domain model. Everything here is plain data so it can be JSON-serialised into a save. */
import type { QualifyingCampaign } from './qualifying.js';
import type { MentorState } from './mentor.js';

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

export const SQUAD_ROLES: readonly SquadRole[] = [
  'academy', 'futureProspect', 'prospect', 'fringe', 'bench', 'rotation', 'starter', 'important', 'key', 'star',
];

export type InjurySeverity = 'minor' | 'moderate' | 'serious' | 'major' | 'careerThreatening';

export interface Injury {
  id: string;
  type: string;             // i18n key suffix, e.g. 'hamstring'
  severity: InjurySeverity;
  weeksOut: number;
  weeksRemaining: number;
  season: number;
  recurrenceOf?: string;    // type of a previous injury this one repeats
  treatment?: 'surgery' | 'conservative' | 'playThrough';
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
  /** The domestic cup, by its real name. */
  cupName?: string;
  cupNameHe?: string;
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
    | 'yellow' | 'red' | 'injury' | 'sub-on' | 'sub-off' | 'penaltyScored' | 'penaltyMissed'
    // Broadcast colour: things that happen in a game without changing the score.
    | 'kickOff' | 'halfTime' | 'fullTime' | 'corner' | 'freeKick' | 'offside'
    | 'chance' | 'woodwork' | 'oppMiss';
  playerId?: string;
  byUser: boolean;
  detailKey?: string;
  score?: [number, number];
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
  /** Only present for detail level 1 (matches the user was involved in). */
  userLine?: UserMatchLine;
  events?: MatchEvent[];
  scorers?: { playerId: string; clubId: string; minute: number }[];
}

export type MatchImportance =
  | 'normal' | 'derby' | 'rival' | 'titleDecider' | 'relegationSixPointer'
  | 'cupFinal' | 'cupSemi' | 'europeanNight' | 'debut' | 'firstProMatch'
  | 'vsFormerClub' | 'internationalDebut' | 'finalMatch';

export interface UserMatchLine {
  played: boolean;
  started: boolean;
  minutes: number;
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
  /** playerId -> assists, so the charts are not only about who finished. */
  assists?: Record<string, number>;
  /** playerId -> cards picked up in this competition. */
  cards?: Record<string, { yellow: number; red: number }>;
  finished: boolean;
  champion?: string;
  promoted?: string[];
  relegated?: string[];
}

export interface Fixture {
  round: number;
  week: number;
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  result?: [number, number];
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
  | 'injuryPickedUp'
  | 'apologyAccepted'
  | 'apologyRejected';

export interface DecisionResult {
  changes: AppliedChange[];
  consequences: { id: ConsequenceId; args?: Record<string, string | number> }[];
  narrativeKey?: string;
}

export interface NationalTeamState {
  countryCode: string | null;         // committed senior association
  eligibleCountries: string[];
  level: 'none' | 'u17' | 'u19' | 'u21' | 'senior';
  caps: number;
  goals: number;
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

export interface WorldState {
  season: number;                    // e.g. 2026 means season 2026/27
  week: number;                      // 1-based week within the season calendar
  clubs: Record<string, Club>;
  competitions: Record<string, CompetitionSeasonState>;
  /** Squads we actually model: user's club (full) + named stars of clubs in the user's league. */
  squads: Record<string, string[]>;  // clubId -> playerIds
  players: Record<string, Player>;   // only modelled players
  seasonStats: Record<string, SeasonStats>; // playerId -> current season stats
  /** The youth league he plays in until the first team calls him up. */
  youth?: CompetitionSeasonState;
  /** What he has done in it this season. */
  youthForm?: { apps: number; goals: number; assists: number; ratingSum: number };
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
  contract: Contract | null;
  agent: Agent | null;
  agentOffers: Agent[];
  training: TrainingPlan;
  managerTrust: number;          // mirrors relationships.manager, kept for save compatibility
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
  /** What the manager wants, or null when it is left to the player. */
  demand: import('./halftime.js').HalfTimeInstructionId | null;
  options: import('./halftime.js').HalfTimeInstructionId[];
  /** Filled in when he answers, and read by the resumed simulation. */
  chosen?: import('./halftime.js').HalfTimeInstructionId;
  obeyed?: boolean;
}
