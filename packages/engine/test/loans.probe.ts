/** Does a youngster at a big club get loaned out to play? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';

// Academy index 0 is the strongest club that offered.
const { state, index } = startedCareer({ seed: 88, startCountry: 'ENG' }, 0);
console.log('joined', state.world.clubs[state.player.clubId!]?.name);

let loanOffers = 0;
let normalOffers = 0;
const seasons: string[] = [];
let lastSeason = state.world.season;

for (let i = 0; i < 53 * 8; i++) {
  advanceWeek(state, index);
  for (const offer of state.transferOffers) {
    if (offer.isLoan) loanOffers++;
    else normalOffers++;
  }
  // Accept a loan whenever one is on the table, the way a stuck youngster would.
  const loan = state.transferOffers.find((o) => o.isLoan);
  if (loan) {
    const { acceptOffer } = await import('../src/career.js');
    acceptOffer(state, index, loan.id);
  }
  if (state.world.season !== lastSeason) {
    const record = state.seasonHistory.at(-1);
    const club = record?.clubId ? state.world.clubs[record.clubId]?.name : '-';
    seasons.push(`${lastSeason}: ${club} ${record?.apps ?? 0} apps, ovr ${record?.ovrEnd ?? 0}${record?.onLoanFrom ? ' (loan)' : ''}`);
    lastSeason = state.world.season;
  }
}
console.log(seasons.join('\n'));
console.log('loan offers seen', loanOffers, 'normal', normalOffers);
console.log('listed:', state.flags['transferListed'], 'inbox free-to-leave:',
  state.inbox.filter((m) => m.titleKey === 'inbox.freeToLeave').length);
