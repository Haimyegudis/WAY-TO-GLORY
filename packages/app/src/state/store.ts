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
  resumeHalfTime as engineResumeHalfTime,
  type HalfTimeFrequency,
  type HalfTimeInstructionId,
  askForTerms as engineAskForTerms,
  answerMedia as engineAnswerMedia,
  answerMentor as engineAnswerMentor,
  answerSeasonGoal as engineAnswerSeasonGoal,
  buyItem as engineBuyItem,
  declineSponsors as engineDeclineSponsors,
  signSponsor as engineSignSponsor,
  chooseMentor as engineChooseMentor,
  askMentor as engineAskMentor,
  takeMentorAdvice as engineTakeMentorAdvice,
  type MentorReply,
  type MentorTopic,
  type ContractAsk,
  type NegotiationOutcome,
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

/**
 * Where he was, kept outside the save itself.
 *
 * The careers live in IndexedDB, which is asynchronous; this is one string in
 * localStorage saying which of them was open and on what screen, so a reload can go
 * straight back there instead of to the title.
 */
const OPEN_SLOT_KEY = 'fc.openSlot.v1';
const OPEN_SCREEN_KEY = 'fc.openScreen.v1';

function rememberedSlot(): string | null {
  try {
    return window.localStorage.getItem(OPEN_SLOT_KEY);
  } catch {
    return null;
  }
}

function rememberSlot(id: string): void {
  try {
    window.localStorage.setItem(OPEN_SLOT_KEY, id);
  } catch {
    // A browser with storage switched off still plays; it just forgets where it was.
  }
}

function forgetSlot(): void {
  try {
    window.localStorage.removeItem(OPEN_SLOT_KEY);
    window.localStorage.removeItem(OPEN_SCREEN_KEY);
  } catch {
    // Nothing to do.
  }
}

function rememberedScreen(): Screen {
  try {
    const held = window.localStorage.getItem(OPEN_SCREEN_KEY);
    // A match in progress is not somewhere to come back to: the playback is gone, so he
    // returns to the hub and carries on from there.
    return held && held !== 'match' ? (held as Screen) : 'hub';
  } catch {
    return 'hub';
  }
}

function rememberScreen(screen: Screen): void {
  try {
    window.localStorage.setItem(OPEN_SCREEN_KEY, screen);
  } catch {
    // Nothing to do.
  }
}

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
  | 'social'
  | 'mentor'
  | 'life';
export type Phase = 'loading' | 'menu' | 'create' | 'academy' | 'playing';

interface GameStore {
  phase: Phase;
  screen: Screen;
  /** The screens he came through, so the back gesture is a step and not an exit. */
  trail: Screen[];
  /**
   * A screen with steps of its own - making a player, say - claims the back gesture
   * while it is open, and says whether it used it.
   */
  backHandler: (() => boolean) | null;
  /**
   * The player he described, kept after the career is rolled so that backing out of the
   * club offers returns him to the form with every answer still in it.
   */
  draft: CreateCareerInput | null;
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
   * The match the match screen is about: the one he was taken into, plays back, and
   * then reads the report of. A week can hold a youth match and a cup tie, and without
   * following one by id the screen followed whichever the engine wrote last - which is
   * how a boy watching his Sunday morning ended up in somebody else's cup tie at half
   * time.
   */
  focusMatchId: string | null;
  /**
   * Messages that arrived this week and have not been put in front of him yet. News is
   * news: it comes up rather than waiting in a list he has to remember to open.
   */
  pendingNews: string[];
  /**
   * The match id currently being watched minute by minute. Set when the week stops on
   * a match the player was involved in; cleared once he has seen it out or skipped.
   */
  liveMatchId: string | null;
  /**
   * Where the playback picks up. Nought for a match watched from the start, forty-five
   * for one resumed after a team talk - he does not sit through the first half twice.
   */
  liveFromMinute: number;

  boot: () => Promise<void>;
  /** Save, close this career and go back to the front screen. */
  leaveCareer: () => Promise<void>;
  goto: (screen: Screen) => void;
  /** One step back: the screen before this one, or his own screen. */
  back: () => void;
  setBackHandler: (handler: (() => boolean) | null) => void;
  startCreation: () => void;
  cancelCreation: () => void;
  createPlayer: (input: CreateCareerInput) => void;
  /** Back out of the club offers to the form that produced them, as he left it. */
  reopenCreation: () => void;
  chooseAcademy: (clubId: string) => void;
  loadSave: (id?: string) => Promise<void>;
  deleteSave: (id?: string) => Promise<void>;
  refreshSaves: () => Promise<void>;
  advance: (weeks?: number) => void;
  decide: (decisionId: string, optionId: string) => void;
  answerOffer: (decisionId: string, offerId: string | null) => void;
  /** Go back to a club for better terms. Returns what they said, or null if it is gone. */
  askForTerms: (offerId: string, ask: ContractAsk) => NegotiationOutcome | null;
  chooseMentor: (mentorId: string) => void;
  askMentor: (topic: MentorTopic) => MentorReply | null;
  takeMentorAdvice: (reply: MentorReply) => void;
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
  /** Answer the dressing room and play the second half out. */
  chooseHalfTime: (instructionId: HalfTimeInstructionId) => void;
  /** How often the dressing room stops his match. */
  setHalfTimeTalks: (frequency: HalfTimeFrequency) => void;
  /** Put his name on somebody's poster, or send them all away. */
  signSponsor: (offerId: string) => void;
  declineSponsors: () => void;
  /** Spend what football paid him on something outside it. */
  buyLifeItem: (itemId: string) => void;
  /** Read the one on screen and move to the next. */
  dismissNews: () => void;
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
  trail: [],
  backHandler: null,
  draft: null,
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
  focusMatchId: null,
  pendingNews: [],
  liveMatchId: null,
  liveFromMinute: 0,
  openMessageId: null,

