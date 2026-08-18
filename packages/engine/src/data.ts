import type { CareerEventDef, Club, Competition, Country, Foot, Position } from './types.js';

export interface NamePool {
  locale: string;
  first: string[];
  last: string[];
}

/** A real, named player shipped in the data pack for one of the bigger clubs. */
export interface StarPlayerSeed {
  clubId: string;
  firstName: string;
  lastName: string;
  pos: Position;
  ovr: number;
  age: number;
  country: string;
  foot?: Foot;
  potential?: number;
}

export interface DataPack {
  version: string;
  season: number;
  countries: Country[];
  competitions: Competition[];
  clubs: Club[];
  names: NamePool[];
  stars: StarPlayerSeed[];
  events: CareerEventDef[];
}

export interface PackIndex {
  pack: DataPack;
  countryByCode: Map<string, Country>;
  competitionById: Map<string, Competition>;
  clubById: Map<string, Club>;
  clubsByCompetition: Map<string, Club[]>;
  namesByLocale: Map<string, NamePool>;
  starsByClub: Map<string, StarPlayerSeed[]>;
}

export function indexPack(pack: DataPack): PackIndex {
  const countryByCode = new Map(pack.countries.map((c) => [c.code, c]));
  const competitionById = new Map(pack.competitions.map((c) => [c.id, c]));
  const clubById = new Map(pack.clubs.map((c) => [c.id, c]));

  const clubsByCompetition = new Map<string, Club[]>();
  for (const club of pack.clubs) {
    const list = clubsByCompetition.get(club.competitionId);
    if (list) list.push(club);
    else clubsByCompetition.set(club.competitionId, [club]);
  }

  const namesByLocale = new Map(pack.names.map((n) => [n.locale, n]));

  const starsByClub = new Map<string, StarPlayerSeed[]>();
  for (const star of pack.stars) {
    const list = starsByClub.get(star.clubId);
    if (list) list.push(star);
    else starsByClub.set(star.clubId, [star]);
  }

  return { pack, countryByCode, competitionById, clubById, clubsByCompetition, namesByLocale, starsByClub };
}

export interface PackProblem {
  level: 'error' | 'warning';
  message: string;
}

/** Catches the data mistakes that would otherwise surface as a broken career in season 7. */
export function validatePack(pack: DataPack): PackProblem[] {
  const problems: PackProblem[] = [];
  const compIds = new Set(pack.competitions.map((c) => c.id));
  const clubIds = new Set<string>();

  for (const club of pack.clubs) {
    if (clubIds.has(club.id)) problems.push({ level: 'error', message: `duplicate club id: ${club.id}` });
    clubIds.add(club.id);
    if (!compIds.has(club.competitionId)) {
      problems.push({ level: 'error', message: `club ${club.id} points at unknown competition ${club.competitionId}` });
    }
  }

  for (const comp of pack.competitions) {
    const clubs = pack.clubs.filter((c) => c.competitionId === comp.id);
    const expected = comp.teams;
    if (clubs.length !== expected) {
      problems.push({
        level: clubs.length === 0 ? 'error' : 'warning',
        message: `competition ${comp.id} declares ${expected} teams but has ${clubs.length} clubs`,
      });
    }
    if (comp.relegation?.to && !compIds.has(comp.relegation.to)) {
      problems.push({ level: 'error', message: `competition ${comp.id} relegates to unknown ${comp.relegation.to}` });
    }
    if (comp.promotion?.to && !compIds.has(comp.promotion.to)) {
      problems.push({ level: 'error', message: `competition ${comp.id} promotes to unknown ${comp.promotion.to}` });
    }
  }

  for (const country of pack.countries) {
    for (const id of country.competitionIds) {
      if (!compIds.has(id)) {
        problems.push({ level: 'error', message: `country ${country.code} lists unknown competition ${id}` });
      }
    }
    if (!pack.names.some((n) => n.locale === country.nameLocale)) {
      problems.push({ level: 'error', message: `country ${country.code} needs name pool ${country.nameLocale}` });
    }
  }

  for (const star of pack.stars) {
    if (!clubIds.has(star.clubId)) {
      problems.push({ level: 'warning', message: `star ${star.firstName} ${star.lastName} at unknown club ${star.clubId}` });
    }
  }

  return problems;
}
