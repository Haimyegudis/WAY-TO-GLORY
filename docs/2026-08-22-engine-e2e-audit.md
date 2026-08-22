# WAY TO GLORY — end-to-end engine audit

Date: 2026-08-22
Scope: the whole simulation, walked from character creation to retirement — every subsystem, what
it feeds, whether it is reachable, and what it is actually worth in numbers. Findings are measured,
not read off the source: three new probes under `packages/engine/test` produce every figure quoted
here and can be re-run.

    tsx test/coverage.probe.ts 10 30    # what fires and what never does, over full careers
    tsx test/stats.probe.ts 12 25       # injuries, availability, the OVR curve, grades, wages
    tsx test/levers.probe.ts 8 7        # what each player choice is worth, one lever at a time
    tsx test/audit.probe.ts 7 3         # the existing invariant checker (still passes clean)

Verified before anything else: `npx tsc --noEmit` clean, 158/158 engine tests pass, app builds,
`audit.probe` walks three twenty-season careers without tripping a single invariant.

---

## 1. The career, end to end

### 1.1 Creation and the first choice

`createCareer` builds the player (age 15, base 55 potential band), the world (every club in the
pack, leagues, national cups, league cups where the country plays one, the European competitions
seeded from club strength, and the youth pyramid), then `getAcademyOffers` returns five academies —
one per reputation band. That choice is real: it sets coaching (`club.training`), facilities
(`club.academy`), the level of the boys he trains against, and the division he plays Sunday
football in. Measured, it is worth **±3.5 OVR after seven seasons** (§3.3).

### 1.2 The week (`advanceWeek`, eleven steps)

| # | Step | What it does |
|---|---|---|
| 0a | Build-up | The week's biggest fixture is found across league, cup, Europe and the age group, announced, and the occasion question is asked *before* kickoff |
| 0a2/0a3 | Fixture dilemmas, watching-club verdicts | Blocking questions tied to a real fixture; a club that watched him answers either way |
| 0 | Expiry | Unanswered approaches and stories are dropped |
| 1 | Training | Aggravation roll, condition, camp-plan compliance (+1 trust/week), training injury roll |
| 2 | Fixtures | Youth, league, cup, Europe, camp friendlies. A match he is on the pitch for pauses at the interval (`HalfTimeInterrupt`) |
| 3 | Development | `applyMatchCondition` then `developWeek` — the week's OVR movement |
| 3b | Life | Sponsor income, upkeep, expiries, new sponsor approaches |
| 4 | Money | Wages minus agent commission, diet bill (drops a tier if unaffordable) |
| 5 | National team | Weekly interest update; call-ups and qualifiers on international weeks |
| 6 | Market | Window approaches, loan offers, free-agent calls |
| 7 | Agents, mentor, press | Agent shortlists, the mentor's own question, media milestones, post-match reactions |
| 8 | Career events | One story a week at 36%, capped at five blocking stories a season |
| 9 | Reaction | Morale drift → **form update** → relationship drift → consequences (dropped, listed, frozen out) |
| 10-11 | Value, clock | Market value recomputed, week advances, season rolls over at 52 |

### 1.3 The season rollover (`endSeason`)

Tables resolve → youth season settles (its own champions, promotion, three honours) → European
qualification decided → promotion/relegation applied as a strict exchange → coming-of-age at 18
(kept, or offers to leave) → summer tournament if his country qualified through a real campaign →
individual awards → season goal settled → career record written → potential drifts on performance
→ squad role recomputed → reputation/fame settle → abstract market moves every club in the world +
a real squad window at the modelled clubs → AI players age and develop → contract expiry
(extend/let expire/release) → achievements → side bets → new season → retirement check.

### 1.4 The shape of a life

Academy (15-17) → youth football and youth call-up (`deservesCallUp` on form, scoring rank, table
position, OVR vs club level) → first-team squad → senior debut → loans if he cannot get on the
pitch → peak (25-30 measured) → decline from 31 → retirement question from 31, forced at 41 or
after a year without a club → `careerLegacy` (spells, legend status, trophies, tournaments).

---

## 2. The effect map — what moves what