  async boot() {
    await migrateLegacySave();
    const saves = await listSaves();

    // Reloading the page should not throw him back to the title screen. The last career
    // he had open is remembered, and the app comes back exactly where it was - which
    // matters most on a phone, where the browser reloads a tab whenever it feels like it.
    const last = rememberedSlot();
    if (last && saves.some((slot) => slot.id === last)) {
      const state = await readSave(last);
      if (state) {
        set({
          state,
          index: indexPack(pack),
          phase: 'playing',
          screen: rememberedScreen(),
          activeSaveId: last,
          saves,
          hasSave: true,
        });
        return;
      }
    }

    set({ saves, hasSave: saves.length > 0, phase: 'menu' });
  },

  async refreshSaves() {
    const saves = await listSaves();
    set({ saves, hasSave: saves.length > 0 });
  },

  goto(screen) {
    const from = get().screen;
    rememberScreen(screen);
    // Where he was is worth keeping, but not twenty of them, and not the same screen
    // twice in a row.
    set({ screen, trail: from === screen ? get().trail : [...get().trail, from].slice(-10) });
  },

  setBackHandler(handler) {
    set({ backHandler: handler });
  },

  back() {
    const { screen, trail } = get();
    const previous = trail[trail.length - 1];
    // Back off the last screen is not the way out of the game: it lands on his own
    // screen, and back from there does nothing at all.
    const target = previous ?? (screen === 'hub' ? null : 'hub');
    if (!target) return;
    rememberScreen(target);
    set({ screen: target, trail: previous ? trail.slice(0, -1) : [] });
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
    set({ state, index, academyOffers: offers, phase: 'academy', activeSaveId: newSaveId(), draft: input });
  },

  reopenCreation() {
    // Nothing has been written to a slot yet - that happens when he picks a club - so
    // the career rolled for these offers is simply thrown away and described again.
    set({ phase: 'create', state: null, academyOffers: [], activeSaveId: null });
  },

  chooseAcademy(clubId) {
    const { state, index, activeSaveId } = get();
    if (!state || !index) return;
    joinClub(state, index, clubId, { asAcademy: true });
    const id = activeSaveId ?? newSaveId();
    persistTo(id, state, (saves) => set({ saves }));
    rememberSlot(id);
    rememberScreen('hub');
    set({ state: { ...state }, phase: 'playing', screen: 'hub', hasSave: true, activeSaveId: id });
  },

