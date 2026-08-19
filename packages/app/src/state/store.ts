import { create } from 'zustand';
import {
  deleteSave as deleteSaveSlot,
  listSaves,
  migrateLegacySave,
  newSaveId,
  readSave,
  writeSave,
  type SaveSummary,
} from './saves.js';
import {
  acceptOffer as engineAcceptOffer,
  actionsAvailableNow,
  advanceWeek,
  answerAgent as engineAnswerAgent,
  answerOffer as engineAnswerOffer,
  doPlayerAction,
  createCareer,
  currentOvr,
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
  /** Every career on this device, newest first. */
  saves: SaveSummary[];
  /** The slot being played into right now. */
  activeSaveId: string | null;
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
  loadSave: (id?: string) => Promise<void>;
  deleteSave: (id?: string) => Promise<void>;
  refreshSaves: () => Promise<void>;
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
  /** The message being read, like opening one in a mail app. */
  openMessage: (id: string | null) => void;
  openMessageId: string | null;
  endLive: () => void;
  showToast: (message: string | null) => void;
  save: () => Promise<void>;
}

const pack = packJson as unknown as DataPack;

/**
 * Writes the career into its own slot, along with the summary the title screen lists.
 * Fire and forget: a dropped write costs at most one week of play.
 */
function persistTo(id: string, state: CareerState, onSaved?: (saves: SaveSummary[]) => void): void {
  const club = state.player.clubId ? state.world.clubs[state.player.clubId] : null;
  void writeSave(id, state, {
    playerName: `${state.player.firstName} ${state.player.lastName}`,
    clubName: club?.name ?? '',
    season: state.world.season,
    week: state.world.week,
    age: state.world.season - state.player.birthYear,
    ovr: currentOvr(state),
    retired: Boolean(state.retired),
  }).then((saves) => onSaved?.(saves));
}

export const useGame = create<GameStore>((set, get) => ({
  phase: 'loading',
  screen: 'hub',
  state: null,
  index: null,
  academyOffers: [],
  hasSave: false,
  saves: [],
  activeSaveId: null,
  busy: false,
  toast: null,
  lastTick: null,
  result: null,
  liveMatchId: null,
  openMessageId: null,

  async boot() {
    await migrateLegacySave();
    const saves = await listSaves();
    set({ saves, hasSave: saves.length > 0, phase: 'menu' });
  },

  async refreshSaves() {
    const saves = await listSaves();
    set({ saves, hasSave: saves.length > 0 });
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
    // A new career takes a new slot, so it never writes over the last one.
    set({ state, index, academyOffers: offers, phase: 'academy', activeSaveId: newSaveId() });
  },

  chooseAcademy(clubId) {
    const { state, index, activeSaveId } = get();
    if (!state || !index) return;
    joinClub(state, index, clubId, { asAcademy: true });
    const id = activeSaveId ?? newSaveId();
    persistTo(id, state, (saves) => set({ saves }));
    set({ state: { ...state }, phase: 'playing', screen: 'hub', hasSave: true, activeSaveId: id });
  },

  async loadSave(id) {
    const saves = await listSaves();
    const target = id ?? saves[0]?.id;
    if (!target) return;
    const state = await readSave(target);
    if (!state) return;
    set({
      state,
      index: indexPack(pack),
      phase: 'playing',
      screen: 'hub',
      activeSaveId: target,
      saves,
      hasSave: saves.length > 0,
    });
  },

  async deleteSave(id) {
    const { activeSaveId } = get();
    const target = id ?? activeSaveId;
    if (!target) return;
    const saves = await deleteSaveSlot(target);
    const wasActive = target === activeSaveId;
    set({
      saves,
      hasSave: saves.length > 0,
      ...(wasActive ? { state: null, activeSaveId: null, phase: 'menu' as const } : {}),
    });
  },

  advance(weeks = 1) {
    const { state, index } = get();
    if (!state || !index || state.retired) return;
    set({ busy: true });

    let result: TickResult | null = null;
    for (let i = 0; i < weeks; i++) {
      result = advanceWeek(state, index);
      if (state.retired) break;
      // Every match his club plays stops the clock, whether he was in it or not:
      // watching from the bench is still his Saturday.
      if (result.stopped === 'match') break;
      if (result.stopped !== 'week') break;
    }

    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({
      state: { ...state },
      busy: false,
      lastTick: result?.stopped ?? null,
      // A match always opens the match screen, from any tab.
      screen: result?.stopped === 'match' ? 'match' : get().screen,
      // A match he played gets watched minute by minute; one he sat out is just read.
      liveMatchId:
        result?.stopped === 'match' && state.lastMatch?.userLine?.played ? state.lastMatch.id : null,
    });
  },

  decide(decisionId, optionId) {
    const { state } = get();
    if (!state) return;
    // Hanging them up is his own decision, so it is answered here rather than by the
    // event system, which only knows how to apply stat changes.
    const retiring = state.pendingDecisions.some(
      (decision) => decision.id === decisionId && decision.eventId === 'retirement_choice',
    );
    const rng = Rng.fromState(state.rngState);
    const result = resolveDecision(rng, state, decisionId, optionId, pack.events);
    state.rngState = rng.getState();
    if (retiring && optionId === 'retire') engineRetire(state);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state }, result });
  },

  answerOffer(decisionId, offerId) {
    const { state, index } = get();
    if (!state || !index) return;
    const result = engineAnswerOffer(state, index, decisionId, offerId);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state }, result });
  },

  answerAgent(decisionId, agentId) {
    const { state } = get();
    if (!state) return;
    const result = engineAnswerAgent(state, decisionId, agentId);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state }, result });
  },

  runAction(id) {
    const { state } = get();
    if (!state) return;
    const result = doPlayerAction(state, id);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
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
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state }, toast: club ? club.name : null });
  },

  signAgent(agentId) {
    const { state } = get();
    if (!state) return;
    engineSignAgent(state, agentId);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
  },

  updateTraining(plan) {
    const { state } = get();
    if (!state) return;
    engineSetTraining(state, plan);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
  },

  retire() {
    const { state } = get();
    if (!state) return;
    engineRetire(state);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state }, screen: 'career' });
  },

  endLive() {
    set({ liveMatchId: null });
  },

  openMessage(id) {
    const { state } = get();
    if (id && state) {
      // Opening it is reading it.
      const message = state.inbox.find((m) => m.id === id);
      if (message && !message.read) {
        message.read = true;
        const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
        set({ state: { ...state } });
      }
    }
    set({ openMessageId: id });
  },

  markInboxRead() {
    const { state } = get();
    if (!state) return;
    for (const message of state.inbox) message.read = true;
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
  },

  showToast(message) {
    set({ toast: message });
  },

  async save() {
    const { state } = get();
    const { activeSaveId } = get();
    if (!state || !activeSaveId) return;
    const club = state.player.clubId ? state.world.clubs[state.player.clubId] : null;
    const saves = await writeSave(activeSaveId, state, {
      playerName: `${state.player.firstName} ${state.player.lastName}`,
      clubName: club?.name ?? '',
      season: state.world.season,
      week: state.world.week,
      age: state.world.season - state.player.birthYear,
      ovr: currentOvr(state),
      retired: Boolean(state.retired),
    });
    set({ saves });
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
