# Youth Leagues, Half-Time Instructions and Live Media — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make press answers visibly change the career, let the player be given instructions at half time, and turn the youth league into a real competition that feeds the first team and the youth national sides.

**Architecture:** Four independent-ish slices layered on the existing engine. Media becomes a normal `DecisionResult` producer. Half time works by simulating a match twice from one fixed seed — the instruction only enters after minute 45, so the first half is byte-identical across both runs; the pause is raised as a thrown sentinel out of `playUserMatch`, which is the first step of `advanceWeek` and mutates nothing before the simulation call. The youth league grows from a single shadow table into `YouthWorld`: a division per senior tier with its own promotion and relegation, generated squads for the division the player is actually in, and its own scorers and awards.

**Tech Stack:** TypeScript ESM monorepo. `@fc/engine` (pure, deterministic, `node --test`), `@fc/data` (build-time data pack), `@fc/app` (React + Zustand + Vite).

## Global Constraints

- Every string the user can see exists in **both** `packages/app/src/i18n/he.ts` and `en.ts`. Hebrew is the primary language.
- The engine is deterministic: no `Date.now()`, no `Math.random()`. All randomness goes through `Rng`.
- `CareerState` must stay JSON-serialisable. No class instances, no `Map`, no `Set` in saved state.
- `SCHEMA_VERSION` goes from 1 to 2, with a migration registered in `MIGRATIONS[1]`.
- Senior football minimum age is **16**. Ages 16-17 need a first-team call-up, ability within 6 OVR of the club's level, potential ≥ 80 and `managerTrust ≥ 55`, and are capped at a late substitute appearance of ≤ 30 minutes. From 18 there is no restriction.
- Youth ages are **14 to 19**. A player leaves the youth system at the end of the season in which he turns 19.
- Youth promotion and relegation are **2 up, 2 down**, computed from the youth table alone and applied only to `YouthWorld.membership`.
- Tests run with `npm test` (which is vitest inside `packages/engine`).
- Commit after every task.

## File Structure

**Created**
- `packages/engine/src/halftime.ts` — half-time instruction definitions and their effect on the second half.
- `packages/engine/src/youth-squads.ts` — generating, ageing and retiring youth players.
- `packages/engine/src/youth-awards.ts` — youth champions, top scorer, player of the season, talent of the season.
- `packages/app/src/screens/HalfTimeSheet.tsx` — the half-time dialog.
- `packages/app/src/screens/YouthScreen.tsx` — youth table, scorers and squad.

**Modified**
- `packages/engine/src/milestones.ts` — answers return `DecisionResult`; twelve new questions; grudges.
- `packages/engine/src/match.ts` — second-half instruction modifiers, half-time cut.
- `packages/engine/src/career.ts` — media triggers, half-time pause/resume, youth week, youth season end, age gate wiring.
- `packages/engine/src/youth.ts` — `YouthWorld`, divisions per tier, independent promotion/relegation.
- `packages/engine/src/types.ts` — `YouthWorld`, `PendingHalfTime`, `'halfTime'` stop reason, `NationalTeamState.youthCaps`.
- `packages/engine/src/selection.ts` — `eligibleForSenior`.
- `packages/engine/src/generate.ts` — senior squad age floor, youth player generation options.
- `packages/engine/src/national.ts` — youth performance feeds u17/u19 interest.
- `packages/engine/src/awards.ts` — youth award ids.
- `packages/engine/src/save.ts` — schema 2 migration, youth compaction.
- `packages/app/src/state/store.ts` — media results, half-time resume.
- `packages/app/src/components/LiveMatch.tsx` — pause at minute 45.
- `packages/app/src/screens/ClubScreen.tsx` — youth tab.
- `packages/app/src/screens/Hub.tsx` — youth card with table position.
- `packages/app/src/i18n/he.ts`, `en.ts` — all new copy.
- `packages/engine/test/engine.test.ts` — new tests.

---

## Part A — Live Media

### Task A1: Press answers produce a visible result

**Files:**
- Modify: `packages/engine/src/milestones.ts`
- Modify: `packages/engine/src/career.ts` (`answerMedia`)
- Modify: `packages/app/src/state/store.ts:363-375`
- Test: `packages/engine/test/engine.test.ts`

**Interfaces:**
- Produces: `applyMilestoneAnswer(state: CareerState, answer: MilestoneAnswer): DecisionResult`, `answerMedia(state: CareerState, decisionId: string, optionId: string): DecisionResult | null`, `settleClaim(rng: Rng, state: CareerState, rating: number): DecisionResult | null`.

- [ ] **Step 1: Write the failing test**