Every number below is from the source, not inferred.

### Development (`developWeek`)
```
weekly OVR gain = 0.185 × ageFactor × trainingF × playingF × proF × moraleF × fitnessF × levelF
                  × injuredPenalty × rng(0.75,1.3) × headroom
trainingF  = intensity(0.6 / 1.0 / 1.5 / 1.95) × diet(0.8 / 1.0 / 1.12 / 1.2)   [§7]
             × (0.3 + coach/150 + facilities/190)
playingF   = 0.22 + min(1, minutes% × 1.6) × 1.05      (0.6 out of season)
proF       = 0.7 + professionalism/170     moraleF = 0.82 + morale/550
fitnessF   = 0.7 + fitness/330             levelF  = 0.85 + leagueRep/400
injured    = ×0.25       ageFactor peaks 1.15 at 18, negative from 31 (GK +3 years)
```
Minutes are the dominant term, exactly as intended. An academy player is credited a flat 0.68.

### Form (`updateForm`, after this week's fix)
`target = 50 + (avg of last 5 competitive ratings within 6 weeks − 6.6) × 28`, moved
`0.25 + consistency×0.2` of the way each week. Idle weeks with nothing in the window drift 12%
toward 50.

### Selection (`selectionScore`) — the user is scored by the same formula as everyone else
`ratingAt(slot) + (form−50)×0.22 + (fitness−70)×0.18 + (trust−50)×0.30 + (fit−1)×14 +
reputation×0.08 + (morale−50)×0.04 + pressure bonus − fatigue×(0.18+rotation×0.2)`
Trust is the single biggest non-ability term (a 30-point trust swing ≈ 9 rating points).

### Match (`simulateUserMatch`)
Chances = `(userXg + oppXg) × 6.2`, conversion `0.104 × (0.5 + logistic((quality−resistance)/12) × 1.6)` [§7]
modified by score state, red cards, set-piece type, bench energy, half-time instruction.
Involvement by position group: ATT 0.44 / MID 0.30 / DEF 0.10 / GK 0.01, scaled by quality, form
and the `mental` multiplier (morale, sharpness, fans, dressing room, manager, pressure, fatigue —
clamped 0.72-1.2) × occasion × grudge.

### After the match (`applyMatchToPlayer`)
trust `+= ((rating−6.6)×2.2 + motm×2) × minuteWeight × 0.5 − red×6`; morale `+= (rating−6.4)×1.6`;
reputation `+= goals×0.35 + assists×0.2`; fame `+= goals×0.4`; appearance and goal bonuses paid;
cards and suspensions applied under the competition's own rules; public claims settled against the
rating; a defied half-time instruction settled at ≥7.2 or <6.4.

### Standing, value, wage
Reputation converges 35% a season toward `ovr×0.7×(0.7+leagueRep/180) + minutes×8 + caps×0.2`.
Value = `exp((ovr−40)/6.9)×30k` × age curve × potential bonus (≤24) × league × form × reputation ×
caps × contract length × injury history. Wage = `exp((ovr−42)/8.2)×420` × finances × league × age ×
reputation.

### Everything else that reaches the pitch
Mentors (bond, briefs to the agent, personality/attribute rub-off), the 25 player actions
(relationships, attributes, sharpness, fatigue, money), the life shop (morale, fame, fatigue,
upkeep), sponsors (weekly cash + fame), season goals (trust/morale/reputation at settlement),
national interest (weekly, from minutes, level, form, availability), agents (market reach and
commission), diet (growth, recovery, injury risk, morale), grudges (double-weighted fixture).

---

## 3. Measured behaviour

### 3.1 Content coverage — 10 careers, ~19 seasons each, every question answered

| Content | Reachable | Never fired |
|---|---|---|
| Career events | **142 / 144** | `own_goal`, `drop_down_league` |
| Media milestones | **19 / 21** | `goalDrought`, `rivalDig` |
| Mentor prompts | 10 / 10 | — |
| Player actions | 25 / 25 | — |
| Life shop items | 19 / 19 | — |
| Injury types | 9 / 9 | — |
| Half-time instructions | 10 / 10 | — |
| Sponsor kinds | 6 / 6 | — |
| Awards | 9 kinds incl. Ballon d'Or | — |
| Consequences | 9 distinct | — |
| Match importances | 12 / 12 | — |

