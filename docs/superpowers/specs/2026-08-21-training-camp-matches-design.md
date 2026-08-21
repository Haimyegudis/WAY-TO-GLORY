# Training camp: six friendlies, every one of them played

## Problem

The three-week training camp already simulates the player's friendlies as full user
matches - lineup, minutes, roughly forty events, a half-time talk. The player rarely
sees any of it.

1. **The match centre never opens.** `advanceWeek` sets `stopped = 'match'` when he
   plays (`career.ts:1229`), but a story or event raised later in the same week
   overwrites it with `stopped = 'decision'`. Only a national match is restored
   afterwards. Camp weeks are event-heavy, so the friendly is swallowed and the score
   turns up later in the results list. League weeks are affected the same way.
2. **The camp is three matches long**, one a week, which is thin for a pre-season that
   decides his squad role.
3. **The camp card shows counters, not football**: `Friendlies 2/3` and an average
   rating. The fixtures themselves - who, home or away, what happened - are nowhere.

## Design

### 1. A match he played keeps the week

A club or friendly match he appeared in becomes the week's stopping point again, the
way a selected international already is: the decision stays queued in
`state.pendingDecisions` and is put to him when he leaves the match centre. Nothing
about decision generation changes - only which stop the tick reports.

### 2. Six friendlies, two a week

`scheduleTrainingCamp` books two distinct opponents for each of the three camp weeks
under `campOpponent:{season}:{week}:{slot}`, `slot` being `a` (midweek) or `b`
(weekend). Six distinct opponents in all. The strength ramp is unchanged: week one
below his club's level, week two around it, week three above it. Home and away
alternate so the camp finishes away at the strongest side.

A week with two matches stops twice. This reuses the replay the half-time interrupt
already relies on: the midweek friendly is played and the tick returns
`stopped = 'match'` before the rest of the week runs; pressing continue re-enters the
same week, where training is already marked resolved (`trainingResolvedWeek`) and slot
`a` is already marked played, so slot `b` is played and the week then completes -
development, events, morale, relationships.

Minutes from both matches have to reach development, which runs once, on the second
pass. `campMinutes:{season}:{week}` accumulates the minutes of each camp match as it is
played and is added to the week's total; it is cleared when the week completes.

Two consequences of the same week now holding two matches:

- **Coach feedback** (`inbox.trainingCampFeedback.{week}`) is sent after the week's
  *second* friendly only. The copy is written as one review per week and stays that way.
- **The end-of-camp verdict** in `applyFriendlyToPlayer` - squad role change, promotion
  out of the academy, the decision that ends the camp - fires after the *last* friendly
  of week three rather than after both of that week's matches.

### 3. The camp card is a fixture list

The card on the hub lists all six camp fixtures in order: crest, opponent, home or away,
and either the score or that it is still to come. A played fixture opens that match in
the match centre. The counters (rating average, manager trust, OVR growth) move below
the list, and the friendlies counter reads `n/6`.

`nextFixture` in `selectors.ts` returns the next *unplayed* camp slot instead of
assuming one fixture a week, so the build-up screen names the right opponent.

## Testing

- Engine: a camp week produces two friendlies he played; six over the camp; the second
  stop is a separate match; development sees both matches' minutes; coach feedback
  arrives once a week; the camp verdict fires once.
- Engine: a week holding both a match he played and a blocking decision reports
  `stopped = 'match'`, with the decision still pending.
- App e2e: the camp card lists six fixtures and the played ones open the match centre.

## Out of scope

Other clubs' pre-season, a camp tournament with a table, and any change to the length of
the camp itself (weeks 1-3, `PRESEASON_END_WEEK`).