```js
test('answering the press returns the changes it made', () => {
  const state = newTestCareer();
  raiseTestMilestone(state, 'debut');
  const decision = state.pendingDecisions.at(-1);
  const result = answerMedia(state, decision.id, decision.options[0].id);
  assert.ok(result, 'an answer must return a result');
  assert.ok(result.changes.length > 0, 'an answer must show what it changed');
  for (const change of result.changes) {
    assert.notStrictEqual(change.before, change.after);
    assert.ok(['good', 'bad', 'neutral'].includes(change.tone));
  }
});
```

- [ ] **Step 2: Run it and watch it fail** — `npm test`. Expected: `answerMedia` returns `true`, so `result.changes` is undefined.

- [ ] **Step 3: Implement**

`applyMilestoneAnswer` collects an `AppliedChange` for every attribute, personality trait, relationship, morale, fame and reputation it moves. Label keys follow the existing convention: `change.attr.<key>`, `change.personality.<key>`, `change.relationship.<key>`, `change.morale`, `change.fame`, `change.reputation`. Tone is `good` when the delta helps the player and `bad` when it costs him. When the answer carries `backsItUp`, set `narrativeKey` to `milestone.claimMade`.

`answerMedia` returns that `DecisionResult` instead of `true`, and `null` where it returned `false`.

`settleClaim` returns a `DecisionResult` whose `narrativeKey` is `milestone.claimKept` or `milestone.claimBroken`, with the attribute, morale, media and fans movements as changes.

- [ ] **Step 4: Wire the app** — in `store.ts` the milestone branch stores the returned result: `set({ state: { ...state }, result })`. Find the `settleClaim` call site in `career.ts` and stash its result in `state.lastResult` so it surfaces after the match.

- [ ] **Step 5: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "fix: press answers show what they changed"
```

### Task A2: Twelve new questions and sharper answers

**Files:**
- Modify: `packages/engine/src/milestones.ts`
- Modify: `packages/app/src/i18n/he.ts`, `packages/app/src/i18n/en.ts`

- [ ] **Step 1: Extend `MilestoneId`** with `hatTrick`, `sentOff`, `dropped`, `goalDrought`, `badRun`, `punditCriticism`, `rivalDig`, `injuryReturn`, `nationalCallUp`, `youthBreakout`, `relegationFight`, `contractStandoff`.

- [ ] **Step 2: Write the answers.** Each question gets 3-4 answers. Every question must contain at least one answer with `backsItUp`, at least one that costs a relationship (`manager`, `teammates`, `fans` or `board` going down), and at least one quiet answer that risks nothing and gains no fame. No answer may move every number in the same direction.

- [ ] **Step 3: Write the copy** in `he.ts` and `en.ts`: `milestone.<id>` for the question and `milestone.<id>.<answerId>` for each answer. Hebrew is written as the player would speak, not as a club spokesman.

- [ ] **Step 4: Write the failing test**

```js
test('every press answer is a trade, not a bonus', () => {
  for (const question of MILESTONES) {
    assert.ok(question.answers.length >= 3, `${question.id} needs at least three answers`);
    assert.ok(question.answers.some((a) => a.backsItUp), `${question.id} needs a public claim`);
    for (const answer of question.answers) {
      const deltas = [
        ...Object.values(answer.attributes ?? {}),
        ...Object.values(answer.personality ?? {}),
        ...Object.values(answer.relationships ?? {}),
        answer.morale ?? 0, answer.fame ?? 0, answer.reputation ?? 0,
      ].filter((d) => d !== 0);
      assert.ok(deltas.some((d) => d < 0), `${question.id}.${answer.id} costs nothing`);
    }
  }
});
```

- [ ] **Step 5: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: twelve more moments in front of a microphone"
```

### Task A3: The press turns up when something happened

**Files:**
- Modify: `packages/engine/src/career.ts` (`askTheMedia`, `raiseMilestone`)
- Modify: `packages/engine/src/milestones.ts` (`milestoneFor`)

- [ ] **Step 1: Add `mediaMomentFor(state): MilestoneId | null`** in `career.ts`, reading the season's match log and state: a hat-trick or sending-off in the last match; three straight starts followed by a benching; five matches without a goal or assist for an attacking player; four straight ratings below 6.3; a return from an injury of `serious` or worse; a first call-up at any level; the club in the bottom three after week 26; a contract with under a season left and `flags['contractStandoff']`.

- [ ] **Step 2: Route both sources through one cooldown.** `askTheMedia` first tries `milestoneFor(importance, ...)`, then `mediaMomentFor(state)`. `raiseMilestone` refuses if `state.flags['lastMediaWeek']` is within 4 weeks, and stamps it when it raises one. Remove the `if (state.flags['claimAttribute']) return;` guard at the top of `askTheMedia`.

