# Football Career — Technical Design V1

Date: 2026-08-18
Status: Approved (brainstorming → build)

## 1. What this is

Single-player career simulator. User creates one footballer at age 15 and manages **his career**, not a team.
No direct match control. Core loop: `Continue → simulate → event → decision → consequence`.

Success is not "reach OVR 95". Success is any coherent career arc the player owns.

## 2. Locked decisions

| Topic | Decision | Why |
|---|---|---|
| Scope | Full MVP: engine + data + UI + cloud | User choice |
| World depth | Full squad for user's club (~25) + ~8 named stars per club in user's league; other clubs = rating only | Runs on a phone, still produces a credible top scorer / transfer market |
| Backend | Supabase: auth + cloud save + leaderboards. Engine runs **on device** | Local-first, offline playable |
| Hosting | Vercel static PWA | Installable on Android/iOS/Windows without app store |
| Club data | Real clubs, imported from openfootball at build time | Accurate, refreshable, no hand-typing |
| Player data | Hybrid: ~30 biggest clubs get real named stars; everyone else procedurally generated | Emotional anchor + never goes stale |
| Match sim | Chance-based for user's matches, result-first for user's league, score-only elsewhere | Narrative moments are *real* events, not fake text |
| Events | Data-driven JSON event engine, ~80 events at MVP | Adding an event must take 30 seconds |
| Languages | Hebrew + English, RTL-aware, i18n from day one | Avoids a later refactor |
| Determinism | Every random draw derives from `careerSeed`. No `Math.random()` in engine | Reproducible saves, debuggable |

**Legal note:** real club and player names are used. This build is for private use by the author and
a couple of friends. Public/commercial distribution would require swapping the data pack — which is
why the engine only ever references `clubId`, never a name.

## 3. Repo layout

```
soccer/
├─ packages/
│  ├─ engine/   pure TypeScript. no DOM, no React. vitest.
│  ├─ data/     import + generation scripts, produced JSON packs
│  └─ app/      React + Vite + PWA + i18n
└─ docs/
```

Hard rule: `app` may import `engine`; `engine` may never import `app` or any browser API.
The engine must be runnable under plain Node so a 30-season simulation can run in CI.

## 4. Core model

### 4.1 Time

Tick unit = **one week**. 30-year career ≈ 1,560 ticks.

Each tick, in order:
1. apply training load + nutrition
2. play scheduled matches
3. recovery, fatigue, injury rolls
4. attribute development
5. event engine check
6. stop if a decision is pending

### 4.2 Player

```ts
interface Player {
  id: string
  firstName: string; lastName: string
  birthYear: number; birthCountry: string; citizenships: string[]
  heightCm: number; weightKg: number; foot: 'L' | 'R' | 'B'
  primaryPos: Position; secondaryPos: Position[]
  attributes: Attributes        // 24 attrs, 1-99
  potential: number             // hidden, 40-99, dynamic
  personality: Personality      // partly hidden
  form: number                  // 0-100
  fitness: number               // 0-100
  morale: number                // 0-100
  condition: Condition          // injuries, suspensions
  clubId: string | null
  squadRole: SquadRole
  reputation: number            // 0-100
  fame: number                  // 0-100, separate from ability
}
```

`OVR` is **derived**, never stored: a per-position weighted mean of attributes.
A CB and a ST with identical attributes have different OVR. This is what makes position matter.

### 4.3 Attributes (24)

Physical: pace, acceleration, strength, stamina, agility, balance, jumping
Technical: shooting, finishing, passing, crossing, dribbling, ballControl, tackling, marking, heading, firstTouch
Mental: decisions, composure, workRate, positioning, vision, concentration, leadership

Personality (separate, slow-moving): professionalism, ambition, loyalty, adaptability,
pressureHandling, discipline, consistency, determination.

### 4.4 Position weights

Each position has a weight vector over attributes summing to 1. OVR = Σ(attr × weight).
Stored in data, not code. Adding a position = adding a row.

## 5. Development engine

```
weeklyGain(attr) =
    ageFactor(age, position)
  × headroom(current, potential)
  × trainingFactor(load, focus, coachQuality, facilities)
  × playingTimeFactor(minutes90s)
  × professionalismFactor
  × moraleFactor
  × fitnessFactor
  × rng.jitter(0.7, 1.3)
```

- `headroom` shrinks to 0 as OVR approaches potential — no one blows past their ceiling.
- `ageFactor` peaks 18-20, positive to ~29, negative from ~31, GK curve shifted +3 years.
- Physical attributes decline first; mental attributes keep growing into the 30s. That is what makes
  an aging playmaker still useful while an aging winger is not.
- Missing playing time is the single biggest development killer, by design. That is the whole tension
  of the "big club bench vs small club starter" choice.

**Dynamic potential:** after each season, potential shifts ±1-4 based on whether the season
beat or missed expectation for the player's age and role.

## 6. Match engine

### Detail level 1 — user's matches (chance-based)

1. Compute team strengths from squad ratings + home advantage + form.
2. Derive expected chances for each side (8-16 total).
3. For each chance: pick the involved attacker by weight (position, ability, form),
   pick a possible assister, resolve `finishing vs GK + defence` with a logistic roll.
