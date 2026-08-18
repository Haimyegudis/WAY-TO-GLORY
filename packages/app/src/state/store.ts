import { create } from 'zustand';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import {
  acceptOffer as engineAcceptOffer,
  actionsAvailableNow,
  advanceWeek,
  answerAgent as engineAnswerAgent,
  answerOffer as engineAnswerOffer,
  doPlayerAction,
  createCareer,
  deserialize,
  getAcademyOffers,
  indexPack,
  joinClub,
  resolveDecision,
  retire as engineRetire,
  serialize,
  setTraining as engineSetTraining,
  signAgent as engineSignAgent,
  Rng,
  type AcademyOffer,
  type CareerState,
  type CreateCareerInput,
  type DecisionResult,
  type PlayerActionId,
  type DataPack,
  type PackIndex,
  type TickResult,
  type TrainingPlan,
} from '@fc/engine';
import packJson from '@fc/data/pack';

const SAVE_KEY = 'fc.career.v1';

export type Screen =
  | 'hub'
  | 'club'
  | 'train'
  | 'market'
  | 'career'
  | 'settings'
  | 'match'
  | 'matches'
  | 'national'
  | 'social';
export type Phase = 'loading' | 'menu' | 'create' | 'academy' | 'playing';

interface GameStore {
  phase: Phase;
  screen: Screen;
  state: CareerState | null;
  index: PackIndex | null;
  academyOffers: AcademyOffer[];
  hasSave: boolean;
  busy: boolean;
  toast: string | null;
  lastTick: TickResult['stopped'] | null;
  /** Shown in a sheet right after a choice, so the player sees what it did. */
  result: DecisionResult | null;
  /**
   * The match id currently being watched minute by minute. Set when the week stops on
   * a match the player was involved in; cleared once he has seen it out or skipped.
   */
  liveMatchId: string | null;

  boot: () => Promise<void>;
  goto: (screen: Screen) => void;
  startCreation: () => void;
  cancelCreation: () => void;
  createPlayer: (input: CreateCareerInput) => void;
  chooseAcademy: (clubId: string) => void;
  loadSave: () => Promise<void>;
  deleteSave: () => Promise<void>;
  advance: (weeks?: number) => void;
  decide: (decisionId: string, optionId: string) => void;
  answerOffer: (decisionId: string, offerId: string | null) => void;
  answerAgent: (decisionId: string, agentId: string | null) => void;
  runAction: (id: PlayerActionId) => void;
  clearResult: () => void;
  acceptOffer: (offerId: string) => void;
  signAgent: (agentId: string) => void;
  updateTraining: (plan: Partial<TrainingPlan>) => void;
  retire: () => void;
  markInboxRead: () => void;
  endLive: () => void;
  showToast: (message: string | null) => void;
  save: () => Promise<void>;
}

const pack = packJson as unknown as DataPack;

function persist(state: CareerState): void {
  // Saving is fire and forget: a dropped write costs at most one week of play.
  void idbSet(SAVE_KEY, serialize(state));
}

