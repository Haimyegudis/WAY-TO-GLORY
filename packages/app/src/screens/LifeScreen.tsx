import { LIFE_CATEGORIES, LIFE_ITEMS, canBuy, itemById, type LifeItem } from '@fc/engine';
import { formatMoney, useLang, useT } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { Card, Chip, Empty, Stat } from '../components/ui.js';

/**
 * The half of the career that is not the football.
 *
 * Money, fame and a personality all existed and none of them had anywhere to go: the
 * balance went up every week and sat there. This is where it goes - what he is paid to
 * put his name on, what he owns, and what all of it costs to keep every week - so that
 * a wage is a thing he spends rather than a number that grows.
 */
export function LifeScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const goto = useGame((s) => s.goto);
  const signSponsor = useGame((s) => s.signSponsor);
  const declineSponsors = useGame((s) => s.declineSponsors);
  const buy = useGame((s) => s.buyLifeItem);

  const life = state.life ?? { sponsors: [], owned: [], offers: [] };
  const weeklyIn = life.sponsors.reduce((sum, deal) => sum + deal.weekly, 0);
  const weeklyOut = life.owned.reduce((sum, id) => sum + (itemById(id)?.weekly?.upkeep ?? 0), 0);
  const wage = state.contract?.salaryPerWeek ?? 0;

  return (
    <div className="screen stack">
      <header className="row-between">
        <div>
          <p className="eyebrow">{t('life.title')}</p>
          <h1 className="title">{formatMoney(state.finances.balance, lang)}</h1>
        </div>
        <button className="eyebrow" onClick={() => goto('career')}>← {t('career.title')}</button>
      </header>

      <Card>
        <div className="statrow">
          <Stat label={t('life.wage')} value={<span style={{ fontSize: 14 }}>{formatMoney(wage, lang)}</span>} />
          <Stat label={t('life.sponsorIncome')} value={<span style={{ fontSize: 14 }}>{formatMoney(weeklyIn, lang)}</span>} />
          <Stat label={t('life.upkeep')} value={<span style={{ fontSize: 14 }}>{formatMoney(weeklyOut, lang)}</span>} />
          <Stat label={t('life.fame')} value={Math.round(state.player.fame)} />
        </div>
      </Card>

      {life.offers.length > 0 && (
        <Card title={t('life.offers')}>
          <div className="stack" style={{ gap: 8 }}>
            {life.offers.map((offer) => (
              <button key={offer.id} className="option" onClick={() => signSponsor(offer.id)}>
                <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t(`life.sponsor.${offer.kind}`)}</span>
                <span className="risk risk-good" style={{ display: 'block', marginBlockStart: 5 }}>
                  {t('life.offerTerms', {
                    weekly: formatMoney(offer.weekly, lang),
                    seasons: offer.seasons,
                  })}
                </span>
              </button>
            ))}
            <button className="btn btn-quiet btn-block" onClick={() => declineSponsors()}>
              {t('life.declineAll')}
            </button>
          </div>
        </Card>
      )}

      <Card title={t('life.sponsors')}>
        {life.sponsors.length === 0 ? (
          <Empty>{t('life.noSponsors')}</Empty>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {life.sponsors.map((deal) => (
              <div key={deal.id} className="row-between">
                <span style={{ fontSize: 14 }}>{t(`life.sponsor.${deal.kind}`)}</span>
                <span className="row" style={{ gap: 8 }}>
                  <span className="num" style={{ fontSize: 12 }}>{formatMoney(deal.weekly, lang)}</span>
                  <Chip>
                    {t('life.until', { season: deal.signedSeason + deal.seasons })}
                  </Chip>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/*
        * The shop, shelf by shelf.
        *
        * Things are grouped by what they are and then by what they cost, because the
        * choice a player actually makes is between two things at the same price: the
        * coupe or the estate, the sailing yacht or the motor one. A photograph of each,
        * because a car nobody can see is a line of text with a number next to it.
        */}
      {LIFE_CATEGORIES.map((category) => {
        const items = LIFE_ITEMS.filter((item) => item.category === category);
        if (items.length === 0) return null;
        const bands = [...new Set(items.map((item) => item.cost))].sort((a, b) => a - b);

        return (
          <Card key={category} title={t(`life.category.${category}`)}>
            <div className="stack" style={{ gap: 14 }}>
              {bands.map((cost) => {
                const band = items.filter((item) => item.cost === cost);
                return (
                  <div key={cost} className="stack" style={{ gap: 7 }}>
                    <div className="row-between">
                      <span className="eyebrow num">{formatMoney(cost, lang)}</span>
                      {band.length > 1 && <span className="faint" style={{ fontSize: 11 }}>{t('life.sameMoney')}</span>}
                    </div>
                    <div className="life-shelf">
                      {band.map((item) => (
                        <LifeCard
                          key={item.id}
                          item={item}
                          verdict={canBuy(state, item.id)}
                          onBuy={() => buy(item.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <p className="faint" style={{ fontSize: 10.5, textAlign: 'center' }}>{t('life.photoCredit')}</p>
    </div>
  );
}

/** One thing he can buy, with a picture of it. */
function LifeCard({
  item,
  verdict,
  onBuy,
}: {
  item: LifeItem;
  verdict: ReturnType<typeof canBuy>;
  onBuy: () => void;
}) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const owned = verdict === 'owned';

  return (
    <button
      className={`life-card ${owned ? 'life-card-owned' : ''}`}
      disabled={verdict !== 'yes'}
      onClick={onBuy}
    >
      <span className="life-photo">
        <img src={`/life/${item.id}.jpg`} alt="" loading="lazy" />
        {owned && <span className="life-owned-tag">{t('life.owned')}</span>}
      </span>
      <span className="life-card-body">
        <span className="life-card-title">{t(`life.item.${item.id}`)}</span>
        <span className="risk" style={{ display: 'block' }}>{t(`life.item.${item.id}.desc`)}</span>
        {verdict === 'fame' && (
          <span className="risk risk-bad" style={{ display: 'block' }}>
            {t('life.needsFame', { fame: item.needsFame ?? 0 })}
          </span>
        )}
        {verdict === 'money' && (
          <span className="risk risk-bad" style={{ display: 'block' }}>{t('life.needsMoney')}</span>
        )}
        {item.weekly?.upkeep ? (
          <span className="faint" style={{ display: 'block', fontSize: 11 }}>
            {t('life.upkeepLine', { cost: formatMoney(item.weekly.upkeep, lang) })}
          </span>
        ) : null}
      </span>
    </button>
  );
}