4. Defensive chances exist too: the user's defenders/GK get `intervention` events resolved the same way.
5. Every resolved chance the user was involved in becomes a `MatchEvent` with minute + text key.
6. Match rating is computed from the player's own event ledger, weighted **by position**
   (a CB scores on interventions/duels/passing, a ST on chances converted).

### Detail level 2 — rest of user's league

Result-first: scoreline drawn from team ratings, then goals distributed across that club's
8 named stars by weight. Produces a believable golden boot race.

### Detail level 3 — other leagues

Scoreline only, table maintained, no player attribution.

## 7. Selection / minutes

```
SelectionScore =
    OVR × 1.0
  + form × 0.30
  + fitness × 0.25
  + managerTrust × 0.35
  + tacticalFit × 0.20
  + reputation × 0.10
  - fatigue × 0.30
  - injuryPenalty (excluded if injured)
  - suspensionPenalty (excluded if suspended)
```

Computed for every squad member at each position slot. The manager picks the top 11 by
formation need, then rotates for fixture congestion. The user is never special-cased.

`managerTrust` (0-100) moves on performances, training, discipline, and conversations.

## 8. Events engine

Event = JSON:

```json
{
  "id": "manager_position_switch",
  "category": "manager",
  "weight": 30,
  "cooldownWeeks": 40,
  "trigger": { "age": [17, 30], "minMinutesSeasonPct": 0.2, "squadRoleIn": ["rotation", "starter"] },
  "textKey": "event.manager_position_switch",
  "options": [
    { "id": "accept", "effects": [{ "managerTrust": 8 }, { "learnPosition": "$offeredPos" }] },
    { "id": "decline", "effects": [{ "managerTrust": -10 }, { "morale": -5 }] }
  ]
}
```

Each tick: filter eligible events by trigger + cooldown, weighted-pick at most one.
Outcomes are described qualitatively ("Risk: High"), never as explicit percentages.

## 9. Data packs

```
packs/
  world.json        countries, competitions, rules, calendars
  clubs.json        every club: id, name, country, competitionId, tier, reputation, academy, facilities, finances
  stars.json        real named players for ~30 elite clubs
  names/<cc>.json   first/last name pools per nationality for generated players
  events.json       career events
```

Competition rules are data, not code:

```json
{
  "id": "en.1", "name": "Premier League", "country": "ENG", "tier": 1,
  "teams": 20, "rounds": 2,
  "promotion": { "auto": 0 }, "relegation": { "auto": 3, "to": "en.2" },
  "cards": { "yellowSuspensionThreshold": 5, "resetAfterMatchday": 19, "redSuspension": 3 },
  "europeanSlots": { "ucl": 4, "uel": 2, "uecl": 1 }
}
```

Sources: England 1-3, Spain 1-2, Germany 1-2, Italy 1-2 imported from openfootball 2025-26.
Israel (3 tiers) and the missing third tiers are authored by hand and flagged `"source": "manual"`.

## 10. Save format

```ts
interface SaveGame {
  schemaVersion: number
  gameVersion: string
  careerSeed: number
  createdAt: string; savedAt: string
  currentDate: { season: number; week: number }
  player: Player
  world: WorldState       // clubs' season state, tables, squads of relevant clubs
  history: CareerHistory  // per-season aggregates, kept forever
  recentLog: LogEntry[]   // last 2 seasons of detail, older ones compacted
}
```

Stored in IndexedDB. Compaction keeps a 30-year save around 2-4 MB.
`schemaVersion` gates migrations so an app update never destroys a career.

Supabase mirrors the save as a compressed blob plus a metadata row
(player name, age, club, OVR, career score) which also feeds leaderboards.

## 11. UI

React + Vite + TypeScript, PWA (installable, offline). Zustand for view state; the engine owns game state.
i18n via a light key/value store with `he` and `en`, `dir` switching on `<html>`.

Screens: Home, Career Hub (dashboard), Match Centre, Squad/Table, Training, Agent/Transfers,
National Team, Career History, Settings.

The dashboard is the centre of gravity and should read like a footballer's phone:
next fixture, inbox, form, fitness, season line. One primary button: **Continue**.

Design direction is produced with the frontend-design skill at implementation time. Non-negotiables:
dark-first, one accent colour, numbers are the hero, no stock-dashboard look, RTL must not be an afterthought.

## 12. Testing

- Engine unit tests (vitest) for: RNG determinism, OVR derivation, dev curve monotonicity,
  chance resolution bounds, selection ordering, card/suspension rules, save migration.
- A "soak" test: run 30 full seasons headless and assert the world stays sane
  (no negative ages, table points add up, top scorer plausible, no OVR > potential).
- Determinism test: same seed + same actions ⇒ byte-identical save.

## 13. Build order

1. engine core: rng, model, OVR, development, calendar, tick loop
2. data pack: importer + generators + manual leagues
3. match engine + season loop + headless soak test
4. transfers, contracts, agents, injuries, national teams
5. events engine + event content
6. React PWA + i18n
7. Supabase auth/sync/leaderboards
8. polish, balance passes