- [ ] **Step 3: Write the failing test**

```js
test('the press does not turn up twice in a fortnight', () => {
  const state = newTestCareer();
  raiseTestMilestone(state, 'debut');
  const first = state.pendingDecisions.length;
  state.world.week += 2;
  raiseTestMilestone(state, 'derby');
  assert.strictEqual(state.pendingDecisions.length, first, 'a second microphone came too soon');
});
```

- [ ] **Step 4: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: the press turns up when something actually happened"
```

### Task A4: Open accounts

**Files:**
- Modify: `packages/engine/src/milestones.ts`
- Modify: `packages/engine/src/career.ts` (`matchImportanceFor`, `mentalFactor`, `applyMatchToPlayer`)

- [ ] **Step 1: Add `grudge?: { against: 'nextOpponent' | 'oldClub' | 'rival' }`** to `MilestoneAnswer`. When applied, resolve it to a club id and write `flags['grudgeClubId']` and `flags['grudgeUntilWeek']` (absolute week, twenty weeks out).

- [ ] **Step 2: Make it bite.** `matchImportanceFor` returns `'rival'` when either club is the grudge club. `mentalFactor` subtracts when he is away at the grudge club. After a match against the grudge club, a rating of 7.0 or better adds reputation, fame and fan standing at double the normal rate; below 6.3 takes the same amount away. Clear the flags either way.

- [ ] **Step 3: Write the failing test**

```js
test('a grudge makes the next meeting a rival fixture and then clears', () => {
  const state = newTestCareer();
  state.flags['grudgeClubId'] = someOpponentId(state);
  state.flags['grudgeUntilWeek'] = state.world.season * 52 + state.world.week + 20;
  assert.strictEqual(
    matchImportanceFor(state, index, compId, state.player.clubId, state.flags['grudgeClubId']),
    'rival',
  );
});
```

- [ ] **Step 4: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: what you say in public follows you to the fixture"
```

---

## Part B — Half-Time Instructions

### Task B1: The instructions themselves

**Files:**
- Create: `packages/engine/src/halftime.ts`
- Modify: `packages/engine/src/index.ts`
- Modify: `packages/app/src/i18n/he.ts`, `en.ts`

**Interfaces:**
- Produces:

```ts
export type HalfTimeInstructionId =
  | 'pushForward' | 'holdShape' | 'createForOthers' | 'takeThemOn' | 'saveLegs' | 'chaseEverything';

export interface HalfTimeEffect {
  involvement: number;      // multiplier on the user's share of chances
  shooting: number;         // multiplier on shot-versus-pass bias
  creating: number;         // multiplier on assist involvement
  defending: number;        // multiplier on tackles and blocks
  fatigue: number;          // multiplier on second-half fatigue
  cardRisk: number;
  injuryRisk: number;
  variance: number;         // spread on the second-half rating
}

export const HALF_TIME_INSTRUCTIONS: Record<HalfTimeInstructionId, HalfTimeEffect>;

/** What the manager asks for, given the score and how the half went. */
export function managerDemand(
  rng: Rng, scoreDiff: number, userRating: number, group: PositionGroup,
): HalfTimeInstructionId;

/** True when the manager gives orders rather than leaving it to the player. */
export function managerDictates(managerTrust: number, role: SquadRole): boolean;
```

- [ ] **Step 1: Write the failing test**

```js
test('every half-time instruction gives something up', () => {
  for (const [id, effect] of Object.entries(HALF_TIME_INSTRUCTIONS)) {
    const values = Object.values(effect);
    assert.ok(values.some((v) => v > 1), `${id} gains nothing`);
    assert.ok(values.some((v) => v < 1), `${id} costs nothing`);
  }
});

test('a trusted key player is not given orders', () => {
  assert.strictEqual(managerDictates(80, 'key'), false);
  assert.strictEqual(managerDictates(40, 'key'), true);
  assert.strictEqual(managerDictates(80, 'bench'), true);
});
```

- [ ] **Step 2: Run it** — `npm test`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `halftime.ts` per the interfaces. `managerDictates` returns true when `managerTrust < 55` or the role is one of `academy`, `futureProspect`, `prospect`, `fringe`, `bench`. `managerDemand` asks a losing side to push forward, a winning side to hold shape, and a player who has had a poor half to chase everything, with `rng` breaking ties.