export const useGame = create<GameStore>((set, get) => ({
  phase: 'loading',
  screen: 'hub',
  state: null,
  index: null,
  academyOffers: [],
  hasSave: false,
  busy: false,
  toast: null,
  lastTick: null,
  result: null,
  liveMatchId: null,

  async boot() {
    const raw = await idbGet<string>(SAVE_KEY);
    set({ hasSave: typeof raw === 'string', phase: 'menu' });
  },

  goto(screen) {
    set({ screen });
  },

  startCreation() {
    set({ phase: 'create' });
  },

  cancelCreation() {
    set({ phase: 'menu' });
  },

  createPlayer(input) {
    const { state, index } = createCareer(pack, input);
    const offers = getAcademyOffers(state, index);
    set({ state, index, academyOffers: offers, phase: 'academy' });
  },

  chooseAcademy(clubId) {
    const { state, index } = get();
    if (!state || !index) return;
    joinClub(state, index, clubId, { asAcademy: true });
    persist(state);
    set({ state: { ...state }, phase: 'playing', screen: 'hub', hasSave: true });
  },

  async loadSave() {
    const raw = await idbGet<string>(SAVE_KEY);
    if (!raw) return;
    const state = deserialize(raw);
    set({ state, index: indexPack(pack), phase: 'playing', screen: 'hub' });
  },

  async deleteSave() {
    await idbDel(SAVE_KEY);
    set({ state: null, hasSave: false, phase: 'menu' });
  },

  advance(weeks = 1) {
    const { state, index } = get();
    if (!state || !index || state.retired) return;
    set({ busy: true });

    let result: TickResult | null = null;
    for (let i = 0; i < weeks; i++) {
      result = advanceWeek(state, index);
      if (state.retired) break;
      // Stop the moment the world needs the player: a decision, a new season, or a
      // match he was actually involved in. A match he watched from outside the squad
      // is not worth interrupting the week for.
      if (result.stopped === 'match') {
        const line = state.lastMatch?.userLine;
        const notable = line?.played || (state.lastMatch?.importance && state.lastMatch.importance !== 'normal');
        if (notable) break;
        continue;
      }
      if (result.stopped !== 'week') break;
    }

    persist(state);
    set({
      state: { ...state },
      busy: false,
      lastTick: result?.stopped ?? null,
      screen: result?.stopped === 'match' && state.lastMatch?.userLine?.played ? 'match' : get().screen,
      // A match he played gets watched, not just read.
      liveMatchId:
        result?.stopped === 'match' && state.lastMatch?.userLine?.played ? state.lastMatch.id : null,
    });
  },

  decide(decisionId, optionId) {
    const { state } = get();
    if (!state) return;
    const rng = Rng.fromState(state.rngState);
    const result = resolveDecision(rng, state, decisionId, optionId, pack.events);
    state.rngState = rng.getState();
    persist(state);
    set({ state: { ...state }, result });
  },

  answerOffer(decisionId, offerId) {
    const { state, index } = get();
    if (!state || !index) return;
    const result = engineAnswerOffer(state, index, decisionId, offerId);
    persist(state);
    set({ state: { ...state }, result });
  },

  answerAgent(decisionId, agentId) {
    const { state } = get();
    if (!state) return;
    const result = engineAnswerAgent(state, decisionId, agentId);
    persist(state);
    set({ state: { ...state }, result });
  },

  runAction(id) {
    const { state } = get();
    if (!state) return;
    const result = doPlayerAction(state, id);
    persist(state);
    set({ state: { ...state }, result });
  },

  clearResult() {
    set({ result: null });
  },

  acceptOffer(offerId) {
    const { state, index } = get();
    if (!state || !index) return;
    const offer = state.transferOffers.find((o) => o.id === offerId);
    const club = offer ? state.world.clubs[offer.clubId] : undefined;
    engineAcceptOffer(state, index, offerId);
    persist(state);
    set({ state: { ...state }, toast: club ? club.name : null });
  },

  signAgent(agentId) {
    const { state } = get();
    if (!state) return;
    engineSignAgent(state, agentId);
    persist(state);
    set({ state: { ...state } });
  },

  updateTraining(plan) {
    const { state } = get();
    if (!state) return;
    engineSetTraining(state, plan);
    persist(state);
    set({ state: { ...state } });
  },

  retire() {
    const { state } = get();
    if (!state) return;
    engineRetire(state);
    persist(state);
    set({ state: { ...state }, screen: 'career' });
  },

  endLive() {
    set({ liveMatchId: null });
  },

  markInboxRead() {
    const { state } = get();
    if (!state) return;
    for (const message of state.inbox) message.read = true;
    persist(state);
    set({ state: { ...state } });
  },

  showToast(message) {
    set({ toast: message });
  },

  async save() {
    const { state } = get();
    if (state) await idbSet(SAVE_KEY, serialize(state));
  },
}));

export function getPack(): DataPack {
  return pack;
}

export function availableActions(state: CareerState) {
  return actionsAvailableNow(state);
}

// A handle on the store while developing, so a career can be driven from the console
// without clicking through twenty weeks. Stripped from production builds.
if (import.meta.env.DEV) {
  (window as unknown as { game: typeof useGame }).game = useGame;
}