  async loadSave(id) {
    const saves = await listSaves();
    const target = id ?? saves[0]?.id;
    if (!target) return;
    const state = await readSave(target);
    if (!state) return;
    rememberSlot(target);
    rememberScreen('hub');
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

  /**
   * Putting this career down and going back to the front. It is saved on the way out -
   * nobody should have to think about whether they saved before leaving - and the slot
   * is forgotten so the next reload opens the menu rather than dropping him back in.
   */
  async leaveCareer() {
    const { state, activeSaveId } = get();
    if (state && activeSaveId) {
      persistTo(activeSaveId, state, () => {});
    }
    forgetSlot();
    const saves = await listSaves();
    set({
      state: null,
      index: null,
      activeSaveId: null,
      phase: 'menu',
      screen: 'hub',
      result: null,
      lastTick: null,
      liveMatchId: null,
      openMessageId: null,
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
    if (wasActive) forgetSlot();
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
    const before = new Set(state.inbox.map((message) => message.id));

    let result: TickResult | null = null;
    for (let i = 0; i < weeks; i++) {
      result = advanceWeek(state, index);
      if (state.retired) break;
      // Every match his club plays stops the clock, whether he was in it or not:
      // watching from the bench is still his Saturday.
      if (result.stopped === 'match') break;
      // Half time is the other reason a week stops mid-air: he is standing in a dressing
      // room being told something, and nothing else happens until he answers.
      if (result.stopped === 'halfTime') break;
      if (result.stopped !== 'week') break;
    }

    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    // Anything that landed this week, oldest first, so it reads in the order it happened.
    // Four is the cap: a week that generates more than that is a week, not an inbox.
    const arrived = state.inbox
      .filter((message) => !before.has(message.id))
      .slice(0, 4)
      .reverse()
      .map((message) => message.id);
    const atTheBreak = result?.stopped === 'halfTime';
    set({
      state: { ...state },
      busy: false,
      lastTick: result?.stopped ?? null,
      // A match always opens the match screen, from any tab.
      screen: result?.stopped === 'match' || atTheBreak ? 'match' : get().screen,
      focusMatchId: result?.stopped === 'match' ? state.lastMatch?.id ?? null : get().focusMatchId,
      pendingNews: [...get().pendingNews, ...arrived],
      // A match he played gets watched minute by minute; one he sat out is just read.
      liveMatchId:
        result?.stopped === 'match' && state.lastMatch?.userLine?.played ? state.lastMatch.id : null,
      liveFromMinute: 0,
    });
  },

  chooseHalfTime(instructionId) {
    const { state, index } = get();
    if (!state || !index || !state.pendingHalfTime) return;
    set({ busy: true });

    // Which match he is standing in the dressing room of, before the week is walked
    // again: the second half he comes out for has to be that match's, not the cup tie
    // the same week happens to hold.
    const answeredId = state.pendingHalfTime?.matchId ?? null;
    const result = engineResumeHalfTime(state, index, instructionId);
    const played = answeredId ? state.matchLog.find((match) => match.id === answeredId) ?? null : null;
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({
      state: { ...state },
      busy: false,
      lastTick: result.stopped,
      screen: 'match',
      focusMatchId: played?.id ?? state.lastMatch?.id ?? null,
      liveMatchId: played?.userLine?.played ? played.id : null,
      // He has already watched the first half; the playback picks up at the whistle.
      liveFromMinute: 45,
    });
  },

  decide(decisionId, optionId) {
    const { state, index } = get();
    if (!state || !index) return;

    // A question from the press is not a scripted event: the answer is a trade applied
    // straight to his attributes, and any claim in it is settled the next time he plays.
    if (decisionId.startsWith('milestone_')) {
      const mediaResult = engineAnswerMedia(state, index, decisionId, optionId);
      const mediaSlot = get().activeSaveId;
      if (mediaSlot) persistTo(mediaSlot, state, (saves) => set({ saves }));
      // Answering closes the message it arrived in, whichever sheet he answered from:
      // what changed is the next thing he should be looking at, not the question again.
      set({ state: { ...state }, result: mediaResult, openMessageId: null });
      return;
    }
    // The old player asking him something is not a scripted event either: it moves the
    // relationship and a little of who he is, and it hands back what it moved.
    // The summer conversation with the manager sets the season's target rather than
    // running an event's effects, so it is answered by the engine that owns it.
    if (decisionId.startsWith('seasonGoal_')) {
      const goalResult = engineAnswerSeasonGoal(state, index, decisionId, optionId);
      if (goalResult) {
        const slot = get().activeSaveId;
        if (slot) persistTo(slot, state, (saves) => set({ saves }));
        set({ state: { ...state } });
        return;
      }
    }

    if (decisionId.startsWith('mentorPrompt_')) {
      const mentorResult = engineAnswerMentor(state, decisionId, optionId);
      const mentorSlot = get().activeSaveId;
      if (mentorSlot) persistTo(mentorSlot, state, (saves) => set({ saves }));
      set({ state: { ...state }, result: mentorResult, openMessageId: null });
      return;
    }
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
    set({ state: { ...state }, result, openMessageId: null });
  },

  chooseMentor(mentorId) {
    const { state } = get();
    if (!state) return;
    engineChooseMentor(state, mentorId);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
  },

  askMentor(topic) {
    const { state } = get();
    if (!state) return null;
    const reply = engineAskMentor(state, topic);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
    return reply;
  },

  takeMentorAdvice(reply) {
    const { state } = get();
    if (!state) return;
    engineTakeMentorAdvice(state, reply);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
  },

  askForTerms(offerId, ask) {
    const { state, index } = get();
    if (!state || !index) return null;
    const outcome = engineAskForTerms(state, index, offerId, ask);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
    return outcome;
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

  setHalfTimeTalks(frequency) {
    const { state } = get();
    if (!state) return;
    state.flags['halfTimeTalks'] = frequency;
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
  },

  endLive() {
    // Anything the match itself settled - a promise made in front of a camera, say -
    // is shown once the whistle has gone rather than on top of the football.
    const { state } = get();
    const settled = state?.lastResult ?? null;
    if (state) state.lastResult = null;
    set({ liveMatchId: null, liveFromMinute: 0, result: settled, ...(state ? { state: { ...state } } : {}) });
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

  signSponsor(offerId) {
    const { state } = get();
    if (!state) return;
    engineSignSponsor(state, offerId);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
  },

  declineSponsors() {
    const { state } = get();
    if (!state) return;
    engineDeclineSponsors(state);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
  },

  buyLifeItem(itemId) {
    const { state } = get();
    if (!state) return;
    const bought = engineBuyItem(state, itemId);
    if (!bought) return;
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
  },

  dismissNews() {
    const { state, pendingNews } = get();
    const [first, ...rest] = pendingNews;
    if (state && first) {
      const message = state.inbox.find((entry) => entry.id === first);
      if (message) message.read = true;
    }
    set({ pendingNews: rest, ...(state ? { state: { ...state } } : {}) });
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
