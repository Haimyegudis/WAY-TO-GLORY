/** Core domain model. Everything here is plain data so it can be JSON-serialised into a save. */

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
  reputation: number;               // 0-100
  fame: number;                     // 0-100
  isUser: boolean;
  isReal?: boolean;                 // came from the real-names data pack
  retired?: boolean;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  country: string;
  competitionId: string;
  tier: number;
  city?: string;
  reputation: number;   // 0-100
  academy: number;      // 0-100 youth development
  training: number;     // 0-100 facilities/coaching
  finances: number;     // 0-100 wage power
  strength: number;     // 0-100 current on-pitch strength, moves season to season
  colors?: [string, string];
  rivals?: string[];
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
  country: string;
  tier: number;
  type: 'league' | 'cup' | 'continental';
  teams: number;
  rounds: number;                 // 1 = single round robin, 2 = home and away
  groups?: number;                // for split third tiers
  promotion?: { auto: number; playoff?: number; to?: string };
  relegation?: { auto: number; playoff?: number; to?: string };
  europeanSlots?: { ucl?: number; uel?: number; uecl?: number };
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
    | 'yellow' | 'red' | 'injury' | 'sub-on' | 'sub-off' | 'penaltyScored' | 'penaltyMissed';
  playerId?: string;
  byUser: boolean;
  detailKey?: string;
  score?: [number, number];
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

export interface CareerEventOption {
  id: string;
  labelKey: string;
  riskKey?: string;
  effects: EventEffect[];
}

export interface EventEffect {
  kind:
    | 'morale' | 'managerTrust' | 'form' | 'fitness' | 'fatigue' | 'reputation' | 'fame'
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

export interface PendingDecision {
  id: string;
  eventId: string;
  category: CareerEventDef['category'];
  textKey: string;
  textArgs?: Record<string, string | number>;
  options: CareerEventOption[];
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
  /** Domestic cups, one per country, rebuilt each season. */
  cups: Record<string, import('./cup.js').CupState>;
  history: {
    champions: { season: number; competitionId: string; clubId: string }[];
    topScorers: { season: number; competitionId: string; playerId: string; goals: number }[];
    cupWinners: { season: number; cupId: string; clubId: string }[];
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
  managerTrust: number;
  world: WorldState;
  nationalTeam: NationalTeamState;
  seasonHistory: CareerSeasonRecord[];
  matchLog: MatchResult[];           // recent matches only (compacted)
  lastMatch: MatchResult | null;
  trophies: { season: number; competitionId: string; kind: 'league' | 'cup' | 'promotion' }[];
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
  stopped: 'decision' | 'match' | 'seasonEnd' | 'retired' | 'week';
  log: string[];
}
