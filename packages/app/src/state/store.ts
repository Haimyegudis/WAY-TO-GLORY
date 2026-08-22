import { create } from 'zustand';
import {
  deleteSave as deleteSaveSlot,
  flushSaves,
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
  applyLiveInstruction as engineApplyLiveInstruction,
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
  type PendingDecision,
  answerContractRenewal,
  matchPreparation,
  setMatchPlan as engineSetMatchPlan,
  answerRetirement,
  answerTreatment,
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
  type MatchPreparation,
  type MatchPlanId,
  type TickResult,
  type TrainingPlan,
} from '@fc/engine';

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
  /** The conversation whose answer produced `result`; keeps impact in the same sheet. */
  resultDecision: PendingDecision | null;
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
  /** Open one particular match report, rather than whichever was played last. */
  openMatch: (matchId: string) => void;
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
  /** Carry out a task attached to an inbox message and open the screen where it lives. */
  applyInboxAction: (messageId: string) => void;
  retire: () => void;
  markInboxRead: () => void;
  /** The message being read, like opening one in a mail app. */
  openMessage: (id: string | null) => void;
  openMessageId: string | null;
  endLive: () => void;
  /** Answer the dressing room and play the second half out. */
  chooseHalfTime: (instructionId: HalfTimeInstructionId) => void;
  /** Change the player's job while the live clock is running. */
  applyLiveInstruction: (matchId: string, minute: number, instructionId: HalfTimeInstructionId) => boolean;
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
  /** A trophy or an award to stop everything for. */
  celebration: { kind: CelebrationKind; titleKey: string; args?: Record<string, string | number> } | null;
  clearCelebration: () => void;
  /** The week's homework: who they are, and the job he has decided to do about it. */
  preparation: () => MatchPreparation | null;
  setMatchPlan: (plan: MatchPlanId) => void;
}

let loadedPack: DataPack | null = null;
let packPromise: Promise<DataPack> | null = null;

async function loadPackData(): Promise<DataPack> {
  if (loadedPack) return loadedPack;
  packPromise ??= import('@fc/data/pack').then((module) => module.default as unknown as DataPack);
  loadedPack = await packPromise;
  return loadedPack;
}

export type CelebrationKind = 'trophy' | 'award';

/**
 * Something worth stopping the game for.
 *
 * A trophy and an individual honour are the only two things in a career that are pure
 * reward, and both of them used to arrive as a line of text between a sponsor offer and
 * a fixture announcement.
 */
function celebrationFor(
  state: CareerState,
  trophiesBefore: number,
  awardsBefore: number,
): { kind: CelebrationKind; titleKey: string; args?: Record<string, string | number> } | null {
  const awards = state.awards ?? [];
  if (awards.length > awardsBefore) {
    const won = awards[awards.length - 1]!;
    return { kind: 'award', titleKey: `award.${won.award}` };
  }
  if (state.trophies.length > trophiesBefore) {
    const won = state.trophies[state.trophies.length - 1]!;
    return {
      kind: 'trophy',
      titleKey: `celebrate.${won.kind}`,
      args: { competition: `competition.${won.competitionId}` },
    };
  }
  return null;
}

function requirePack(): DataPack {
  if (!loadedPack) throw new Error('Data pack requested before career setup');
  return loadedPack;
}

/**
 * A blocking decision is already the notification: showing its inbox headline again
 * after the player answers reverses the chronology ("agents are interested" after an
 * agent has signed). Keep the message in the inbox as history, but mark it read and
 * remove it from the transient popup queue when its decision is settled.
 */
function settleDecisionNews(state: CareerState, pendingNews: string[], decisionId: string): string[] {
  const settled = new Set(
    state.inbox.filter((message) => message.decisionId === decisionId).map((message) => message.id),
  );
  if (settled.size === 0) return pendingNews;
  for (const message of state.inbox) {
    if (settled.has(message.id)) message.read = true;
  }
  return pendingNews.filter((id) => !settled.has(id));
}

/**
 * Writes the career into its own slot, along with the summary the title screen lists.
 * Writes are queued per slot in saves.ts, so a slower old write can never overwrite a
 * newer action. Callers that are leaving the career can await the returned promise.
 */