- [ ] **Step 4: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: half-time instructions and what each one costs"
```

### Task B2: A match that can be cut at half time

**Files:**
- Modify: `packages/engine/src/match.ts`
- Test: `packages/engine/test/engine.test.ts`

**Interfaces:**
- Consumes: `HalfTimeInstructionId`, `HALF_TIME_INSTRUCTIONS` from Task B1.
- Produces: `UserMatchContext` gains `instruction?: HalfTimeInstructionId | null` and `stopAtHalfTime?: boolean`; `UserMatchOutcome` gains `halfTimeScore: [number, number]`.

- [ ] **Step 1: Write the failing test — this is the load-bearing one**

```js
test('the first half is identical whatever is said at half time', () => {
  const ctx = buildTestMatchContext();
  const cut = simulateUserMatch(new Rng(4242), { ...ctx, stopAtHalfTime: true });
  for (const instruction of Object.keys(HALF_TIME_INSTRUCTIONS)) {
    const full = simulateUserMatch(new Rng(4242), { ...ctx, instruction });
    const firstHalf = full.events.filter((e) => e.minute <= 45);
    assert.deepStrictEqual(
      firstHalf.map((e) => [e.minute, e.type, e.playerId]),
      cut.events.map((e) => [e.minute, e.type, e.playerId]),
      `${instruction} changed the first half`,
    );
    assert.deepStrictEqual(full.halfTimeScore, cut.halfTimeScore);
  }
});
```

- [ ] **Step 2: Run it** — `npm test`. Expected: FAIL, `stopAtHalfTime` is not honoured.

- [ ] **Step 3: Restructure the simulation.** Split the chance list by minute into a first-half list and a second-half list *before* any resolution, and resolve the first-half list completely before reading `ctx.instruction`. The two existing loops (user chances, opponent chances) become one helper called twice — once per half — so no RNG draw for the second half happens before the first half is finished. The instruction's multipliers apply only inside the second-half call. When `stopAtHalfTime` is set, return after the first half with the events so far and `halfTimeScore`.

- [ ] **Step 4: Fold the instruction into the rating.** The user's rating already comes from his events; add a small adjustment so obedience to a defensive instruction that produced a clean second half reads as a good half even without goals.

- [ ] **Step 5: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: a match can be stopped and resumed at half time"
```

### Task B3: Pausing the week

**Files:**
- Modify: `packages/engine/src/types.ts`
- Modify: `packages/engine/src/career.ts` (`playUserMatch`, `advanceWeek`)

**Interfaces:**
- Produces:

```ts
export interface PendingHalfTime {
  matchId: string;
  competitionId: string;
  homeClubId: string;
  awayClubId: string;
  importance: MatchImportance;
  youthOpponentRating?: number;
  matchSeed: number;
  lineup: Lineup;
  minutes: MinutesOutcome;
  firstHalfEvents: MatchEvent[];
  score: [number, number];
  demand: HalfTimeInstructionId | null;
  options: HalfTimeInstructionId[];
  chosen?: HalfTimeInstructionId;
  obeyed?: boolean;
}
```

`CareerState` gains `pendingHalfTime?: PendingHalfTime`. `TickResult['stopped']` gains `'halfTime'`. New export `resumeHalfTime(state: CareerState, index: PackIndex, instructionId: HalfTimeInstructionId): TickResult`.

- [ ] **Step 1: Write the failing test**

```js
test('a match the player is on the pitch for stops at half time and resumes', () => {
  const state = careerAtFirstFixture();
  const paused = advanceWeek(state, index);
  assert.strictEqual(paused.stopped, 'halfTime');
  assert.ok(paused.state.pendingHalfTime);
  assert.strictEqual(paused.state.lastMatch, null, 'nothing may be applied before the whistle');
  const seen = paused.state.pendingHalfTime.firstHalfEvents.map((e) => [e.minute, e.type]);

  const resumed = resumeHalfTime(paused.state, index, 'holdShape');
  assert.notStrictEqual(resumed.stopped, 'halfTime');
  assert.ok(resumed.state.lastMatch);
  assert.strictEqual(resumed.state.pendingHalfTime, undefined);
  assert.deepStrictEqual(
    resumed.state.lastMatch.events.filter((e) => e.minute <= 45).map((e) => [e.minute, e.type]),
    seen,
    'the half he watched changed under him',
  );
});
```