Every custom flag written by a pack event has a consumer in `applyChoiceConsequence`, the transfer
market, the medical room, the contract code or the retirement summary. No orphan flags.

### 3.2 Career outcomes (12 careers, realistic transfer behaviour)

- OVR by age: 36.7 (15) → 54.0 (18) → 67.5 (21) → 74.4 (24) → **peak 76.9 at 29** → 75.4 (34) → 60 (37+)
- Injuries: **2.0 per season**, mean 5.6 weeks out, median 4, p90 12, worst 51
- Availability across club competitive matches: **played 57.5%, injured 24.2%, not selected 16.4%, suspended 2.0%**
- Goals per match: user's own matches **2.47**, the same leagues simulated for AI clubs **2.99**
- User ratings: mean 7.14, median 6.9, p90 8.8
- Wages: OVR 70 ≈ €8.4k/wk, OVR 80 ≈ €29k/wk, OVR 90 ≈ €147k/wk, OVR 95 ≈ €320k/wk
- Grades: **12 of 12 careers scored ≥76 → "worldClass" or better; 7 of 12 "goatCandidate"**
- Engine speed 1.18 ms/week; a compacted ten-season save is 2.0 MB (IndexedDB, fine)

### 3.3 What each choice is worth (same seeds, one lever changed, 7 seasons, mean of 8 careers)

| Lever | OVR | Δ | Apps | Injuries |
|---|---:|---:|---:|---:|
| baseline (normal / balanced / normal diet, mid academy) | 66.3 | — | 151 | 8.8 |
| intensity: light | 54.6 | **−11.7** | 151 | 5.5 |
| intensity: intensive | 66.8 | +0.5 | 134 | 15.0 |
| intensity: extreme | 66.5 | +0.2 | 102 | 20.4 |
| diet: poor | 57.0 | −9.3 | 105 | 10.0 |
| diet: professional | 71.5 | **+5.2** | 187 | 10.1 |
| diet: nutritionist | 70.3 | +4.0 | 185 | 9.1 |
| focus: physical | 70.1 | **+3.8** | 202 | 8.9 |
| focus: technical | 62.6 | **−3.7** | 148 | 10.1 |
| academy: strongest offer | 69.8 | +3.5 | 149 | 11.9 |
| academy: weakest offer | 63.3 | −3.0 | 135 | 9.1 |
| mentor: chosen, asked weekly | 66.9 | +0.6 | 164 | 9.8 |
| social: an action every week | 68.5 | +2.2 | 162 | 11.1 |
| everything on | 73.9 | +7.6 | 145 | 15.1 |

---

## 4. Findings

### P1 — balance defects (the game runs, the numbers are wrong)

1. **Injury load is roughly double real football.** 2.0 injuries and 11.2 weeks lost per season;
   he misses 24% of his club's competitive matches. Real benchmarks sit near 10-15% for a fit
   regular. Sources: training roll (0.6% base/week, ×3.6 at extreme) plus in-match roll
   (1.2-2%/match) plus aggravation. Either the per-week rates or the severity table
   (`metatarsal` is serious-or-major only, 9-26 weeks; `acl` is major-or-worse, 26-64) needs to come
   down.
2. **Two of the four training intensities are dominated.** Extreme buys +0.2 OVR for 12 extra
   injuries and 49 fewer appearances; intensive buys +0.5. The growth multiplier is real but is
   entirely eaten by lost minutes, so the only rational setting is `normal`.
3. **Nutritionist is strictly worse than professional** — 2.7× the cost, higher growth factor, and
   a *worse* result (+4.0 vs +5.2), because `DIET_MORALE` charges −0.85 morale a week against −0.3
   and morale feeds development and match ratings.
4. **`focus: physical` is the dominant strategy** (+3.8 vs −3.7 for technical, and +51 appearances)
   because physical work raises stamina and fitness, which raise minutes, which is the biggest term
   in development. Training focus is currently a right answer and six wrong ones.
