/**
 * Numbers a football audit asks for: how often he is hurt, how often he is left out,
 * how often somebody rings, and what the curve of a career actually looks like.
 *
 *   tsx test/stats.probe.ts [seeds] [seasons]
 */
import { advanceWeek, answerMedia, answerOffer, answerAgent, answerSeasonGoal, currentOvr, computeCareerScore, careerStatus, resumeHalfTime } from '../src/career.js';
import { resolveDecision } from '../src/events.js';
import { Rng } from '../src/rng.js';
import { loadPack, startedCareer } from './helpers.js';

loadPack();
const seeds = Number(process.argv[2] ?? 12);
const maxSeasons = Number(process.argv[3] ?? 25);

const ovrByAge = new Map<number, number[]>();
const injuryWeeks: number[] = [];
const perSeason: { season: number; age: number; apps: number; missedInjury: number; missedNotSelected: number; missedSuspended: number; clubMatches: number }[] = [];
const offersPerSeason: number[] = [];
const scores: { score: number; status: string; peakOvr: number; apps: number; trophies: number }[] = [];
const wageByOvr: [number, number][] = [];

for (let s = 0; s < seeds; s++) {
  const seed = 501 + s * 13;
  const rng = new Rng(seed);
  const { state, index } = startedCareer({ seed }, s % 5);
  const seenInjuries = new Set<string>();
  const seenMatches = new Set<string>();
  let offers = 0;
  let peakOvr = 0;
  let season = state.world.season;
  let apps = 0; let missedInjury = 0; let missedNotSelected = 0; let missedSuspended = 0; let clubMatches = 0;
  const startSeason = state.world.season;

  const flushSeason = () => {
    perSeason.push({
      season, age: season - state.player.birthYear,
      apps, missedInjury, missedNotSelected, missedSuspended, clubMatches,
    });
    apps = 0; missedInjury = 0; missedNotSelected = 0; missedSuspended = 0; clubMatches = 0;
  };

  let weeks = 0;
  while (!state.retired && state.world.season - startSeason < maxSeasons && weeks < 53 * maxSeasons * 2) {
    weeks++;
    if (state.world.season !== season) { flushSeason(); season = state.world.season; }
    const result = advanceWeek(state, index);
    const age = state.world.season - state.player.birthYear;
    peakOvr = Math.max(peakOvr, currentOvr(state));
    const list = ovrByAge.get(age) ?? [];
    list.push(currentOvr(state));
    ovrByAge.set(age, list);
    if (state.contract) wageByOvr.push([currentOvr(state), state.contract.salaryPerWeek]);

    if (result.stopped === 'halfTime' && state.pendingHalfTime) {
      const held = state.pendingHalfTime;
      resumeHalfTime(state, index, held.demand ?? held.options[0]!);
    }

    for (const decision of [...state.pendingDecisions]) {
      if (decision.kind === 'transfer') {
        offers += state.transferOffers.length;
        // A realistic player: he moves for a clear step up, or when he is not playing.
        const best = [...state.transferOffers].sort((a, b) => b.interestLevel - a.interestLevel)[0];
        const notPlaying = state.player.squadRole === 'bench' || state.player.squadRole === 'fringe';
        const take = best && (notPlaying || rng.chance(0.15)) ? best.id : null;
        answerOffer(state, index, decision.id, take);
      } else if (decision.kind === 'agent') {
        answerAgent(state, decision.id, decision.agents?.[0]?.id ?? null);
      } else if (decision.eventId === 'seasonGoal') {
        answerSeasonGoal(state, index, decision.id, 'agreed');
      } else if (decision.eventId.startsWith('milestone:')) {
        answerMedia(state, index, decision.id, decision.options[0]!.id);
      } else if (decision.eventId === 'retirement_choice') {
        if (rng.chance(0.4)) state.flags['wantsRetirement'] = true;
      } else if (decision.options.length > 0) {
        resolveDecision(rng, state, decision.id, decision.options[rng.int(0, decision.options.length - 1)]!.id, index.pack.events);
      }
      state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
    }

    for (const injury of state.player.condition.injuries) {
      if (seenInjuries.has(injury.id)) continue;
      seenInjuries.add(injury.id);
      injuryWeeks.push(injury.weeksOut);
    }
    for (const match of state.matchLog) {
      if (seenMatches.has(match.id)) continue;
      seenMatches.add(match.id);
      if (match.competitionId.startsWith('friendly') || match.competitionId.startsWith('national')) continue;
      const line = match.userLine;
      if (!line) continue;
      clubMatches++;
      if (line.played) apps++;
      else if (line.reasonNotPlayed === 'injured') missedInjury++;
      else if (line.reasonNotPlayed === 'suspended') missedSuspended++;
      else missedNotSelected++;
    }
  }
  flushSeason();
  const score = computeCareerScore(state);
  scores.push({
    score, status: careerStatus(score), peakOvr,
    apps: state.seasonHistory.reduce((a, r) => a + r.apps, 0),
    trophies: state.trophies.length,
  });
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => sum(xs) / Math.max(1, xs.length);

console.log('== injuries ==');
injuryWeeks.sort((a, b) => a - b);
console.log(`  incidents ${injuryWeeks.length} over ${perSeason.length} player-seasons = ${(injuryWeeks.length / perSeason.length).toFixed(2)} per season`);
console.log(`  weeks out: mean ${avg(injuryWeeks).toFixed(1)} median ${injuryWeeks[Math.floor(injuryWeeks.length / 2)]} p90 ${injuryWeeks[Math.floor(injuryWeeks.length * 0.9)]} max ${injuryWeeks.at(-1)}`);
console.log(`  weeks lost per season: ${(sum(injuryWeeks) / perSeason.length).toFixed(1)}`);

console.log('== availability (club competitive matches) ==');
const totalClub = sum(perSeason.map((r) => r.clubMatches));
console.log(`  played ${(100 * sum(perSeason.map((r) => r.apps)) / totalClub).toFixed(1)}%` +
  `  injured ${(100 * sum(perSeason.map((r) => r.missedInjury)) / totalClub).toFixed(1)}%` +
  `  not selected ${(100 * sum(perSeason.map((r) => r.missedNotSelected)) / totalClub).toFixed(1)}%` +
  `  suspended ${(100 * sum(perSeason.map((r) => r.missedSuspended)) / totalClub).toFixed(1)}%`);

console.log('== ovr by age ==');
for (const age of [...ovrByAge.keys()].sort((a, b) => a - b)) {
  const xs = ovrByAge.get(age)!;
  if (xs.length < 5) continue;
  console.log(`  ${age}: mean ${avg(xs).toFixed(1)} (n=${xs.length})`);
}

console.log('== career grades ==');
for (const s of scores.sort((a, b) => b.score - a.score)) {
  console.log(`  score ${s.score} = ${s.status} (peak ovr ${s.peakOvr}, ${s.apps} apps, ${s.trophies} trophies)`);
}

console.log('== market ==');
console.log(`  transfer offers received per season: ${(sum(offersPerSeason) || 0) / Math.max(1, offersPerSeason.length) || 'n/a'}`);
const wageBands = new Map<number, number[]>();
for (const [ovr, wage] of wageByOvr) {
  const band = Math.round(ovr / 5) * 5;
  const list = wageBands.get(band) ?? [];
  list.push(wage);
  wageBands.set(band, list);
}
for (const band of [...wageBands.keys()].sort((a, b) => a - b)) {
  const xs = wageBands.get(band)!;
  if (xs.length < 20) continue;
  console.log(`  ovr ~${band}: median weekly wage EUR ${xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!.toLocaleString()}`);
}