- [ ] **Step 2: Run it** — `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement the pause.** In `playUserMatch`, after building `lineup` and `minutes` and before the simulation:

  - If `state.pendingHalfTime?.matchId === matchId` and it has a `chosen` instruction, run the full simulation from `new Rng(pendingHalfTime.matchSeed)` with the stored `lineup`, `minutes` and `chosen` instruction, clear `state.pendingHalfTime`, and carry on exactly as today.
  - Otherwise, if the player is on the pitch at minute 45 (`minutes.played` and `(minutes.cameOnMinute ?? 0) <= 45` and `(minutes.offMinute ?? 90) > 45`), draw `matchSeed = rng.int(1, 2 ** 30)`, run the simulation with `stopAtHalfTime`, write `state.pendingHalfTime`, and `throw new HalfTimeInterrupt()`.
  - Otherwise simulate the whole match in one pass as today.

  `HalfTimeInterrupt` is a module-private class. Nothing in `playUserMatch` mutates state before this point, so the throw leaves the world untouched — the fixture is still unplayed, because callers set `fixture.played` after the call returns.

- [ ] **Step 4: Catch it.** `advanceWeek` wraps step 1 (`simulateWeekFixtures`) in a try/catch. On `HalfTimeInterrupt` it calls `commitRng(state, rng)` and returns `{ state, stopped: 'halfTime', log }` without advancing the clock. Because `announceBigMatch` is guarded by `flags['lastBigMatch']` and every fixture already played is flagged, re-entering the week is safe.

- [ ] **Step 5: Implement `resumeHalfTime`** — records `chosen`, records `obeyed` (true when there was no demand or the choice matched it), applies the manager-trust movement for obeying or refusing, then calls `advanceWeek(state, index)` and returns its result.

- [ ] **Step 6: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: the week stops at half time and picks up again"
```

### Task B4: The half-time screen

**Files:**
- Create: `packages/app/src/screens/HalfTimeSheet.tsx`
- Modify: `packages/app/src/state/store.ts`, `packages/app/src/App.tsx`, `packages/app/src/components/LiveMatch.tsx`
- Modify: `packages/app/src/i18n/he.ts`, `en.ts`

- [ ] **Step 1: Store.** `advance()` handles `stopped === 'halfTime'` by opening the match screen with the first-half events playing. Add `chooseHalfTime(instructionId)` which calls `resumeHalfTime`, persists, and sets the resulting state exactly as `advance()` does.

- [ ] **Step 2: LiveMatch.** When `state.pendingHalfTime` exists, play `firstHalfEvents` and stop on the whistle rather than running to 90.

- [ ] **Step 3: HalfTimeSheet.** Shows the score, the player's first half in one line, and either the manager's demand with obey-or-refuse, or the free list of instructions. Refusing opens the full list. Copy keys: `halfTime.title`, `halfTime.demand.<id>`, `halfTime.instruction.<id>`, `halfTime.instruction.<id>.hint`, `halfTime.obey`, `halfTime.refuse`, `halfTime.freeChoice`.

- [ ] **Step 4: Check it in the phone frame** — `npm run dev`, play to a match, confirm the sheet reads correctly in Hebrew and the scoreline stays LTR.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: half-time team talk on screen"
```

---

## Part C — A Real Youth League

### Task C1: Youth divisions per tier

**Files:**
- Modify: `packages/engine/src/youth.ts`, `packages/engine/src/types.ts`
- Modify: `packages/engine/src/career.ts` (`initYouth`)

**Interfaces:**
- Produces:

```ts
export interface YouthWorld {
  competitions: Record<string, CompetitionSeasonState>;
  membership: Record<string, string>;
  squads: Record<string, string[]>;
  players: Record<string, Player>;
  stats: Record<string, SeasonStats>;
  form: YouthForm;
}

export function youthCompetitionId(competitionId: string): string;      // `${id}.youth`
export function createYouthWorld(rng: Rng, state: CareerState, index: PackIndex): YouthWorld;
export function userYouthCompetition(state: CareerState): CompetitionSeasonState | null;
```

`WorldState.youth` becomes `YouthWorld | undefined`; the old single-table field moves to `WorldState.youthLegacy` for the migration to read.

- [ ] **Step 1: Write the failing test**

```js
test('every senior division in his country has a youth division', () => {
  const state = newTestCareer();
  const country = state.world.clubs[state.player.clubId].country;
  const tiers = index.pack.competitions.filter((c) => c.country === country && c.type === 'league');
  for (const tier of tiers) {
    assert.ok(state.world.youth.competitions[`${tier.id}.youth`], `${tier.id} has no youth league`);
  }
  for (const club of Object.values(state.world.clubs)) {
    if (club.country !== country) continue;
    assert.strictEqual(state.world.youth.membership[club.id], `${club.competitionId}.youth`);
  }
});
```

- [ ] **Step 2: Run it** — `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement** `createYouthWorld`: one `CompetitionSeasonState` per league competition in the player's country, fixtures from `buildFixtures(rng, clubIds, 2)`, membership seeded from each club's senior competition.