5. **His matches score differently from everyone else's.** Chance-based user matches average 2.47
   goals; the Poisson path used for every other fixture in the same leagues averages 2.99. His
   club's goal difference and the scoring charts he is measured against come from two generators
   that disagree by 17%.
6. **Grade inflation.** `computeCareerScore` gave 12 of 12 careers ≥76 and 7 "goatCandidate",
   including one peaking at OVR 72. `peakOvr × 0.55` alone hands an ordinary pro 38 of the 52
   available points, and the apps/goals/trophy terms saturate. The status labels carry no
   information.
7. **The player is rarely left out on merit.** Only 16.4% of matches are missed through
   non-selection, against 24% through injury. There is no modelled rival for his shirt: the squad is
   generated, but the competition he loses to is a score, not a person, and he never sees it.
8. **Social actions are farmable.** An action every week is worth +2.2 OVR and +3.5M value over
   seven seasons, because several actions grant attribute points on cooldowns as short as 6-8 weeks.

### P2 — dead paths and missing copy

9. **`own_goal` is unreachable.** It is listed in `FIXTURE_BOUND_EVENTS` (so excluded from the
   random pool) but neither `raisePreMatchEvent` nor `raisePostMatchEvent` ever raises it. The event
   and its Hebrew and English copy exist and can never be seen. `career.ts:2423`
10. **`drop_down_league` never fired in 10 full careers** — it needs age 32-42 *and* under 30% of
    minutes, and a player in that state is usually transfer-listed or released first.
11. **`goalDrought` and `rivalDig` never fired.** `goalDrought` needs an attacker with five
    consecutive blanks; `rivalDig` needs a derby already asked about this season *and* another
    derby or rivalry next on the fixture list, inside the four-week press cooldown.
12. **279 of ~290 event outcome lines have no copy.** The pack has 308 event+option combinations;
    `en.ts` contains 10 `event.*.<option>.outcome` keys. `ResultSheet` guards on `hasTranslation`, so
    the failure is silent: after almost every story decision the result sheet shows a list of stat
    changes and no sentence saying what happened.
13. **`news.buildUp.vsFormerClub` and `news.buildUp.youth.vsFormerClub` are missing in both
    languages.** Unlike the outcome keys, this one is not guarded — `translate` falls back to the
    last dotted segment, so the news feed prints the literal token `vsFormerClub`. Introduced with
    the `vsFormerClub` importance in `0c73421`.
14. **19 exported symbols are defined and never referenced anywhere** (not by the engine, the app,
    or the tests): `agents.ts:agentMovePressure`, `agents.ts:agentCommission` (commission is
    recomputed inline in `career.ts`), `career.ts:advanceUntil`, `development.ts:playerAge`,
    `development.ts:positionalGroupOf`, `europe.ts:EURO_PRESTIGE`, `europe.ts:MATCHES_EACH`,
    `europe.ts:euroClubStrength`, `injury.ts:totalDaysOut`, `league.ts:tierStrengthBand`,
    `positions.ts:isGoalkeeper`, `positions.ts:FORMATION_NAMES`, `save.ts:isSameCareer`,
    `social.ts:syncManagerTrust`, `types.ts:SQUAD_ROLES`, `youth-awards.ts:youthDivisionLabel`,
    `youth-awards.ts:youthSeasonLine`, `youth-awards.ts:divisionMembers`, `youth.ts:YOUTH_MIN_AGE`.
    Note `agentMovePressure` in particular: the agent's greed-vs-career-planning pressure is
    generated, stored and never used, so a bad agent costs commission and nothing else.
15. **Retiring is resolved in the UI, not the engine.** `store.ts` calls `engineRetire` when the
    option id is `retire`; `resolveDecision` knows nothing about it. Any headless consumer (tests,
    probes, a cron run) can put the question and cannot answer it.

### P3 — simulations that are absent rather than broken

16. **There is no manager, only a number.** `manager_sacked` and `manager_new_arrival` exist as
    stories, but trust carries straight across the change (+7 at most). The oldest story in football
    — the new man does not fancy you — cannot happen.
