/** Is asking for more worth it, and does it ever cost him the move? */
import { negotiate, CONTRACT_ASKS } from '../src/negotiate.js';
import { Rng } from '../src/rng.js';
import type { TransferOffer } from '../src/types.js';

const base = (interest: number): TransferOffer => ({
  id: 'o', clubId: 'c', fee: 4_000_000, salaryPerWeek: 20_000, years: 3,
  squadRole: 'rotation', expectedMinutesPct: 0.45, isLoan: false,
  season: 2025, week: 4, interestLevel: interest, competitionId: 'en.1',
});

for (const interest of [50, 70, 90]) {
  let agreed = 0, withdrawn = 0, wage = 0;
  const runs = 2000;
  for (let i = 0; i < runs; i++) {
    const rng = new Rng(i + interest * 1000);
    let offer = base(interest);
    // He asks twice, which is what a player with an agent actually does.
    for (let ask = 0; ask < 2; ask++) {
      const which = CONTRACT_ASKS[rng.int(0, CONTRACT_ASKS.length - 1)]!;
      const out = negotiate(
        { rng, offer, agent: null, ovr: 70, clubLevel: 72, form: 60, reputation: 55, rivalOffers: 1 },
        which,
      );
      if (out.agreed) agreed++;
      if (out.withdrawn) { withdrawn++; break; }
      offer = out.offer;
    }
    wage += offer.salaryPerWeek;
  }
  console.log(
    `interest ${interest}: agreed ${(agreed / (runs * 2) * 100).toFixed(0)}%  offer withdrawn ${(withdrawn / runs * 100).toFixed(1)}%  average wage ${Math.round(wage / runs).toLocaleString()}`,
  );
}