- [ ] **Step 4: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: a youth division for every tier"
```

### Task C2: Youth squads

**Files:**
- Create: `packages/engine/src/youth-squads.ts`
- Modify: `packages/engine/src/generate.ts`

**Interfaces:**
- Produces:

```ts
export const YOUTH_SQUAD_SIZE = 16;
export function generateYouthSquad(rng: Rng, index: PackIndex, club: Club, season: number): Player[];
export function stockYouthDivision(rng: Rng, state: CareerState, index: PackIndex, competitionId: string): void;
export function ageYouthWorld(rng: Rng, state: CareerState, index: PackIndex): Player[];  // returns the leavers
```

- [ ] **Step 1: Write the failing test**

```js
test('a youth squad is sixteen boys of the right age and level', () => {
  const squad = generateYouthSquad(new Rng(7), index, club, 2026);
  assert.strictEqual(squad.length, YOUTH_SQUAD_SIZE);
  for (const p of squad) {
    const age = 2026 - p.birthYear;
    assert.ok(age >= 14 && age <= 19, `age ${age} is not youth`);
    assert.ok(overall(p.attributes, p.primaryPos, p.secondaryPos) < clubBaseOvr(club),
      'a youth player must not be a senior');
  }
  assert.ok(squad.some((p) => p.primaryPos === 'GK'), 'no keeper');
});

test('nineteen year olds leave and a new intake arrives', () => {
  const state = careerWithYouthWorld();
  const before = Object.keys(state.world.youth.players).length;
  state.world.season += 1;
  const leavers = ageYouthWorld(new Rng(3), state, index);
  assert.ok(leavers.length > 0, 'nobody aged out');
  assert.strictEqual(Object.keys(state.world.youth.players).length, before,
    'the intake did not replace the leavers');
  for (const p of Object.values(state.world.youth.players)) {
    const age = state.world.season - p.birthYear;
    assert.ok(age >= 14 && age <= 19);
  }
});
```

- [ ] **Step 2: Run it** — `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement.** `generateYouthSquad` uses `generatePlayer` with `targetOvr` around `youthClubRating(club, age)` and `squadRole: 'academy'`, filling one keeper, five defenders, six midfielders and four forwards. `stockYouthDivision` fills every club in one youth competition and clears squads for clubs no longer in it. `ageYouthWorld` removes anyone turning 20, generates replacements at 15 or 16, and lets the rest drift with `developWeek`-scale gains.

- [ ] **Step 4: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: youth squads that age and turn over"
```

### Task C3: Youth matches against real boys

**Files:**
- Modify: `packages/engine/src/career.ts` (`simulateYouthWeek`, `playUserMatch`)

- [ ] **Step 1: Write the failing test**

```js
test('goals in a youth match belong to youth players', () => {
  const state = careerWithYouthWorld();
  playYouthWeek(state, index);
  const comp = userYouthCompetition(state);
  const scorerIds = Object.keys(comp.scorers);
  assert.ok(scorerIds.length > 0, 'nobody scored all season');
  for (const id of scorerIds) {
    assert.ok(state.world.youth.players[id] || id === state.player.id,
      `${id} is not a youth player`);
  }
});
```

- [ ] **Step 2: Run it** — `npm test`. Expected: FAIL, youth results come from `simulateQuickResult` with no players.

- [ ] **Step 3: Implement.** `playUserMatch` gains a `youth` flag: when set, `userClubSquad` and `opponentStars` come from `YouthWorld.squads`, and goals, assists and cards are attributed into the youth competition and `YouthWorld.stats`. Matches between two other clubs in the player's youth division still use `simulateQuickResult`, but their goals are spread across those clubs' real youth squads by `attackWeight`, so the scoring chart is complete. Other youth divisions stay abstract.

- [ ] **Step 4: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: youth matches are played against real boys"
```

### Task C4: Youth season end, promotion and honours

**Files:**
- Create: `packages/engine/src/youth-awards.ts`
- Modify: `packages/engine/src/career.ts` (`endSeason`), `packages/engine/src/awards.ts`

**Interfaces:**
- Produces:

```ts
export type YouthAwardId =
  | 'youthLeagueTopScorer' | 'youthPlayerOfSeason' | 'youthTalentOfSeason';

export function resolveYouthSeason(rng: Rng, state: CareerState, index: PackIndex): void;
```

- [ ] **Step 1: Write the failing test**

```js
test('youth promotion is decided by the youth table alone', () => {
  const state = careerWithYouthWorld();
  runFullSeason(state, index);
  const youth = state.world.youth;
  const moved = Object.entries(youth.membership)
    .filter(([clubId, compId]) => compId !== `${state.world.clubs[clubId].competitionId}.youth`);
  assert.ok(moved.length > 0, 'no club moved division in the youth pyramid');
});

test('the youth league crowns a top scorer and a player of the season', () => {
  const state = careerWithYouthWorld();
  runFullSeason(state, index);
  const awards = state.world.history.awards.filter((a) => a.award.startsWith('youth'));
  assert.ok(awards.some((a) => a.award === 'youthLeagueTopScorer'));
  assert.ok(awards.some((a) => a.award === 'youthPlayerOfSeason'));
});
```