17. **You never negotiate your own renewal.** `handleContractEnd` extends, lets expire or releases
    on `renewalIntent` and tells him afterwards. `askForTerms` exists only for another club's offer.
18. **No opposition preparation and no tactical layer.** Formation is `hashString(club.id)`,
    the XI is picked for him, and his only in-match agency is the half-time instruction and live
    instructions.
19. **Team-mates are one number.** No individual relationships, no captain as a person, no named
    rival for his position.
20. **AI careers are not persistent.** World stars come from the pack and are replaced by generated
    players on retirement; no other footballer has a career arc the player can follow.

---

## 5. Against the other games

| Axis | Football Manager (and FM Mobile) | EA FC Player Career | New Star Soccer | WAY TO GLORY |
|---|---|---|---|---|
| Role | Manager: squad, tactics, staff, board | Player, with 3D matches and archetype XP | Player, with a skill mini-game | Player, fully simulated |
| Decision density | Very high, mostly squad admin | Moderate: objectives and events | High, but mechanical | ~15 story decisions + ~10 press moments a season, plus training, actions, mentors, market |
| Match agency | Full tactical control | You play it | You play the moment | Half-time and live instructions only |
| Progression | Attribute drift, coach reports | Archetype XP, objectives | Skill points bought with cash | Attribute-level development with age, minutes, coach, facilities, diet, morale, potential drift |
| Off-pitch | Contracts, agents, press, dynamics | Agent, some events | Money, lifestyle, relationships | Sponsors, shop with real weekly effects, mentors, 25 relationship actions, life events |
| World simulation | Deep, whole-world, persistent AI careers | Shallow outside your club | None | Real: leagues, cups, Europe with qualifying, promotion/relegation, transfer market at two resolutions, national campaigns and tournaments, youth pyramid with its own honours |
| Feedback | Reports and graphs | Objective tracker | Immediate | Inbox, news, season goal, camp verdict, career page |

Where this game is genuinely ahead of the field: the **youth pyramid** (a real division with real
boys, its own cups, table, scoring charts and three honours) is deeper than any player-career mode
ships with; the **mentor** system has no equivalent anywhere; the **off-pitch economy** actually
touches fatigue, morale and fame every week rather than being a cosmetic wallet; and the whole
thing is deterministic, offline, Hebrew-first and 1.18 ms a week.

Where it lags, and it is the same gap in each case — **the player cannot see or fight the thing
that decides his career**: no named rival for the shirt, no manager with an opinion of his own, no
opponent to prepare for, no negotiation over his own contract, and a match he can only watch.

---

## 6. What to fix first

1. Injury rates and severity table (§4.1) — it is the single biggest distortion of a career.
2. `news.buildUp.vsFormerClub` — one missing key, visible as raw English in a Hebrew news feed.
3. Make intensity, diet and focus real trade-offs (§4.2-4.4): no dominated options.
4. One generator for goals (§4.5).
5. Rescale `computeCareerScore` so the labels mean something (§4.6).
6. Either raise `own_goal` after a match or delete it and its copy (§4.9).
7. Write the missing event outcome lines, or drop the mechanism (§4.12).
8. A manager entity with a tenure and an opinion, and trust that resets when he is sacked (§4.16) —
   the highest-value new simulation for this game, and the cheapest of the P3 items.

---

## 7. Fixed, same day

Everything in sections 4 and 6 was implemented and re-measured with the same probes. The
numbers below are the after, run on the same seeds as the before.

### Balance

| | Before | After |
|---|---|---|
| Injuries per season | 2.0 | 1.78 |
| Weeks out, mean / median | 5.6 / 4 | 4.7 / 3 |
| Weeks lost per season | 11.2 | 8.3 |
| Club matches missed injured | **24.2%** | **18.4%** |
| Club matches played | 57.5% | 62.1% |
| Goals per match, his matches vs everyone else's | 2.47 vs 2.99 | **2.68 vs 2.99** |
| Match ratings, p90 | 8.8 | 8.7 |
| Careers graded "world class" or better | **12 of 12** | **3 of 12** |

