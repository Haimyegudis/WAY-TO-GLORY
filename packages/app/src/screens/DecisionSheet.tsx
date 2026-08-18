import type { PendingDecision } from '@fc/engine';
import { expectedMinutesFor } from '@fc/engine';
import { formatMoney, useLang, useT } from '../i18n/index.js';
import { competitionName } from '../lib/names.js';
import { getPack, useGame } from '../state/store.js';
import { clubName } from '../lib/club.js';
import { toHebrew } from '../lib/transliterate.js';
import { Chip, Crest } from '../components/ui.js';
import { clubColor } from '../lib/club.js';

/**
 * Everything that needs an answer arrives here: a dressing-room moment, a club
 * that wants to sign him, an agent who wants to represent him. Risk is described,
 * never quantified.
 */
export function DecisionSheet({ decision }: { decision: PendingDecision }) {
  if (decision.kind === 'transfer') return <OfferSheet decision={decision} />;
  if (decision.kind === 'agent') return <AgentSheet decision={decision} />;
  return <EventSheet decision={decision} />;
}

function SheetShell({ category, title, children }: { category: string; title: string; children: React.ReactNode }) {
  return (
    <div className="sheet-backdrop">
      <div className="sheet">
        <div className="sheet-grip" />
        <p className="eyebrow" style={{ color: 'var(--amber)' }}>{category}</p>
        <h2 className="headline" style={{ marginBlock: '8px 16px' }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function EventSheet({ decision }: { decision: PendingDecision }) {
  const t = useT();
  const decide = useGame((s) => s.decide);

  return (
    <SheetShell category={t(`category.${decision.category}`)} title={t(decision.textKey, decision.textArgs)}>
      <div className="stack" style={{ gap: 9 }}>
        {decision.options.map((option, i) => (
          <button
            key={option.id}
            className="option"
            style={{ animation: 'rise 0.3s ease both', animationDelay: `${70 + i * 55}ms` }}
            onClick={() => decide(decision.id, option.id)}
          >
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t(`${decision.textKey}.${option.id}`)}</span>
            {option.riskKey && (
              <span className={`risk ${riskClass(option.riskKey)}`} style={{ display: 'block', marginBlockStart: 5 }}>
                {t(option.riskKey)}
              </span>
            )}
          </button>
        ))}
      </div>
    </SheetShell>
  );
}

function OfferSheet({ decision }: { decision: PendingDecision }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const answerOffer = useGame((s) => s.answerOffer);
  const pack = getPack();

  const competition = (id: string) => competitionName(pack.competitions.find((c) => c.id === id), lang) || id;
  const offers = decision.offers ?? [];

  return (
    <SheetShell category={t('category.transfer')} title={t(decision.textKey)}>
      <div className="offer-grid">
        {offers.map((offer, i) => {
          const club = state.world.clubs[offer.clubId];
          const minutes = Math.round((offer.expectedMinutesPct ?? expectedMinutesFor(offer.squadRole)) * 100);
          const roleTone = minutes >= 65 ? 'solid-green' : minutes >= 40 ? 'amber' : 'red';
          return (
            <button
              key={offer.id}
              className={`offer ${i === 0 ? 'offer-featured' : ''}`}
              style={{ background: `linear-gradient(160deg, ${clubColor(club)}33, var(--surface-2) 62%)` }}
              onClick={() => answerOffer(decision.id, offer.id)}
            >
              <span className="offer-sub">{offer.isLoan ? t('market.loan') : t('market.transfer')}</span>
              <Crest club={club} size="lg" />
              <span className="offer-title">{clubName(club, lang)}</span>
              <span className="offer-sub">{competition(offer.competitionId)}</span>
              <Chip tone={roleTone}>{t(`role.${offer.squadRole}`)}</Chip>
              <span className="offer-sub num">{formatMoney(offer.salaryPerWeek, lang)} / {t('market.week')}</span>
              <span className="offer-sub">{t('market.expectedMinutes')}: {minutes}%</span>
            </button>
          );
        })}
      </div>

      <button className="btn btn-block" style={{ marginBlockStart: 12 }} onClick={() => answerOffer(decision.id, null)}>
        {t('decision.stay')}
      </button>
    </SheetShell>
  );
}

function AgentSheet({ decision }: { decision: PendingDecision }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const answerAgent = useGame((s) => s.answerAgent);
  const agents = decision.agents ?? [];

  return (
    <SheetShell category={t('category.agent')} title={t(decision.textKey)}>
      <div className="stack" style={{ gap: 9 }}>
        {agents.map((agent) => (
          <button key={agent.id} className="option" onClick={() => answerAgent(decision.id, agent.id)}>
            <div className="row-between">
              <span style={{ fontSize: 15, fontWeight: 700 }}>{lang === 'he' ? toHebrew(agent.name) : agent.name}</span>
              <Chip tone="amber">{t(`agent.tier.${agent.tier}`)}</Chip>
            </div>
            <p className="faint" style={{ fontSize: 12, marginBlockStart: 5 }}>
              {t('market.connections')} {agent.connections} · {t('market.negotiation')} {agent.negotiation} · {t('market.network')} {agent.internationalNetwork}
            </p>
            <p className="faint" style={{ fontSize: 12, marginBlockStart: 3 }}>
              {t('market.commission', { pct: (agent.commissionPct * 100).toFixed(1) })} · {agent.countries.join(' · ')}
            </p>
          </button>
        ))}
      </div>

      <button className="btn btn-block" style={{ marginBlockStart: 12 }} onClick={() => answerAgent(decision.id, null)}>
        {t('decision.noAgent')}
      </button>
    </SheetShell>
  );
}

function riskClass(key: string): string {
  if (key.endsWith('high')) return 'risk-high';
  if (key.endsWith('medium')) return 'risk-medium';
  return 'risk-low';
}
