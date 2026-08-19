/** How many fixtures does one week of career time actually play? */
import { advanceWeek, resumeHalfTime } from '../src/career.js';
import { userYouthCompetitionId } from '../src/youth.js';
import { startedCareer } from './helpers.js';
import { FIRST_MATCH_WEEK, LAST_MATCH_WEEK } from '../src/league.js';

const { state, index } = startedCareer({ seed: 4242 });
const club = state.world.clubs[state.player.clubId!]!;
const youthId = userYouthCompetitionId(state)!;

console.log('match window:', FIRST_MATCH_WEEK, '-', LAST_MATCH_WEEK);
const senior = state.world.competitions[club.competitionId]!;
const youth = state.world.youth!.competitions[youthId]!;

const perWeek = (fixtures: { week: number }[]) => {
  const counts: Record<number, number> = {};
  for (const f of fixtures) counts[f.week] = (counts[f.week] ?? 0) + 1;
  return counts;
};
const rounds = (fixtures: { week: number; round: number }[]) => {
  const byWeek: Record<number, Set<number>> = {};
  for (const f of fixtures) (byWeek[f.week] ??= new Set()).add(f.round);
  return Object.fromEntries(Object.entries(byWeek).map(([w, set]) => [w, set.size]));
};

console.log('senior rounds:', Math.max(...senior.fixtures.map((f) => f.round)),
  'fixtures/week:', JSON.stringify(perWeek(senior.fixtures)));
console.log('senior rounds per week:', JSON.stringify(rounds(senior.fixtures)));
console.log('youth rounds:', Math.max(...youth.fixtures.map((f) => f.round)),
  'rounds per week:', JSON.stringify(rounds(youth.fixtures)));

console.log('--- what one press of Continue does (advance(52) semantics) ---');
for (let press = 0; press < 12; press++) {
  const before = {
    week: state.world.week,
    senior: state.world.competitions[club.competitionId]!.table[club.id]!.played,
    youth: state.world.youth?.competitions[userYouthCompetitionId(state)!]?.table[club.id]?.played ?? 0,
    division: Math.max(...Object.values(state.world.competitions[club.competitionId]!.table).map((r) => r.played)),
  };
  // Exactly what the Continue button does: up to fifty-two weeks, stopping on anything.
  let r = advanceWeek(state, index);
  for (let i = 1; i < 52 && r.stopped === 'week'; i++) r = advanceWeek(state, index);
  if (r.stopped === 'halfTime' && state.pendingHalfTime) {
    r = resumeHalfTime(state, index, state.pendingHalfTime.options[0]!);
  }
  state.pendingDecisions = [];
  const after = {
    senior: state.world.competitions[club.competitionId]!.table[club.id]!.played,
    youth: state.world.youth?.competitions[userYouthCompetitionId(state)!]?.table[club.id]?.played ?? 0,
    division: Math.max(...Object.values(state.world.competitions[club.competitionId]!.table).map((r) => r.played)),
  };
  console.log(
    `press ${press + 1}: week ${before.week} -> ${state.world.week} (${r.stopped}) | his senior +${after.senior - before.senior}, his youth +${after.youth - before.youth}, division rounds +${after.division - before.division} | played ${r.state.lastMatch?.userLine?.played ? 'yes' : 'no'} in ${r.state.lastMatch?.competitionId ?? '-'}`,
  );
}
