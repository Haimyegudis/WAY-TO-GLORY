import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataPack } from '../src/data.js';
import { createCareer, getAcademyOffers, joinClub, type CreateCareerInput } from '../src/career.js';

const here = dirname(fileURLToPath(import.meta.url));
const packPath = join(here, '..', '..', 'data', 'packs', 'pack.json');

let cached: DataPack | null = null;

export function loadPack(): DataPack {
  if (!cached) cached = JSON.parse(readFileSync(packPath, 'utf8')) as DataPack;
  return cached;
}

export const DEFAULT_INPUT: CreateCareerInput = {
  firstName: 'Haim',
  lastName: 'Yegudis',
  birthCountry: 'ISR',
  age: 15,
  heightCm: 178,
  weightKg: 70,
  foot: 'R',
  primaryPos: 'CAM',
  secondaryPos: ['CM'],
  startCountry: 'ISR',
  seed: 4242,
};

/** A career that has already picked an academy, ready to be ticked. */
export function startedCareer(overrides: Partial<CreateCareerInput> = {}, academyIndex = 2) {
  const pack = loadPack();
  const { state, index } = createCareer(pack, { ...DEFAULT_INPUT, ...overrides });
  const offers = getAcademyOffers(state, index);
  const offer = offers[Math.min(academyIndex, offers.length - 1)]!;
  joinClub(state, index, offer.clubId, { asAcademy: true });
  return { state, index, offers };
}