Training intensity is a ladder again — light −8.7 OVR, normal 0, intensive +2.8, extreme
+5.4 with 49 fewer appearances and five more injuries over seven seasons — where before
intensive bought +0.5 and extreme +0.2. The diet tiers now order properly: poor −9.8,
professional +5.2, nutritionist +5.3 with a full injury fewer per career for nearly three
times the money. Training focus is symmetric: physical and technical both sit within a
rating point of balanced, where physical used to win by seven and a half points and fifty
appearances, because conditioning is no longer something only the physical block does. An
action every week is worth about +3 OVR — real, and no longer the best lever in the game.

Career grades now spread across the whole scale: from 34 (a local hero) to 91 (a legend),
with nobody in twelve careers reaching "one of the greatest".

### Dead paths

- `own_goal` is a real event in the match engine: a defender or keeper can put one into
  his own net, it costs him 1.1 of a rating point, it appears in his line as `ownGoals`,
  and the story is raised straight afterwards rather than rolled for. Seventeen of them
  across ten careers.
- `drop_down_league` fires: the trigger was a man of thirty-two playing under 30% of the
  football, which almost nobody is; it is twenty-nine and 52% now.
- `goalDrought` fires: four blank matches rather than five, and it asks whoever is being
  played up front rather than only a man whose registered position group is ATT.
- `rivalDig` fires: a rivalry counts the week after the fixture as well as the week
  before, and the fixture no longer has to be in the league table to exist.
- Every decision now ends with a sentence. Where a story has no written outcome line —
  279 of them — the result sheet prints the answer he actually gave instead of showing a
  column of numbers under a blank space.
- `news.buildUp.vsFormerClub`, its youth variant and the matching inbox line are written
  in both languages; no key produced anywhere in ten careers is missing from either
  dictionary.
- Nineteen dead exports: seventeen deleted, two wired up. `agentCommission` now takes the
  agent's cut out of the weekly wage, and `agentMovePressure` finally does something -
  a greedy agent pushes clubs above the player's level and a career-planner brings back
  the ones where he would play, so the man on the phone is a choice rather than a
  commission rate.
- Retiring is answered by the engine (`answerRetirement`), not by the UI store.

### The simulations that were missing

- **There is a manager.** He has a name, a way of seeing players, and a length of service
  (`packages/engine/src/manager.ts`). He is appointed when the player signs, he is sacked
  when a season goes badly enough - relegation nearly always, a run below where the money
  says the club belongs sometimes - and the pack's own sacking story now sacks him too.
  When he goes, seven tenths of the trust the player built goes with him and the new man
  arrives with his own opinion, formed from the shirt he inherited and the reputation
  attached to it. About twenty-one spells across a twenty-season career.
- **He negotiates his own contract.** A renewal is a decision with three answers - sign,
  push for more, refuse and leave in the summer - rather than a line in the inbox after
  the fact. Pushing works on games played, the manager's opinion and his name; it can
  improve the deal, it can hold, and a club that was lukewarm can take the offer off the
  table. Silence signs it, so nobody loses a club by not reading his mail.
- **The rival for his shirt has a name.** `shirtRival` scores the best team-mate who plays
  his position with the same formula the team sheet uses and says whether that man is
  ahead of him. The hub shows it under the selection outlook, next to the manager's name.

### Still open, and why

The tactical layer (choosing a shape, preparing for an opponent, in-match agency beyond
the interval) and persistent AI careers - other footballers with arcs the player can
follow - are new systems rather than repairs, and both would change what the game is
rather than fix what it does. They are not in this pass.

### Verification

165 engine tests (five new: the dugout, the contract, the shirt, the grade), 11 Playwright
tests, `tsc --noEmit` clean in both packages, a production build, and the invariant probe
walked three twenty-season careers without tripping anything.

---

## 8. The two systems that were left out

Section 7 closed with "the tactical layer and persistent AI careers are new systems rather
than repairs". Both are now in.

### 8.1 The week before the match

A career game cannot hand the player a tactics board - he is one man in eleven - so what
he gets is the part that is actually his: a report on the side he is about to play, and
the job he decides to do inside somebody else's shape.

