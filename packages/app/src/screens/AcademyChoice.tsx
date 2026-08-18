import { useT } from '../i18n/index.js';
import { getPack, useGame } from '../state/store.js';
import { Meter, Panel } from '../components/ui.js';

export function AcademyChoice() {
  const t = useT();
  const offers = useGame((s) => s.academyOffers);
  const choose = useGame((s) => s.chooseAcademy);
  const pack = getPack();

  const competitionName = (id: string) => pack.competitions.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="app">
      <div className="screen stack" style={{ paddingBottom: 40 }}>
        <header>
          <p className="eyebrow" dir="ltr">2025 / 26</p>
          <h1 className="display" style={{ fontSize: 30, marginBlockStart: 6 }}>{t('academy.title')}</h1>
          <p className="muted" style={{ marginBlockStart: 8, fontSize: 13.5 }}>{t('academy.intro')}</p>
        </header>

        {offers.map((offer) => (
          <Panel key={offer.clubId}>
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 className="display" style={{ fontSize: 19 }}>{offer.clubName}</h3>
                <p className="faint" style={{ fontSize: 12, marginBlockStart: 2 }}>
                  {competitionName(offer.competitionId)} · {t('academy.tier', { tier: offer.tier })}
                </p>
              </div>
              <div className="num" style={{ color: 'var(--flood)', fontSize: 15 }}>
                {'★'.repeat(offer.academyStars)}
                <span className="faint">{'★'.repeat(5 - offer.academyStars)}</span>
              </div>
            </div>

            <div className="stack" style={{ gap: 8, marginBlock: '12px 14px' }}>
              <Line label={t('academy.development')} value={offer.developmentQuality} tone="flood" />
              <Line label={t('academy.competition')} value={offer.competitionForPlace} tone="blood" />
              <Line label={t('academy.firstTeam')} value={offer.firstTeamChance} tone="sky" />
              <Line label={t('academy.reputation')} value={offer.reputation} tone="amber" />
            </div>

            <button className="btn btn-primary btn-block" onClick={() => choose(offer.clubId)}>
              {t('academy.join')}
            </button>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: number; tone: 'flood' | 'amber' | 'blood' | 'sky' }) {
  return (
    <div>
      <div className="row-between" style={{ marginBlockEnd: 4 }}>
        <span className="eyebrow">{label}</span>
        <span className="num" style={{ fontSize: 12 }}>{Math.round(value)}</span>
      </div>
      <Meter value={value} tone={tone} />
    </div>
  );
}
