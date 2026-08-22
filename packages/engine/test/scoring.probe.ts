/**
 * How many he scores, at a given level, in a given side, against a given opponent.
 *
 * The one number a career game cannot get wrong. A very good forward is on 0.6 a game;
 * a great one in a weak league might reach 0.9. Two a game is a video game.
 */
import { simulateUserMatch, simulateQuickResult } from '../src/match.js';
import { pickBestLineup, resolveMinutes } from '../src/selection.js';
import { generatePlayer, generateSquad } from '../src/generate.js';
import { indexPack } from '../src/data.js';
import { Rng } from '../src/rng.js';
import { loadPack } from './helpers.js';
import type { Club, Player } from '../src/types.js';

const pack = loadPack();
const index = indexPack(pack);

function clubOf(id: string): Club {
  const club = index.clubById.get(id);
  if (!club) throw new Error(`no club ${id}`);
  return club;
}

function run(label: string, ovr: number, clubId: string, opponentId: string, matches = 300) {
  const rng = new Rng(9);
  const home = clubOf(clubId);
  const away = clubOf(opponentId);
  const user = generatePlayer(rng, index, {
    clubId: home.id, pos: 'ST', age: 22, targetOvr: ovr, season: 2026,
    countryCode: home.country, squadRole: 'key',
  });
  user.isUser = true;
  const squad: Player[] = [
    ...generateSquad(rng, { club: home, season: 2026, index, stars: index.starsByClub.get(home.id) ?? [], taken: new Set() }),
    user,
  ];
  const opponents = generateSquad(rng, {
    club: away, season: 2026, index, stars: index.starsByClub.get(away.id) ?? [], taken: new Set(),
  });

  const lineup = pickBestLineup(new Rng(3), squad, {
    formation: '4-3-3', managerTrust: 80, userId: user.id, rotationPressure: 0, importantMatch: false,
  });
  const slot = lineup.starters.find((entry) => entry.playerId === user.id)?.slot ?? 'bench';
  let goals = 0, shots = 0, teamGoals = 0, hauls = 0, rating = 0, played = 0, assists = 0;
  for (let i = 0; i < matches; i++) {
    const result = simulateUserMatch(new Rng(1000 + i), {
      season: 2026,
      week: 10,
      competitionId: home.competitionId,
      homeClub: home,
      awayClub: away,
      userIsHome: true,
      userClubSquad: squad,
      opponentStars: opponents.slice(0, 11),
      opponentRating: 30 + away.strength * 0.62,
      user,
      lineup,
      minutes: resolveMinutes(new Rng(500 + i), user.id, lineup, user),
      importance: 'normal',
      matchId: `probe_${i}`,
      mental: 1,
      penaltyTaker: true,
    });
    const line = result.line;
    if (!line?.played) continue;
    played++;
    goals += line.goals;
    shots += line.shots;
    rating += line.rating;
    assists += line.assists;
    if (line.goals >= 3) hauls++;
    teamGoals += result.result.homeGoals;
  }
  const n = Math.max(1, played);
  console.log(
    `${label.padEnd(30)} ovr ${ovr} ${String(slot).padEnd(4)} ${(goals / n).toFixed(2)} goals  ${(assists / n).toFixed(2)} assists  ${(shots / n).toFixed(1)} shots  `
    + `side ${(teamGoals / n).toFixed(2)}  his share ${(100 * goals / Math.max(0.01, teamGoals)).toFixed(0)}%  hats ${(100 * hauls / n).toFixed(1)}%  rating ${(rating / n).toFixed(2)}`,
  );
}

// A very good forward in a strong side against a weak one, which is the case that broke.
run('Dynamo Kyiv v a weak side', 79, 'ukr_dynamo_kyiv', 'ukr_kolos_kovalivka');
run('Dynamo Kyiv v a weak side', 88, 'ukr_dynamo_kyiv', 'ukr_kolos_kovalivka');
run('Dynamo Kyiv v the best of them', 79, 'ukr_dynamo_kyiv', 'ukr_bukovyna_chernivtsi');
run('a mid Israeli side v a mid one', 68, 'isr_hapoel_hadera', 'isr_maccabi_netanya');
run('Real Madrid v a weak side', 88, 'esp_real_madrid_cf', 'esp_getafe_cf');

// And the scoreline the rest of the league produces, by how far apart the sides are.
console.log('quick results, by rating gap:');
for (const gap of [0, 5, 10, 15, 20, 25]) {
  const rng = new Rng(77);
  let home = 0, away = 0, big = 0;
  const n = 2000;
  for (let i = 0; i < n; i++) {
    const [h, a] = simulateQuickResult(rng, { homeRating: 60 + gap, awayRating: 60 });
    home += h; away += a;
    if (h - a >= 4) big++;
  }
  console.log(`  +${String(gap).padStart(2)}  ${(home / n).toFixed(2)} - ${(away / n).toFixed(2)}   four-goal wins ${(100 * big / n).toFixed(1)}%`);
}