- [ ] **Step 2: Run it** — `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement `resolveYouthSeason`**, called from `endSeason` before `applyPromotionRelegation`: settle each youth table with `resolveSeasonEnd`, record the champion in `history.champions`, exchange two clubs between adjacent youth divisions in `membership`, pick the three youth awards from `YouthWorld.stats` (top scorer by goals; player of the season by goals, assists and the club's finishing position; talent of the season restricted to under-17s), record them in `history.awards`, push inbox and news items, and unlock achievements when the player wins one. Then re-stock the player's youth division if his club changed division, and call `ageYouthWorld`.

- [ ] **Step 4: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: youth titles, promotion and individual honours"
```

### Task C5: The youth screen

**Files:**
- Create: `packages/app/src/screens/YouthScreen.tsx`
- Modify: `packages/app/src/screens/ClubScreen.tsx`, `packages/app/src/screens/Hub.tsx`
- Modify: `packages/app/src/i18n/he.ts`, `en.ts`

- [ ] **Step 1: Build the screen** — three tabs: table, scorers, squad. The player's own club is highlighted in the table and his own row in the scorers list. Reuse the table and scorer components from `ClubScreen`.

- [ ] **Step 2: Add the tab** to `ClubScreen`, shown only while `state.world.youth` has a division for his club.

- [ ] **Step 3: Upgrade the Hub card** — `hub.youthLine` gains his position in the scoring chart and the club's position in the table.

- [ ] **Step 4: Copy** — `youth.table`, `youth.scorers`, `youth.squad`, `youth.title`, `youth.position`, `award.youthLeagueTopScorer`, `award.youthPlayerOfSeason`, `award.youthTalentOfSeason`, plus inbox and news keys, in both languages.

- [ ] **Step 5: Check it in the phone frame** — `npm run dev`, start an academy career, confirm the youth table and scorers read correctly in Hebrew.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: the youth league has a screen"
```

### Task C6: Save migration and compaction

**Files:**
- Modify: `packages/engine/src/save.ts`, `packages/engine/src/career.ts` (`SCHEMA_VERSION`)

- [ ] **Step 1: Write the failing test**

```js
test('a schema 1 career loads with a youth world', () => {
  const old = JSON.stringify({
    schemaVersion: 1, gameVersion: '0.1.0', savedAt: '2026-01-01T00:00:00.000Z',
    state: schemaOneFixture(),
  });
  const state = deserialize(old);
  assert.strictEqual(state.schemaVersion, 2);
  assert.ok(state.world.youth.competitions, 'the youth world was not built');
  assert.ok(state.nationalTeam.youthCaps !== undefined);
});
```

- [ ] **Step 2: Run it** — `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement.** Bump `SCHEMA_VERSION` to 2. `MIGRATIONS[1]` moves the old `world.youth` table into `world.youthLegacy`, builds an empty `YouthWorld` (rebuilt properly on the next season boundary), and defaults `nationalTeam.youthCaps` and `youthGoals` to 0. Extend `compact()` to drop `YouthWorld.stats` for seasons already finished.

- [ ] **Step 4: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "fix: existing careers survive the youth rebuild"
```

---

## Part D — Synchronising the Engines

### Task D1: No fifteen year olds in the first team

**Files:**
- Modify: `packages/engine/src/selection.ts`, `packages/engine/src/generate.ts`, `packages/engine/src/career.ts`

**Interfaces:**
- Produces: `export function eligibleForSenior(player: Player, season: number, ctx: { calledUp: boolean; clubOvr: number; managerTrust: number }): { allowed: boolean; maxMinutes: number }`

- [ ] **Step 1: Write the failing test**

```js
test('nobody under sixteen is in a senior squad', () => {
  const state = newTestCareer();
  for (const squad of Object.values(state.world.squads)) {
    for (const id of squad) {
      const p = state.world.players[id];
      assert.ok(state.world.season - p.birthYear >= 16, `${p.lastName} is a child`);
    }
  }
});

test('a sixteen year old plays minutes, not matches', () => {
  const gate = eligibleForSenior(sixteenYearOld, 2026,
    { calledUp: true, clubOvr: 70, managerTrust: 70 });
  assert.strictEqual(gate.allowed, true);
  assert.ok(gate.maxMinutes <= 30);
  const child = eligibleForSenior(fifteenYearOld, 2026,
    { calledUp: true, clubOvr: 70, managerTrust: 90 });
  assert.strictEqual(child.allowed, false);
});
```

- [ ] **Step 2: Run it** — `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement.** `squadAge` in `generate.ts` never returns under 17 for a senior squad. `eligibleForSenior` enforces the constraint from the Global Constraints section. `pickBestLineup` filters ineligible players out of the pool; `resolveMinutes` caps the user at `gate.maxMinutes` and forces him to come off the bench.

