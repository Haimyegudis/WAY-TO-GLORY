import { useEffect } from 'react';
import { useLang, useT } from '../i18n/index.js';
import { competitionLabel, competitionName } from '../lib/names.js';
import { clubName } from '../lib/club.js';
import { getPack, useGame } from '../state/store.js';
import { ClubCard, Crest, Meter } from '../components/ui.js';

export function AcademyChoice() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const offers = useGame((s) => s.academyOffers);
  const choose = useGame((s) => s.chooseAcademy);
  const reopenCreation = useGame((s) => s.reopenCreation);
  const setBackHandler = useGame((s) => s.setBackHandler);
  const pack = getPack();

  // These offers are the country, the league and the player he described. Going back is
  // how he changes any of it, so the gesture returns to the form rather than meaning
  // nothing here - nothing has been saved yet, so there is nothing to lose by it.
  useEffect(() => {
    setBackHandler(() => {
      reopenCreation();
      return true;
    });
    return () => setBackHandler(null);
  }, [setBackHandler, reopenCreation]);

  const competition = (id: string) => competitionLabel(id, pack, lang, t);

  return (
    <>
      <div className="device-frame">
        <img src="/bg/stadium.jpg" alt="" className="backdrop-photo" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,11,24,0.78), rgba(6,11,24,0.9) 55%, rgba(5,9,20,0.95))' }} />
      </div>
      <div className="app">
      <div className="screen stack" style={{ paddingBottom: 40 }}>
        <header>
          <p className="eyebrow" dir="ltr">2025 / 26</p>
          <button className="eyebrow" onClick={reopenCreation}>← {t('academy.changeDetails')}</button>
          <h1 className="title">{t('academy.title')}</h1>
          <p className="muted" style={{ marginBlockStart: 8, fontSize: 13.5 }}>{t('academy.intro')}</p>
        </header>

        {offers.map((offer) => (
          <ClubCard key={offer.clubId} club={state.world.clubs[offer.clubId]}>
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <div className="row" style={{ gap: 10, minWidth: 0 }}>
                <Crest club={state.world.clubs[offer.clubId]} size="lg" />
                <div style={{ minWidth: 0 }}>
                <h3 className="headline">{clubName(state.world.clubs[offer.clubId], lang)}</h3>
                <p className="faint" style={{ fontSize: 12, marginBlockStart: 2 }}>
                  {competition(offer.competitionId)} · {t('academy.tier', { tier: offer.tier })}
                  </p>
                </div>
              </div>
              <div className="num" style={{ color: 'var(--amber)', fontSize: 15 }}>
                {'★'.repeat(offer.academyStars)}
                <span className="faint">{'★'.repeat(5 - offer.academyStars)}</span>
              </div>
            </div>

            <div className="stack" style={{ gap: 8, marginBlock: '12px 14px' }}>
              <Line label={t('academy.development')} value={offer.developmentQuality} tone="amber" />
              <Line label={t('academy.competition')} value={offer.competitionForPlace} tone="red" />
              <Line label={t('academy.firstTeam')} value={offer.firstTeamChance} tone="blue" />
              <Line label={t('academy.reputation')} value={offer.reputation} tone="amber" />
            </div>

            <button className="btn btn-primary btn-block" onClick={() => choose(offer.clubId)}>
              {t('academy.join')}
            </button>
          </ClubCard>
        ))}
      </div>
    </div>
    </>
  );
}

function Line({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'amber' | 'red' | 'blue' | 'green' }) {
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
