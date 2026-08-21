import { useState } from 'react';
import type { ContractAsk, DecisionResult, EventEffect, PendingDecision, TransferOffer } from '@fc/engine';
import { CONTRACT_ASKS, expectedMinutesFor } from '@fc/engine';
import { formatMoney, hasTranslation, useLang, useT } from '../i18n/index.js';
import { competitionLabel, competitionName } from '../lib/names.js';
import { getPack, useGame } from '../state/store.js';
import { clubName } from '../lib/club.js';
import { toHebrew } from '../lib/transliterate.js';
import { Chip, Crest } from '../components/ui.js';
import { clubColor } from '../lib/club.js';
import { DecisionResultContent } from './ResultSheet.js';

/**
 * Everything that needs an answer arrives here: a dressing-room moment, a club
 * that wants to sign him, an agent who wants to represent him. Risk is described,
 * never quantified.
 */
export function DecisionSheet({ decision, result }: { decision: PendingDecision; result?: DecisionResult | null }) {
  if (!result && decision.kind === 'transfer') return <OfferSheet decision={decision} />;
  if (!result && decision.kind === 'agent') return <AgentSheet decision={decision} />;
  return <EventSheet decision={decision} result={result} />;
}

function SheetShell({ category, title, children }: { category: string; title: string; children: React.ReactNode }) {
  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" />
        <p className="eyebrow" style={{ color: 'var(--amber)' }}>{category}</p>
        <h2 className="headline" style={{ marginBlock: '8px 16px' }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/**
 * The answers themselves. The same buttons serve the sheet that stops his week and the
 * message he opens in his own time, because it is the same question either way.
 */
export function DecisionOptions({ decision }: { decision: PendingDecision }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const decide = useGame((s) => s.decide);
  const answer = (optionId: string) => {
    // The store settles the linked message and keeps this interaction alive in its
    // consequence phase. Calling the popup's generic dismiss action here could skip
    // the next queued message after the linked one has already been removed.
    decide(decision.id, optionId);
  };

  return (
    <div className="stack" style={{ gap: 9 }}>
      {decision.options.map((option, i) => (
        <button
          key={option.id}
          className="option"
          style={{ animation: 'rise 0.3s ease both', animationDelay: `${70 + i * 55}ms` }}
          onClick={() => answer(option.id)}
        >
          {/* A pack event names its options by convention - the question's key plus the
              option's id - but a question the engine builds carries its own label, and
              that one has to win or the button prints the raw id. */}
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>
            {option.labelKey && hasTranslation(lang, option.labelKey)
              ? t(option.labelKey)
              : t(`${decision.textKey}.${option.id}`)}
          </span>
          {option.riskKey && (
            <span className={`risk ${riskClass(option.riskKey)}`} style={{ display: 'block', marginBlockStart: 5 }}>
              {t(option.riskKey)}
            </span>
          )}
          <EffectPreview effects={option.effects} hasOutcomes={Boolean(option.outcomes?.length)} />
        </button>
      ))}
    </div>
  );
}

/**
 * The choice is written like dialogue, but the player should not have to reverse-engineer
 * dialogue to know what is at stake. These chips are deliberately directional rather
 * than numeric: they expose every system the option touches without turning a human
 * conversation into a spreadsheet or revealing a hidden probability.
 */
function EffectPreview({ effects, hasOutcomes }: { effects: EventEffect[]; hasOutcomes: boolean }) {
  const t = useT();
  const seen = new Set<string>();
  const rows = effects.flatMap((effect) => {
    const preview = previewEffect(effect, t);
    if (!preview || seen.has(preview.text)) return [];
    seen.add(preview.text);
    return [preview];
  });

  if (rows.length === 0 && !hasOutcomes) {
    return (
      <span className="row wrap" style={{ display: 'flex', gap: 5, marginBlockStart: 8 }}>
        <span className="choice-impact choice-impact-neutral">{t('impact.noImmediate')}</span>
      </span>
    );
  }
  return (
    <span className="row wrap" style={{ display: 'flex', gap: 5, marginBlockStart: 8 }}>
      {rows.map((row) => (
        <span
          key={row.text}
          className={`choice-impact choice-impact-${row.tone}`}
        >
          {row.text}
        </span>
      ))}
      {hasOutcomes && <span className="choice-impact choice-impact-risk">{t('impact.uncertain')}</span>}
    </span>
  );
}

function previewEffect(
  effect: EventEffect,
  t: (key: string, args?: Record<string, string | number>) => string,
): { text: string; tone: 'good' | 'bad' | 'neutral' } | null {
  const value = effect.value ?? 0;
  const chance = effect.chance !== undefined || effect.kind === 'injuryRisk';
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'changes';
  let key: string;
  let higherIsGood = true;

  switch (effect.kind) {
    case 'morale': key = 'change.morale'; break;
    case 'managerTrust': key = 'change.manager'; break;
    case 'relationship': key = `change.${effect.key ?? 'manager'}`; break;
    case 'form': key = 'change.form'; break;
    case 'fitness': key = 'change.fitness'; break;
    case 'fatigue': key = 'change.fatigue'; higherIsGood = false; break;
    case 'reputation': key = 'change.reputation'; break;
    case 'fame': key = 'change.fame'; break;
    case 'money': key = 'change.money'; break;
    case 'agentRelationship': key = 'change.agent'; break;
    case 'potential': key = 'change.potential'; break;
    case 'attribute': key = `attr.${effect.key ?? ''}`; break;
    case 'personality': key = `personality.${effect.key ?? ''}`; break;
    case 'injuryRisk':
      return { text: t('impact.injuryRisk'), tone: 'bad' };
    case 'squadRole':
      return { text: t('impact.squadRole'), tone: 'neutral' };
    case 'learnPosition':
      return { text: t('impact.newPosition'), tone: 'good' };
    case 'transferRequest':
      return { text: t('impact.transferRequest'), tone: 'neutral' };
    case 'custom':
      return { text: t(`impact.custom.${effect.key ?? 'career'}`), tone: 'neutral' };
  }

  const positive = direction === 'changes' ? null : (direction === 'up') === higherIsGood;
  const text = t(chance ? 'impact.mayChange' : `impact.${direction}`, { stat: t(key) });
  return { text, tone: positive === null ? 'neutral' : positive ? 'good' : 'bad' };
}

function EventSheet({ decision, result }: { decision: PendingDecision; result?: DecisionResult | null }) {
  const t = useT();

  return (
    <SheetShell category={t(`category.${decision.category}`)} title={t(decision.textKey, decision.textArgs)}>
      {result ? <DecisionResultContent result={result} /> : <DecisionOptions decision={decision} />}
    </SheetShell>
  );
}

function OfferSheet({ decision }: { decision: PendingDecision }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const answerOffer = useGame((s) => s.answerOffer);
  const pack = getPack();
  const [openOffer, setOpenOffer] = useState<string | null>(null);

  const competition = (id: string) => competitionLabel(id, pack, lang, t);
  const offers = decision.offers ?? [];
  const talking = offers.find((offer) => offer.id === openOffer);

  // One club at a time: the grid to choose from, then the terms of the one he is
  // actually talking to.
  if (talking) {
    return (
      <SheetShell category={t('category.transfer')} title={clubName(state.world.clubs[talking.clubId], lang)}>
        <OfferTerms offer={talking} onBack={() => setOpenOffer(null)} onSign={() => answerOffer(decision.id, talking.id)} />
      </SheetShell>
    );
  }

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
              onClick={() => setOpenOffer(offer.id)}
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

/**
 * The terms, and the chance to argue with them. Each ask is answered on the spot; the
 * club's patience is shown as words rather than a number, because nobody across a table
 * ever tells you the percentage.
 */
function OfferTerms({ offer, onBack, onSign }: { offer: TransferOffer; onBack: () => void; onSign: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const askForTerms = useGame((s) => s.askForTerms);
  const [said, setSaid] = useState<string | null>(null);

  const minutes = Math.round((offer.expectedMinutesPct ?? expectedMinutesFor(offer.squadRole)) * 100);
  const asks = offer.asksMade ?? 0;
  const patience = asks === 0 ? 'market.patience.fresh' : asks === 1 ? 'market.patience.thin' : 'market.patience.last';

  const ask = (which: ContractAsk) => {
    const outcome = askForTerms(offer.id, which);
    if (!outcome) return;
    setSaid(outcome.withdrawn ? 'market.ask.withdrawn' : outcome.agreed ? `market.ask.yes.${which}` : 'market.ask.no');
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      <ul className="list">
        <li className="list-item row-between">
          <span className="eyebrow">{t('market.wage')}</span>
          <span className="num">{formatMoney(offer.salaryPerWeek, lang)}</span>
        </li>
        <li className="list-item row-between">
          <span className="eyebrow">{t('market.role')}</span>
          <span>{t(`role.${offer.squadRole}`)} · {minutes}%</span>
        </li>
        <li className="list-item row-between">
          <span className="eyebrow">{t('market.contractLength')}</span>
          <span className="num">{offer.years}</span>
        </li>
        <li className="list-item row-between">
          <span className="eyebrow">{t('market.signingBonus')}</span>
          <span className="num">{offer.signingBonus ? formatMoney(offer.signingBonus, lang) : '—'}</span>
        </li>
        <li className="list-item row-between">
          <span className="eyebrow">{t('market.releaseClause')}</span>
          <span className="num">{offer.releaseClause ? formatMoney(offer.releaseClause, lang) : '—'}</span>
        </li>
      </ul>

      <p className="faint" style={{ fontSize: 11.5 }}>{t(patience)}</p>
      {said && <p style={{ fontSize: 13, color: 'var(--amber)' }}>{t(said)}</p>}

      <div className="row wrap" style={{ gap: 6 }}>
        {CONTRACT_ASKS.map((which) => (
          <button key={which} className="chip" onClick={() => ask(which)}>
            {t(`market.ask.${which}`)}
          </button>
        ))}
      </div>

      <button className="btn btn-primary btn-block" onClick={onSign}>{t('market.sign')}</button>
      <button className="btn btn-block" onClick={onBack}>{t('action.back')}</button>
    </div>
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
