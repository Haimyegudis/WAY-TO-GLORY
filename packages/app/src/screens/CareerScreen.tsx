import { useState } from 'react';
import { careerSummary } from '@fc/engine';
import { formatMoney, formatSeason, useLang, useT } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { club } from '../state/selectors.js';
import { Chip, Empty, Panel, RatingBadge, Stat } from '../components/ui.js';

export function CareerScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const goto = useGame((s) => s.goto);
  const retire = useGame((s) => s.retire);
  const [confirming, setConfirming] = useState(false);

  const summary = careerSummary(state);
  const age = state.world.season - state.player.birthYear;
  const canRetire = age >= 30 && !state.retired;

  return (
    <div className="screen stack">
      <header className="row-between">
        <div>
          <p className="eyebrow">{t('career.title')}</p>
          <h1 className="display" style={{ fontSize: 26, marginBlockStart: 4 }}>
            {state.retired ? t('career.complete') : `${state.player.firstName} ${state.player.lastName}`}
          </h1>
        </div>
        <button className="eyebrow" onClick={() => goto('settings')}>{t('settings.title')} →</button>
      </header>

      {state.retired && (
        <Panel lit>
          <p className="eyebrow">{t('career.status')}</p>
          <h2 className="display" style={{ fontSize: 30, marginBlock: '6px 10px', color: 'var(--flood)' }}>
            {t(`status.${summary.status}`)}
          </h2>
          <div className="row-between">
            <span className="eyebrow">{t('career.score')}</span>
            <span className="num" style={{ fontSize: 22 }}>{summary.score}/100</span>
          </div>
        </Panel>
      )}

      <Panel title={t('career.totals')}>
        <div className="statgrid">
          <Stat label={t('career.seasons')} value={summary.seasons} />
          <Stat label={t('career.matches')} value={summary.matches} />
          <Stat label={t('match.goals')} value={summary.goals} />
          <Stat label={t('match.assists')} value={summary.assists} />
        </div>
        <div className="statgrid" style={{ marginBlockStart: 1 }}>
          <Stat label={t('match.rating')} value={summary.avgRating > 0 ? summary.avgRating.toFixed(2) : '—'} />
          <Stat label={t('national.caps')} value={summary.caps} />
          <Stat label={t('career.trophies')} value={summary.trophies} />
          <Stat label={t('career.peakOvr')} value={summary.peakOvr} />
        </div>
        <div className="row-between" style={{ marginBlockStart: 12 }}>
          <span className="eyebrow">{t('career.peakValue')}</span>
          <span className="num">{formatMoney(summary.peakValue, lang)}</span>
        </div>
        <div className="row-between" style={{ marginBlockStart: 6 }}>
          <span className="eyebrow">{t('market.earnings')}</span>
          <span className="num">{formatMoney(summary.careerEarnings, lang)}</span>
        </div>
      </Panel>

      <Panel title={t('career.history')}>
        {state.seasonHistory.length === 0 ? (
          <Empty>—</Empty>
        ) : (
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('career.season')}</th>
                  <th>{t('career.club')}</th>
                  <th>{t('career.apps')}</th>
                  <th>{t('club.goals')}</th>
                  <th>A</th>
                  <th>{t('career.rating')}</th>
                  <th>OVR</th>
                </tr>
              </thead>
              <tbody>
                {[...state.seasonHistory].reverse().map((record) => (
                  <tr key={record.season}>
                    <td className="n">{formatSeason(record.season)}</td>
                    <td style={{ fontSize: 12 }}>
                      {club(state, record.clubId)?.shortName ?? '—'}
                      {record.trophies.length > 0 && <span style={{ color: 'var(--flood)' }}> ★</span>}
                    </td>
                    <td className="n">{record.apps}</td>
                    <td className="n">{record.goals}</td>
                    <td className="n">{record.assists}</td>
                    <td className="n">
                      {record.ratedApps > 0 ? <RatingBadge rating={record.ratingSum / record.ratedApps} /> : '—'}
                    </td>
                    <td className="n">{record.ovrEnd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={t('career.achievements')}>
        {state.achievements.length === 0 ? (
          <Empty>—</Empty>
        ) : (
          <div className="row wrap" style={{ gap: 6 }}>
            {state.achievements.map((achievement) => (
              <Chip key={achievement.id} tone="flood">
                {t(`achievement.${achievement.id}`)}
              </Chip>
            ))}
          </div>
        )}
      </Panel>

      <button className="btn btn-ghost btn-block" onClick={() => goto('national')}>
        {t('national.title')} →
      </button>

      {canRetire && (
        <Panel>
          {confirming ? (
            <div className="stack">
              <p className="headline">{t('career.retire.confirm')}</p>
              <p className="muted" style={{ fontSize: 13 }}>{t('career.retire.warning')}</p>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-ghost grow" onClick={() => setConfirming(false)}>{t('action.cancel')}</button>
                <button className="btn btn-danger grow" onClick={() => { setConfirming(false); retire(); }}>
                  {t('action.retire')}
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-danger btn-block" onClick={() => setConfirming(true)}>
              {t('action.retire')}
            </button>
          )}
        </Panel>
      )}
    </div>
  );
}
