# Football Career — full game audit

Date: 2026-08-21
Scope: engine, progression, gameplay, scenarios, module connectivity, performance, persistence, data realism, UI/UX, accessibility, PWA/offline behavior, and all player-facing correspondence.

## Executive verdict after remediation

The project is already a coherent, deterministic career simulation rather than a collection of disconnected screens. Training, minutes, manager trust, morale, fitness, personality, relationships, reputation, contracts, agents, injuries, lifestyle and media choices all feed back into selection, development, match performance or career opportunities.

The strongest parts are career progression, breadth of scenarios, deterministic simulation and the Hebrew-first presentation. This remediation pass fixed the critical match chronology and player-presence defects, moved training consequences before selection, introduced senior training camp and friendlies, hardened saves, added competition calendars/rules, reduced the initial PWA payload and established browser/accessibility coverage. The match remains intentionally abstract compared with a full tactical manager, but its events are now causal and its modules materially affect one another.

### Scorecard

| Area | Score | Assessment |
|---|---:|---|
| Architecture and determinism | 8.5/10 | Clear engine/data/app split; reproducible simulation; strong domain coverage. |
| Player development | 8/10 | Age, potential, minutes, coaching, facilities, intensity, diet, morale, fitness and personality have real effects. |
| Module connectivity | 8/10 | Most visible choices reach selection, development, match output or career state. |
| Scenarios and correspondence | 8.5/10 | 142 events, 304 choices, 34 repeatable relationship actions; impact is now exposed before selection. |
| Match gameplay | 7.5/10 | Chronological events, real exits, goalkeeper strength, score-state behavior and ten-man effects are integrated and regression-tested. |
| World and competition realism | 7.5/10 | 2026/27 career calendar with competition profiles; source-strength snapshot is honestly retained as 2025/26. |
| UI/UX | 8.5/10 | Strong mobile/RTL identity, accessible dialogs/live regions, clearer consequences and browser-tested core flow. |
| Performance | 8.5/10 | Weekly simulation is fast; screens/data/cloud are lazy and the install precache is substantially smaller. |
| Reliability and tests | 8.5/10 | 111 engine tests plus Playwright save/load and axe coverage pass. |

## Remediation completed

- Match moments are resolved in minute order; score snapshots can no longer move backwards.
- A substitution, injury or dismissal immediately removes the player from later chances, assists and penalties and changes team strength.
- Goalkeeper ratings, score-state tactical behavior and numerical disadvantage now affect conversion.
- Training load, recovery, aggravation and training injuries resolve before team selection; match load resolves after the real minutes played.
- A new senior begins with three camp weeks and three friendlies. Fit players receive evaluation minutes, while league play is held until week 7 and Europe until qualifying opens.
- Per-competition calendars, winter breaks, table points and tie-breaker profiles now drive fixtures and standings.
- Saves use per-slot queues, serialized index writes, revisions and lifecycle flushes; browser coverage verifies a real save/reload.
- Screens, cloud support and the data pack are lazy-loaded. The PWA precache fell from 2,771.10 KiB to 1,024.23 KiB.
- Dialog focus, Escape behavior, live announcements, heading structure, zoom and contrast were corrected and covered with Playwright + axe.

## What is genuinely connected

| Player decision/system | Downstream impact |
|---|---|
| Training intensity, focus and diet | Condition, fatigue, injury risk, attribute growth and long-term OVR. |
| Minutes and squad role | Development rate, form, reputation, value, offers and career satisfaction. |
| Manager relationship/trust | Selection probability, role, being dropped/frozen out, transfer pressure and contract context. |
| Fans, media, teammates and board | Morale, fame, dressing-room consequences, club standing, incidents and later opportunities. |
| Personality | Match pressure, consistency, professional development, adaptability and decision consequences. |
| Fitness, sharpness, form and morale | Selection and the match mental/performance multiplier. |
| Injuries | Availability, development, value, selection and treatment/return scenarios. |
| Agent and mentor instructions | Transfer search priorities, loan/step-up preferences, contract stance and attribute/personality changes. |
| Lifestyle, purchases and sponsors | Money, fatigue, morale, fame, fans and career state. |
| Season goals and public claims | Manager trust, morale, reputation and follow-up consequences when fulfilled or broken. |

The custom event flags were traced through the engine. The meaningful flags are consumed by later career logic or retirement summaries; no large disconnected scenario module was found.

## Resolved critical findings

### P0 — match chronology can be impossible

Original finding: `packages/engine/src/match.ts` resolved open-play chances for an entire half first, then rolled the penalty, cards and injury, and only sorted events afterwards. This could make displayed score snapshots move backwards.

Status: resolved with a chronological `MatchMoment` queue and score-snapshot regression coverage across hundreds of seeds.

### P0 — the user can contribute after leaving the pitch

Original finding: the attacking and creator pools could retain the user after an exit, and penalty eligibility used total minutes rather than presence at the penalty minute.

Status: resolved. Eligibility is derived at the event minute and tested across substitutions, dismissals and injuries.

### P0 — red cards and match injuries do not alter the remaining simulation

Original finding: a red card did not shorten the player line or weaken the team, while an injury did not update the shared on-pitch boundary used by the second half.

Status: resolved. Exits update the on-pitch boundary immediately and ten-man strength affects the remainder.

## High-priority findings

### Match model depth

The match model is a narrative probability engine, not a full tactical manager. It now resolves goalkeeper strength, score-state behavior, player exits and numerical disadvantage. Explicit AI substitutions, weather, referee tendencies and team styles remain future depth opportunities. Ambient sequences are intentionally cosmetic.

