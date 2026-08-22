/**
 * Who is scoring in the leagues nobody is simulating player by player.
 *
 * Only his own division has real squads - everywhere else a fixture is two numbers, and
 * the scoring chart for Spain was an empty page. A player who follows football knows
 * roughly who is top scorer in the leagues he does not play in, and a world where that
 * page is blank is a world with one league in it.
 *
 * So the chart is estimated from what the world already knows: the goals the club has
 * actually scored this season, shared out among the names the data pack carries for it.
 * It adds up to the table, which is the part that matters - a side that has scored eleven
 * all year cannot have a striker on twenty.
 */
import { clamp, hashString } from './rng.js';
import type { PackIndex, StarPlayerSeed } from './data.js';
import type { CareerState, Position } from './types.js';

export interface ChartRow {
  playerId: string;
  name: string;
  clubId: string;
  goals: number;
}

/** How much of a side's scoring a man in this position takes. */
const POSITION_SHARE: Record<Position, number> = {
  ST: 1, CF: 0.95, RW: 0.7, LW: 0.7, CAM: 0.58,
  CM: 0.28, RM: 0.3, LM: 0.3, CDM: 0.11,
  CB: 0.12, RB: 0.07, LB: 0.07, RWB: 0.08, LWB: 0.08,
  GK: 0,
};

/**
 * The share of a club's goals that goes to men the pack actually names. The rest belong
 * to the squad players nobody has heard of, who between them score a third of any
 * league's goals.
 */
const NAMED_SHARE = 0.64;

function weightOf(star: StarPlayerSeed): number {
  return (POSITION_SHARE[star.pos] ?? 0.1) * clamp((star.ovr - 55) / 25, 0.3, 2);
}

/**
 * A steady wobble, so the same striker is not always on exactly his club's share and the
 * chart does not read like arithmetic. Fixed for the season, so it does not jump between
 * one visit to the page and the next.
 */
function wobble(competitionId: string, season: number, star: StarPlayerSeed): number {
  const hash = hashString(`${competitionId}:${season}:${star.clubId}:${star.firstName}${star.lastName}`);
  return 0.72 + (hash % 1000) / 1000 * 0.56;
}

/**
 * The scoring chart for a division the game is not modelling in detail.
 *
 * Returns nothing for his own league: that one has real names and real goals, and an
 * estimate over the top of them would be a worse chart, not a better one.
 */
export function estimatedScorers(
  state: CareerState,
  index: PackIndex,
  competitionId: string,
  limit = 15,
): ChartRow[] {
  const comp = state.world.competitions[competitionId];
  if (!comp) return [];
  const season = comp.season;

  const rows: ChartRow[] = [];
  for (const clubId of comp.clubIds) {
    const row = comp.table[clubId];
    if (!row || row.goalsFor <= 0) continue;
    const stars = (index.starsByClub.get(clubId) ?? []).slice(0, 6);
    if (stars.length === 0) continue;

    const weights = stars.map((star) => weightOf(star) * wobble(competitionId, season, star));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) continue;

    stars.forEach((star, i) => {
      const goals = Math.round(row.goalsFor * NAMED_SHARE * (weights[i]! / total));
      if (goals <= 0) return;
      rows.push({
        playerId: `star:${clubId}:${star.firstName} ${star.lastName}`,
        name: `${star.firstName} ${star.lastName}`,
        clubId,
        goals,
      });
    });
  }

  return rows.sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)).slice(0, limit);
}
