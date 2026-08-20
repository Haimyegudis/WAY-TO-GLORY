/**
 * A career played on the other side of the water.
 *
 * Argentina, Brazil and the United States were added to the pack, and none of the code
 * around a career had ever seen a country that is not in Europe. This starts a career in
 * each of them and walks eight seasons, watching the things that could quietly be wrong:
 * an academy that has no clubs to offer, a league that never finishes a table, mentors
 * that do not exist in his country, and a nation drawn into a European Championship.
 *
 *   tsx test/americas.probe.ts
 */
import { advanceWeek, answerMedia, answerOffer, answerSeasonGoal, resumeHalfTime } from '../src/career.js';
import { resolveDecision } from '../src/events.js';
import { mentorsFor } from '../src/mentor.js';
import { nationEligible, tournamentFor } from '../src/tournament.js';
import { Rng } from '../src/rng.js';
import { loadPack, startedCareer } from './helpers.js';

loadPack();

const HOMES: { country: string; league: string }[] = [
  // Israel is the control: whatever it does is what "normal" looks like.
  { country: 'ISR', league: 'il.1' },
  { country: 'ARG', league: 'arg.1' },
  { country: 'BRA', league: 'bra.1' },
  { country: 'USA', league: 'usa.1' },
];

for (const home of HOMES) {
  const { state, index, offers } = startedCareer({
    seed: 31,
    birthCountry: home.country,
    startCountry: home.country,
  });
  const rng = new Rng(99);

  const club = state.world.clubs[state.player.clubId ?? ''];
  const mentors = mentorsFor(home.country);
  const euro = nationEligible('euro', home.country, index);
  const worldCup = nationEligible('worldCup', home.country, index);

  let weeks = 0;
  let matches = 0;
  let tournaments = 0;
  let qualifiers = 0;
  let deepestMatchday = 0;

  for (let i = 0; i < 53 * 8 && !state.retired; i++) {
    const result = advanceWeek(state, index);
    weeks++;
    if (result.stopped === 'halfTime' && state.pendingHalfTime) {
      const held = state.pendingHalfTime;
      resumeHalfTime(state, index, held.demand ?? held.options[0]!);
    }
    for (const decision of [...state.pendingDecisions]) {
      if (decision.kind === 'transfer') {
        answerOffer(state, index, decision.id, null);
      } else if (decision.eventId === 'seasonGoal') {
        answerSeasonGoal(state, index, decision.id, decision.options[0]!.id);
      } else if (decision.eventId.startsWith('milestone:')) {
        answerMedia(state, index, decision.id, decision.options[0]!.id);
      } else if (decision.kind !== 'agent' && !decision.eventId.startsWith('mentorPrompt_')) {
        resolveDecision(rng, state, decision.id, decision.options[0]!.id, index.pack.events);
      }
      state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
    }
    matches = state.matchLog.length;
    const live = state.world.competitions[home.league];
    if (live) {
      for (const row of Object.values(live.table) as { played?: number }[]) {
        deepestMatchday = Math.max(deepestMatchday, row.played ?? 0);
      }
    }
    tournaments = state.tournaments?.length ?? 0;
    qualifiers = (state as unknown as { qualifying?: unknown }).qualifying ? 1 : qualifiers;
  }

  const comp = state.world.competitions[home.league];
  const table = comp ? Object.values(comp.table) : [];
  const played = table.reduce((most, row: any) => Math.max(most, row.played ?? 0), 0);
  const seasons = [...new Set(state.matchLog.map((m) => m.season))];

  console.log(`\n${home.country}`);
  console.log(`  academy offers: ${offers.length}, joined: ${club?.name ?? 'none'} (${club?.competitionId ?? '-'})`);
  console.log(`  mentors available: ${mentors.length}`);
  console.log(`  euro eligible: ${euro} (should be false), world cup: ${worldCup} (should be true)`);
  console.log(`  weeks: ${weeks}, matches logged: ${matches}, seasons played: ${seasons.length}`);
  console.log(`  league matchdays reached: ${played} now, ${deepestMatchday} deepest in a season`);
  console.log(`  tournaments played: ${tournaments}, qualifying campaigns seen: ${qualifiers}`);
  console.log(`  national team: caps ${state.nationalTeam?.caps ?? 0}, level ${state.nationalTeam?.level ?? 'none'}, country ${state.nationalTeam?.countryCode ?? '-'}`);
  console.log(`  league rows: ${table.length}, weeks in comp: ${comp?.fixtures?.length ?? 0}`);
  console.log(`  ovr now: ${Math.round(state.player.attributes.passing)} passing, club: ${state.world.clubs[state.player.clubId ?? '']?.name ?? 'none'}`);
}

console.log(`\ntournament calendar: ${[0, 1, 2, 3].map((n) => `${2025 + n}->${tournamentFor(2025 + n) ?? 'none'}`).join('  ')}`);