- [ ] **Step 4: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "fix: a fifteen year old does not start for the champions"
```

### Task D2: The first team watches the youth table

**Files:**
- Modify: `packages/engine/src/youth.ts` (`deservesCallUp`, `readiness`), `packages/engine/src/career.ts`

- [ ] **Step 1: Write the failing test**

```js
test('leading the youth scoring chart gets you seen', () => {
  const leading = deservesCallUpChance({ scoringRank: 1, rating: 7.4, age: 17, ovr: 62, clubLevel: 70 });
  const anonymous = deservesCallUpChance({ scoringRank: 12, rating: 6.4, age: 17, ovr: 62, clubLevel: 70 });
  assert.ok(leading > anonymous * 2, 'the youth chart is not being read');
});
```

- [ ] **Step 2: Run it** — `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement.** `readiness` takes the player's rank in the youth scoring chart and his club's position in the youth table alongside the existing rating and ability terms. Split the probability out as `deservesCallUpChance` so it can be tested without an `Rng`.

- [ ] **Step 4: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: the youth scoring chart is how you get seen"
```

### Task D3: Youth form reaches the national youth sides

**Files:**
- Modify: `packages/engine/src/national.ts`, `packages/engine/src/types.ts`, `packages/engine/src/career.ts`

**Interfaces:**
- Produces: `CallUpContext` gains `youthMinutesPct: number`, `youthRating: number`, `youthGoals: number`. `NationalTeamState` gains `youthCaps: number` and `youthGoals: number`.

- [ ] **Step 1: Write the failing test**

```js
test('a sixteen year old tearing up the youth league gets an under-17 call', () => {
  const nt = { countryCode: null, eligibleCountries: ['ISR'], level: 'none', caps: 0, goals: 0,
    youthCaps: 0, youthGoals: 0, callUpHistory: [], capturedBySenior: false, interest: {} };
  updateNationalInterest({ player: goodSixteenYearOld, age: 16, season: 2026, minutesPct: 0,
    youthMinutesPct: 0.9, youthRating: 7.8, youthGoals: 18,
    clubReputation: 60, leagueReputation: 55, index, nt });
  assert.ok(nt.interest['ISR'] > 55, `interest was only ${nt.interest['ISR']}`);
});
```

- [ ] **Step 2: Run it** — `npm test`. Expected: FAIL, `minutesPct` of 0 keeps interest down.

- [ ] **Step 3: Implement.** For `u17` and `u19`, when senior minutes are under 0.1, `playingBonus` is computed from `youthMinutesPct` and `youthRating`, with a bonus for goals. Count youth appearances in `nt.youthCaps` and `nt.youthGoals` at the `simulateInternationalMatch` call site, and raise the `nationalCallUp` press moment on a first call at any level.

- [ ] **Step 4: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: a season in the youth league is seen by the national coaches"
```

### Task D4: Full pass

**Files:** whatever the pass turns up.

- [ ] **Step 1: Run everything** — `npm test`, then `npm run build`.
- [ ] **Step 2: Play it** — `npm run dev`. Start a fifteen-year-old academy career. Confirm: he plays only youth football; the youth table and scorers fill up; a press question arrives after something happens and shows what it changed; a half-time sheet appears in a match he is playing; a strong youth season produces a first-team call-up and an under-17 call; the season ends with youth honours and youth promotion.
- [ ] **Step 3: Fix what the pass turns up, then commit.**

```bash
git add -A && git commit -m "fix: issues found in the full-career pass"
```

---

## Self-Review

**Spec coverage:** Media visibility → A1. Spicier answers → A2. New triggers → A3. Grudges → A4. Half-time instructions and who gives them → B1, B3. Two-phase simulation → B2, B3. Half-time UI → B4. Youth divisions per tier with independent promotion → C1, C4. Youth squads and turnover → C2. Youth matches with real players → C3. Youth awards → C4. Youth screen and labels → C5. Migration and compaction → C6. Age gate → D1. Youth-to-seniors → D2. Youth-to-national → D3.

**Type consistency:** `YouthWorld` is defined once in C1 and consumed by C2-C6 and D2-D3. `HalfTimeInstructionId` is defined in B1 and consumed by B2-B4. `PendingHalfTime` is defined in B3 only. `eligibleForSenior` is defined in D1 and used in `selection.ts` and `career.ts`.
