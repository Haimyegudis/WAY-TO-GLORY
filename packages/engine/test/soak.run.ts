/**
 * Headless soak run: plays a full career start to finish and prints the story.
 * This is the check that the engine produces a career worth playing before any
 * UI exists. Run with: npm run soak -w @fc/engine
 */
import { advanceWeek, careerSummary, currentOvr, retire } from '../src/career.js';
import { resolveDecision } from '../src/events.js';
import { Rng } from '../src/rng.js';
import { marketValue } from '../src/value.js';
import { saveSizeBytes } from '../src/save.js';
import { startedCareer, loadPack } from './helpers.js';

const seed = Number(process.argv[2] ?? 4242);
const { state, index } = startedCareer({ seed });
const pack = loadPack();
const rng = new Rng(seed ^ 0x5bf03635);

console.log(`career seed ${state.careerSeed}`);
console.log(`start: ${state.player.firstName} ${state.player.lastName}, ${state.player.primaryPos}, OVR ${currentOvr(state)}, potential ${state.player.potential} (hidden)`);
console.log(`club:  ${state.world.clubs[state.player.clubId!]!.name} (${state.world.clubs[state.player.clubId!]!.competitionId})\n`);

let weeks = 0;
let decisions = 0;
const maxWeeks = 52 * 30;
let lastSeason = state.world.season;

while (!state.retired && weeks < maxWeeks) {
  const before = state.world.season;
  advanceWeek(state, index);
  weeks++;

  // Answer any decision by picking an option at random, the way a distracted player would.
  for (const decision of [...state.pendingDecisions]) {
    const option = rng.pick(decision.options);
    resolveDecision(rng, state, decision.id, option.id, pack.events);
    decisions++;
  }

  // Take the best available offer whenever one is on the table, so the career moves.
  if (state.transferOffers.length > 0) {
    const best = [...state.transferOffers].sort((a, b) => b.interestLevel - a.interestLevel)[0]!;
    const club = state.world.clubs[best.clubId]!;
    const { acceptOffer } = await import('../src/career.js');
    acceptOffer(state, index, best.id);
    console.log(`  ${before} w${state.world.week}: transfer -> ${club.name} (${club.competitionId}) role ${best.squadRole}`);
  }

  if (state.agentOffers.length > 0) {
    const { signAgent } = await import('../src/career.js');
    signAgent(state, state.agentOffers[0]!.id);
  }

  if (state.world.season !== lastSeason) {
    lastSeason = state.world.season;
    const record = state.seasonHistory.at(-1);
    if (record) {
      const club = state.world.clubs[record.clubId ?? ''];
      const rating = record.ratedApps > 0 ? (record.ratingSum / record.ratedApps).toFixed(2) : '-';
      console.log(
        `${record.season}/${String((record.season + 1) % 100).padStart(2, '0')}  age ${record.age}  ` +
          `${(club?.shortName ?? 'no club').padEnd(22)} ${String(record.apps).padStart(2)} apps  ` +
          `${String(record.goals).padStart(2)}g ${String(record.assists).padStart(2)}a  ` +
          `rat ${rating}  OVR ${record.ovrStart}->${record.ovrEnd}  ` +
          `pos ${record.leaguePosition ?? '-'}  ${record.trophies.length > 0 ? 'TROPHY' : ''}`,
      );
    }
  }
}

if (!state.retired) retire(state);

const summary = careerSummary(state);
console.log('\n=== CAREER COMPLETE ===');
console.log(`seasons ${summary.seasons}  matches ${summary.matches}  goals ${summary.goals}  assists ${summary.assists}`);
console.log(`avg rating ${summary.avgRating}  caps ${summary.caps}  trophies ${summary.trophies}`);
console.log(`peak OVR ${summary.peakOvr}  potential was ${state.player.potential}`);
console.log(`peak value EUR ${(summary.peakValue / 1e6).toFixed(1)}M  earnings EUR ${(summary.careerEarnings / 1e6).toFixed(1)}M`);
console.log(`score ${summary.score}/100  status ${summary.status}`);
console.log(`\nweeks simulated ${weeks}, decisions taken ${decisions}, injuries ${state.player.condition.injuryHistory.length}`);
console.log(`save size ${(saveSizeBytes(state) / 1024).toFixed(0)}KB, modelled players ${Object.keys(state.world.players).length}`);
console.log(`final market value ${marketValue(state.player, { season: state.world.season, leagueReputation: 50, contract: state.contract, internationalCaps: state.nationalTeam.caps })}`);