**The report** (`packages/engine/src/tactics.ts`) is read off the opposition's real
players: their formation, their level against his side's, what they will hurt him with
(pace, possession, pressing, set pieces, physicality), where they are soft (a slow back
line, an open midfield, nothing up front, a beatable keeper), the man they build it
around, and the man in the shirt opposite his. Where the world does not model that
division player by player - a cup tie abroad - the report is thin, and says so, which is
exactly what a scouting report on an unseen side is.

**The plan** is one of nine jobs, filtered to what his position could plausibly be asked
to do: run the channels, drop into space, gamble on the shoulder, take your man on, attack
every cross, screen the back four, stay goalside, step up and squeeze, keep it simple.
Each is a trade in the same currency the half-time instructions use - involvement,
shooting, conversion, creating, defending, legs, cards, variance - applied across the
whole ninety rather than one half, with the interval multiplying on top of it.

**The read** is the point. Every plan is scored against the report before he picks it, and
the fit is shown: *exactly right for this* down to *playing into their hands*. Getting it
right sharpens the plan and adds involvement, conversion and a mark on the rating; getting
it wrong takes the same away, and the running still has to be done either way.

Measured over ten careers and roughly 1,500 matches an arm: choosing the best-read plan is
worth **+0.14 of a rating point per match** against choosing the worst-read one, on top of
whatever the plan itself does. The plan belongs to one fixture and is spent when it is
played.

**The duel.** Every competitive match now has a named man on the other side of it, chosen
by mirroring his slot. He is worth up to ±14% of the ball, and afterwards the match report
says whether he had the better of him - read off what actually happened in the ninety
minutes rather than rolled separately. He wins about a third of them.

### 8.2 The boys he came through with

Everybody else in this world was scenery: team-mates were generated, aged and deleted, a
player sold in the summer stopped existing, and the world's stars were rows in a data pack
with no seasons behind them. So the comparison every young footballer actually lives by -
the lad from his own year who is now at a better club than he is - could not exist.

`packages/engine/src/peers.ts` keeps eight of them. They are chosen once, on promise, from
the boys he actually played against on Sunday mornings, and from then on the world is not
allowed to forget them: they survive every squad rebuild, every summer window and every
memory-saving prune. Each season they train, develop, have a season recorded and, in the
summer, move - bought when they outgrow a club, dropped a level when they cannot get in
the side.

Where their division is simulated, their record is what actually happened in it. Where it
is not - a boy who went abroad at nineteen - it is estimated from the level he plays at,
which is exactly what a player back home would know about him: a number in a newspaper.
Careers that are going nowhere end, because most of them do: a player more than eleven
points below the worst club in this world at twenty-two stops being a professional, and
the eleven games he did play stay on the page.

The career screen shows his year as a table with him at the bottom of it. A sample after
fourteen seasons:

    אריאל קליין      29  Fulham FC          ovr 87  215 apps  106 goals   << ahead of you
    יאיר כץ          30  Atalanta BC        ovr 85  279 apps   17 goals   << ahead of you
    זוהר אשר         29  SV Werder Bremen   ovr 79  163 apps   92 goals   << ahead of you
    ...
    גלעד תורגמן      30  Hapoel Migdal      ovr 48   15 apps    0 goals

Cost: eight extra people in the save. A fifteen-season career serialises at 1.8 MB and a
week costs 2.4 ms.

### 8.3 What it turned up

Adding the renewal question in section 7 left one hole, and the repo's own invariant probe
found it: a renewal that is never answered and never expires leaves a player at a club on
a contract that ended two seasons ago. The week loop now settles it - the terms on the
table are signed if there are any, and if there are none he is out of contract - and the
probe answers the question rather than binning it.

**Every event in the pack now fires.** 144 of 144 in ten full careers, from 142 before
this pass and 119 when the audit started.

### 8.4 Verification

172 engine tests (seven new: the report, the fit, the plan's lifetime, the duel, keeping
his year, their careers adding up, and spells merging), 11 Playwright tests, both packages
typecheck, a production build, and the invariant probe clean over seven twenty-season
careers.
