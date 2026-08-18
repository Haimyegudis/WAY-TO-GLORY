import { formatMoney, formatSeason, useLang, useT } from '../i18n/index.js';
import { getPack, useGame } from '../state/store.js';
import { club } from '../state/selectors.js';
import { Chip, Empty, Meter, Panel } from '../components/ui.js';

export function MarketScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const accept = useGame((s) => s.acceptOffer);
  const signAgent = useGame((s) => s.signAgent);
  const pack = getPack();

  const competitionName = (id: string) => pack.competitions.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="screen stack">
      <header>
        <p className="eyebrow">{t('market.title')}</p>
        <h1 className="display" style={{ fontSize: 26, marginBlockStart: 4 }}>
          {formatMoney(state.marketValue, lang)}
        </h1>
        <p className="faint" style={{ fontSize: 12 }}>{t('hub.value')}</p>
      </header>

      <Panel title={t('market.contract')}>
        {state.contract ? (
          <div className="stack" style={{ gap: 8 }}>
            <div className="row-between">
              <span style={{ fontSize: 14 }}>{club(state, state.contract.clubId)?.name}</span>
              <Chip tone="flood">{t(`role.${state.contract.squadRole}`)}</Chip>
            </div>
            <div className="row-between">
              <span className="eyebrow">{t('market.wage')}</span>
              <span className="num">{formatMoney(state.contract.salaryPerWeek, lang)}</span>
            </div>
            <div className="row-between">
              <span className="eyebrow">{t('market.until')}</span>
              <span className="num">{formatSeason(state.contract.endSeason)}</span>
            </div>
            {state.contract.isLoan && <Chip tone="sky">{t('market.loan')}</Chip>}
          </div>
        ) : (
          <p className="faint">{t('hub.freeAgent')}</p>
        )}
        <div className="divider" style={{ marginBlock: 12 }} />
        <div className="row-between">
          <span className="eyebrow">{t('market.earnings')}</span>
          <span className="num">{formatMoney(state.finances.careerEarnings, lang)}</span>
        </div>
      </Panel>

      <Panel title={t('market.offers')} lit={state.transferOffers.length > 0}>
        {state.transferOffers.length === 0 ? (
          <p className="faint" style={{ fontSize: 13 }}>{t('market.noOffers')}</p>
        ) : (
          <div className="stack">
            {state.transferOffers.map((offer) => {
              const target = club(state, offer.clubId);
              return (
                <div key={offer.id} style={{ border: '1px solid var(--chalk-line)', padding: 12 }}>
                  <div className="row-between" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <p className="display" style={{ fontSize: 17 }}>{target?.name}</p>
                      <p className="faint" style={{ fontSize: 11.5 }}>{competitionName(offer.competitionId)}</p>
                    </div>
                    {offer.isLoan ? <Chip tone="sky">{t('market.loan')}</Chip> : <Chip tone="flood">{t(`role.${offer.squadRole}`)}</Chip>}
                  </div>

                  <div className="grid-2" style={{ marginBlock: 10, gap: 8 }}>
                    <KeyVal label={t('market.fee')} value={offer.isLoan ? '—' : formatMoney(offer.fee, lang)} />
                    <KeyVal label={t('market.wage')} value={formatMoney(offer.salaryPerWeek, lang)} />
                    <KeyVal label={t('market.years')} value={String(offer.years)} />
                    <KeyVal label={t('market.expectedMinutes')} value={`${Math.round(offer.expectedMinutesPct * 100)}%`} />
                  </div>

                  <div style={{ marginBlockEnd: 10 }}>
                    <div className="row-between" style={{ marginBlockEnd: 4 }}>
                      <span className="eyebrow">{t('market.interest')}</span>
                      <span className="num" style={{ fontSize: 12 }}>{offer.interestLevel}</span>
                    </div>
                    <Meter value={offer.interestLevel} />
                  </div>

                  <button className="btn btn-primary btn-block" onClick={() => accept(offer.id)}>
                    {t('market.accept', { club: target?.shortName ?? '' })}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title={t('market.agent')}>
        {state.agent ? (
          <div className="stack" style={{ gap: 8 }}>
            <div className="row-between">
              <span style={{ fontSize: 15 }}>{state.agent.name}</span>
              <Chip>{state.agent.tier}</Chip>
            </div>
            <AgentBars agent={state.agent} />
            <div className="row-between">
              <span className="eyebrow">{t('market.commission', { pct: (state.agent.commissionPct * 100).toFixed(1) })}</span>
              <span className="faint" style={{ fontSize: 12 }}>{state.agent.countries.join(' · ')}</span>
            </div>
          </div>
        ) : state.agentOffers.length > 0 ? (
          <div className="stack">
            <p className="eyebrow">{t('market.agentOffers')}</p>
            {state.agentOffers.map((agent) => (
              <div key={agent.id} style={{ border: '1px solid var(--chalk-line)', padding: 12 }}>
                <div className="row-between">
                  <span style={{ fontSize: 15 }}>{agent.name}</span>
                  <Chip>{agent.tier}</Chip>
                </div>
                <div style={{ marginBlock: 10 }}>
                  <AgentBars agent={agent} />
                </div>
                <div className="row-between">
                  <span className="eyebrow">{t('market.commission', { pct: (agent.commissionPct * 100).toFixed(1) })}</span>
                  <button className="btn btn-ghost" onClick={() => signAgent(agent.id)}>{t('market.signAgent')}</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>{t('market.noAgent')}</Empty>
        )}
      </Panel>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="stat-label" style={{ marginBlockEnd: 2 }}>{label}</p>
      <p className="num" style={{ fontSize: 15 }}>{value}</p>
    </div>
  );
}

function AgentBars({ agent }: { agent: { connections: number; negotiation: number; internationalNetwork: number; careerPlanning: number } }) {
  const t = useT();
  const rows: [string, number][] = [
    [t('market.connections'), agent.connections],
    [t('market.negotiation'), agent.negotiation],
    [t('market.network'), agent.internationalNetwork],
    [t('market.planning'), agent.careerPlanning],
  ];
  return (
    <div className="stack" style={{ gap: 7 }}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="row-between" style={{ marginBlockEnd: 3 }}>
            <span className="eyebrow">{label}</span>
            <span className="num" style={{ fontSize: 11 }}>{value}</span>
          </div>
          <Meter value={value} />
        </div>
      ))}
    </div>
  );
}