function persistTo(id: string, state: CareerState, onSaved?: (saves: SaveSummary[]) => void): Promise<void> {
  const club = state.player.clubId ? state.world.clubs[state.player.clubId] : null;
  return writeSave(id, state, {
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
  celebration: null,
  academyOffers: [],
  hasSave: false,
  saves: [],
  activeSaveId: null,
  busy: false,
  toast: null,
  lastTick: null,
  result: null,
  resultDecision: null,
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
        const pack = await loadPackData();
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

  openMatch(matchId) {
    // A match opened from a list is read, not watched: the live playback belongs to the
    // whistle it was played on.
    set({ focusMatchId: matchId, liveMatchId: null, liveFromMinute: 0 });
    get().goto('match');
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

  async startCreation() {
    set({ busy: true });
    await loadPackData();
    set({ phase: 'create', busy: false });
  },

  cancelCreation() {
    set({ phase: 'menu' });
  },

  preparation() {
    const { state, index } = get();
    if (!state || !index) return null;
    return matchPreparation(state, index);
  },

  setMatchPlan(plan) {
    const { state, index } = get();
    if (!state || !index) return;
    if (!engineSetMatchPlan(state, index, plan)) return;
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
  },

  createPlayer(input) {
    const pack = requirePack();
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
    const pack = await loadPackData();
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
      await persistTo(activeSaveId, state, () => {});
      await flushSaves();
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
      resultDecision: null,
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

  clearCelebration() {
    set({ celebration: null });
  },

  advance(weeks = 1) {
    const { state, index } = get();
    if (!state || !index || state.retired) return;
    set({ busy: true });
    const before = new Set(state.inbox.map((message) => message.id));
    // What he had won before this week, so anything new can be celebrated properly.
    const trophiesBefore = state.trophies.length;
    const awardsBefore = (state.awards ?? []).length;

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
    const blockingDecisionIds = new Set(
      state.pendingDecisions.filter((decision) => decision.blocking).map((decision) => decision.id),
    );
    const arrived = state.inbox
      .filter((message) => !before.has(message.id))
      // The blocking sheet is already presenting this message now. Queueing the inbox
      // version would present the premise only after the player had answered it.
      .filter((message) => !message.decisionId || !blockingDecisionIds.has(message.decisionId))
      .slice(0, 4)
      .reverse()
      .map((message) => message.id);
    const atTheBreak = result?.stopped === 'halfTime';
    set({
      state: { ...state },
      busy: false,
      celebration: celebrationFor(state, trophiesBefore, awardsBefore) ?? get().celebration,
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

  applyLiveInstruction(matchId, minute, instructionId) {
    const { state } = get();
    if (!state) return false;
    const applied = engineApplyLiveInstruction(state, matchId, minute, instructionId);
    if (!applied) return false;
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state } });
    return true;
  },

  decide(decisionId, optionId) {
    const { state, index, pendingNews } = get();
    if (!state || !index) return;
    const answeredDecision = state.pendingDecisions.find((decision) => decision.id === decisionId) ?? null;
    const newsAfterDecision = () => settleDecisionNews(state, pendingNews, decisionId);

    // A question from the press is not a scripted event: the answer is a trade applied
    // straight to his attributes, and any claim in it is settled the next time he plays.
    if (decisionId.startsWith('milestone_')) {
      const mediaResult = engineAnswerMedia(state, index, decisionId, optionId);
      if (!mediaResult) return;
      const mediaSlot = get().activeSaveId;
      if (mediaSlot) persistTo(mediaSlot, state, (saves) => set({ saves }));
      // The question becomes its own impact phase. App keeps the same conversation
      // sheet mounted, so the exact numbers are visible without a second popup.
      set({
        state: { ...state },
        result: mediaResult,
        resultDecision: answeredDecision,
        openMessageId: null,
        pendingNews: newsAfterDecision(),
      });
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
        set({
          state: { ...state },
          result: goalResult,
          resultDecision: answeredDecision,
          openMessageId: null,
          pendingNews: newsAfterDecision(),
        });
        return;
      }
    }

    if (decisionId.startsWith('mentorPrompt_')) {
      const mentorResult = engineAnswerMentor(state, decisionId, optionId);
      const mentorSlot = get().activeSaveId;
      if (mentorSlot) persistTo(mentorSlot, state, (saves) => set({ saves }));
      set({
        state: { ...state },
        result: mentorResult,
        resultDecision: mentorResult ? answeredDecision : null,
        openMessageId: null,
        pendingNews: newsAfterDecision(),
      });
      return;
    }
    // The medical room.
    if (decisionId.startsWith('treatment_')) {
      const treatmentResult = answerTreatment(state, decisionId, optionId);
      if (treatmentResult) {
        const treatmentSlot = get().activeSaveId;
        if (treatmentSlot) persistTo(treatmentSlot, state, (saves) => set({ saves }));
        set({
          state: { ...state },
          result: treatmentResult,
          resultDecision: answeredDecision,
          openMessageId: null,
          pendingNews: newsAfterDecision(),
        });
        return;
      }
    }
    // His own contract, which the engine negotiates the same way it negotiates anybody
    // else's offer.
    if (decisionId.startsWith('renewal_')) {
      const renewalResult = answerContractRenewal(state, index, decisionId, optionId);
      if (renewalResult) {
        const renewalSlot = get().activeSaveId;
        if (renewalSlot) persistTo(renewalSlot, state, (saves) => set({ saves }));
        set({
          state: { ...state },
          result: renewalResult,
          resultDecision: answeredDecision,
          openMessageId: null,
          pendingNews: newsAfterDecision(),
        });
        return;
      }
    }
    // Hanging them up is his own decision and the engine owns it, the same as every
    // other answer he gives.
    const retirementResult = answerRetirement(state, decisionId, optionId);
    const rng = Rng.fromState(state.rngState);
    const result = retirementResult ?? resolveDecision(rng, state, decisionId, optionId, requirePack().events);
    state.rngState = rng.getState();
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({
      state: { ...state },
      result,
      resultDecision: result ? answeredDecision : null,
      openMessageId: null,
      pendingNews: newsAfterDecision(),
    });
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
    const { state, index, pendingNews } = get();
    if (!state || !index) return;
    const answeredDecision = state.pendingDecisions.find((decision) => decision.id === decisionId) ?? null;
    const result = engineAnswerOffer(state, index, decisionId, offerId);
    const remainingNews = settleDecisionNews(state, pendingNews, decisionId);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state }, result, resultDecision: result ? answeredDecision : null, pendingNews: remainingNews });
  },

  answerAgent(decisionId, agentId) {
    const { state, pendingNews } = get();
    if (!state) return;
    const answeredDecision = state.pendingDecisions.find((decision) => decision.id === decisionId) ?? null;
    const result = engineAnswerAgent(state, decisionId, agentId);
    const remainingNews = settleDecisionNews(state, pendingNews, decisionId);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state }, result, resultDecision: result ? answeredDecision : null, pendingNews: remainingNews });
  },

  runAction(id) {
    const { state } = get();
    if (!state) return;
    const result = doPlayerAction(state, id);
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));
    set({ state: { ...state }, result, resultDecision: null });
  },

  clearResult() {
    set({ result: null, resultDecision: null });
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

  applyInboxAction(messageId) {
    const { state, pendingNews, screen, trail } = get();
    if (!state) return;
    const message = state.inbox.find((entry) => entry.id === messageId);
    if (!message?.action) return;

    if (message.action.type === 'setTrainingFocus') {
      // The staff ask for work and a load. Applying the plan applies both, or the
      // player follows half of it and never earns the coaching that comes with it.
      const { focus, intensity } = message.action;
      engineSetTraining(state, { focus, ...(intensity ? { intensity } : {}) });
      state.flags[`campAppliedFocus:${state.world.season}`] = focus;
      if (intensity) state.flags[`campAppliedIntensity:${state.world.season}`] = intensity;
    }
    message.read = true;
    const slot = get().activeSaveId;
    if (slot) persistTo(slot, state, (saves) => set({ saves }));

    rememberScreen('train');
    set({
      state: { ...state },
      screen: 'train',
      trail: screen === 'train' ? trail : [...trail, screen].slice(-10),
      pendingNews: pendingNews.filter((id) => id !== messageId),
      openMessageId: null,
    });
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
    set({
      liveMatchId: null,
      liveFromMinute: 0,
      result: settled,
      resultDecision: null,
      ...(state ? { state: { ...state } } : {}),
    });
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
    // Anything the inbox has since dropped goes with it, so the queue can never stall
    // behind a message that no longer exists.
    const alive = state ? rest.filter((id) => state.inbox.some((entry) => entry.id === id)) : rest;
    set({ pendingNews: alive, ...(state ? { state: { ...state } } : {}) });
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
  return requirePack();
}

export function availableActions(state: CareerState) {
  return actionsAvailableNow(state);
}

// A handle on the store while developing, so a career can be driven from the console
// without clicking through twenty weeks. Stripped from production builds.
if (import.meta.env.DEV) {
  (window as unknown as { game: typeof useGame }).game = useGame;
}