Recommendation: add AI substitution choices and team styles next; the causality layer is now stable enough to support them.

### Training lifecycle — resolved

Original finding: the weekly order simulated fixtures before condition, development and training injuries, creating a one-match delay between a training choice and its consequence.

Training and medical consequences now resolve before selection; match fatigue and development use the minutes actually played afterwards. Half-time resume cannot apply training twice.

### Initial load — resolved

Production build before remediation:

- main app: 609.04 kB minified / 175.37 kB gzip;
- data pack: 1,590.59 kB / 218.30 kB gzip;
- engine: 213.42 kB / 68.57 kB gzip;
- cloud: 216.86 kB / 57.11 kB gzip;
- PWA precache: 2,771.10 KiB;
- Vite reports chunks over 500 kB.

All screens are route-lazy, the data pack is loaded only when a career needs it, and cloud code is isolated. The current production build has a 472.21 kB main chunk (143.36 kB gzip) and a 1,024.23 KiB precache; pack/cloud chunks are cached on first use. The latest soak completed 1,277 weeks and 450 matches without a crash.

### Save durability — resolved

Original finding: routine persistence was fire-and-forget, so rapid actions or page close could overlap a write. Long-career saves remain roughly 1.8 MB raw JSON.

Per-slot and index write queues prevent overlap, each summary carries a monotonic revision, critical exits flush, and page lifecycle events request the latest snapshot. Playwright verifies persistence through reload. Compression remains a future storage optimization rather than a correctness blocker.

### Automated UI safety net — resolved for the core flow

Original finding: 105 engine tests existed, but no browser E2E or accessibility suite protected the full game flow.

Playwright now covers creation, academy selection, hub rendering, save/reload and dialog keyboard behavior. Axe runs at each core screen. Wider multi-season UI journeys remain useful future coverage.

## World realism

The current pack is version 2026.27.0 and contains 28 countries, 39 league competitions, 608 clubs, 605 crests and 9,373 named stars. The career calendar is 2026/27. The latest completed upstream snapshot available during this audit was 2025/26, so club strength/source metadata retains that truthful date instead of relabelling it.

- calendar families now distinguish European, Scandinavian, American and South American schedules;
- winter breaks, start/end weeks, points and tie-break order are competition profiles;
- head-to-head and wins-first sorting are supported;
- splits, playoffs and unusual competition formats are not comprehensively modeled;
- AI squad windows generate/delete modeled squad members rather than executing a fully traceable global transfer market;
- the soak harness accepts strong offers automatically and exposed frequent club churn; offer cadence and the two-moves-per-season allowance need a player-experience tuning pass.

Recommendation: extend the new profiles to split/playoff formats, refresh source strengths when authoritative 2026/27 data is available, and keep player/club history for AI market moves.

## UI/UX and accessibility

Strengths:

- distinctive, consistent mobile visual system;
- Hebrew and English are fully paired (2,004 keys each after this pass);
- proper RTL/LTR switching, responsive layout and safe-area support;
- pitch-based selection and a readable live 2D match presentation;
- reduced-motion and visible-focus foundations;
- clear local save slots and an understandable week-to-week primary action.

The pass added dialog focus management and Escape handling, live regions for match/toast updates, a top-level error boundary, semantic headings, zoom support, stronger contrast and larger secondary copy. Stale PWA asset references were removed. Crests and audio remain runtime-cached by design so the initial install stays small; only assets already visited are guaranteed offline.

## Correspondence audit and implemented improvements

This audit included implementation, not only recommendations:

- rewrote vague Hebrew media, manager and supporter answers as complete, natural dialogue;
- made potentially hostile, loyal, professional and self-promotional choices distinct rather than interchangeable labels such as “respond” or “try”;
- added directional impact chips to every event answer, sourced from its actual engine effects;
- shows uncertainty when an answer has probabilistic outcomes and “no immediate impact” for deliberate neutral choices;
- added three multi-option scenarios: a supporters' forum, a manager role review and a press question about a struggling teammate;
- added six repeatable actions: ask the captain for advice, lead a club community day, visit a supporters' club, give an exclusive interview, publicly defend the team and answer critics;
- added a dedicated media category to relationship actions;
- mentor topics now explain their gameplay effect before asking, and career-changing advice shows the exact agent brief it will set;
- mentor answer effects are now visible in the same impact system as other decisions;
- rebuilt the content pack from 139 to 142 career events.

The changes preserve English parity, while the requested editorial rewrite is focused on the Hebrew experience.

## Verification performed

- `npm test`: 111/111 engine tests passed.
- `npm run test:e2e`: 2/2 Playwright journeys passed, including axe checks and IndexedDB save/reload.
- `npm run build`: TypeScript and production PWA build passed; precache 1,024.23 KiB.
- data pack build: 142 events across 28 countries, 39 competitions and 608 clubs.
- translation parity: 2,004 Hebrew keys and 2,004 English keys.
- long simulation soak: 1,277 weeks, 20 seasons, 450 matches, no crash.
- `npm audit`: 0 known dependency vulnerabilities after upgrading Vitest to 4.1.11.
- `git diff --check`: no whitespace errors.

## Remaining product opportunities

1. Add explicit AI substitutions, team styles, weather and referee tendencies for deeper match tactics.
2. Expand E2E journeys through training, a full friendly, transfers and season rollover.
3. Refresh club/squad source strength when an authoritative 2026/27 upstream dataset becomes available.
4. Compress cloud/export saves and tune long-career transfer churn.
