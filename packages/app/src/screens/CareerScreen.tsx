import { useState } from 'react';
import { careerSummary } from '@fc/engine';
import { formatMoney, formatSeason, useLang, useT } from '../i18n/index.js';
import { clubShortName } from '../lib/club.js';
import { useGame } from '../state/store.js';
import { club } from '../state/selectors.js';
import { Card, Chip, Crest, Empty, RatingBadge, Stat } from '../components/ui.js';

/** Age pill colour: youth, prime, veteran - the shape of a career at a glance. */
function ageColor(age: number): string {
  if (age <= 20) return '#2fc46b';
  if (age <= 29) return '#4d8df6';
  return '#f2c14e';
}

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
          <h1 className="title">
            {state.retired ? t('career.complete') : `${state.player.firstName} ${state.player.lastName}`}
          </h1>
        </div>
        <button className="eyebrow" onClick={() => goto('settings')}>{t('settings.title')} →</button>
      </header>

      {state.retired && (
        <Card lit>
          <p className="eyebrow">{t('career.status')}</p>
          <h2 className="title">
            {t(`status.${summary.status}`)}
          </h2>
          <div className="row-between">
            <span className="eyebrow">{t('career.score')}</span>
            <span className="num" style={{ fontSize: 22 }}>{summary.score}/100</span>
          </div>
        </Card>
      )}

      <Card title={t('career.totals')}>
        <div className="statrow">
          <Stat label={t('career.seasons')} value={summary.seasons} />
          <Stat label={t('career.matches')} value={summary.matches} />
          <Stat label={t('match.goals')} value={summary.goals} />
          <Stat label={t('match.assists')} value={summary.assists} />
        </div>
        <div className="statrow" style={{ marginBlockStart: 1 }}>
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
      </Card>

      <Card title={t('career.history')}>
        {state.seasonHistory.length === 0 ? (
          <Empty>—</Empty>
        ) : (
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('club.age')}</th>
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
                    <td className="n">
                      <span className="age-pill" style={{ background: ageColor(record.age), color: '#06111f' }}>
                        {record.age}
                      </span>
                    </td>
                    <td className="start" style={{ fontSize: 12 }}>
                      <span className="row" style={{ gap: 6, minWidth: 0 }}>
                        <Crest club={club(state, record.clubId)} size="sm" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {clubShortName(club(state, record.clubId), lang) || '—'}
                        </span>
                        {record.trophies.length > 0 && <span title="trophy">🏆</span>}
                      </span>
                    </td>
                    <td className="n">{record.apps}</td>
                    <td className="n">{record.goals}</td>
                    <td className="n">{record.assists}</td>
                    <td className="n">
                      {record.ratedApps > 0 ? <RatingBadge rating={record.ratingSum / record.ratedApps} /> : '—'}
                    </td>
                    <td className="n">
                      <span className={`ovr-pill ${record.ovrEnd >= 70 ? 'ovr-pill-high' : ''}`}>{record.ovrEnd}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('career.honours')}>
        {(state.awards ?? []).length === 0 && (state.awardNominations ?? []).length === 0 ? (
          <Empty>{t('career.noHonours')}</Empty>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {(state.awards ?? []).slice().reverse().map((award, i) => (
              <div key={`${award.season}-${award.award}-${i}`} className="list-item">
                <span className="chip chip-amber">{t(`award.${award.award}`)}</span>
                <span className="grow faint num" style={{ fontSize: 12 }}>{formatSeason(award.season)}</span>
                {award.detail !== undefined && (
                  <span className="num" style={{ fontSize: 12.5 }}>
                    {t('award.goalsDetail', { goals: award.detail })}
                  </span>
                )}
              </div>
            ))}
            {(state.awardNominations ?? []).length > 0 && (
              <p className="faint" style={{ fontSize: 12 }}>
                {t('career.shortlisted', { count: (state.awardNominations ?? []).length })}
              </p>
            )}
          </div>
        )}
      </Card>

      {(state.tournaments ?? []).length > 0 && (
        <Card title={t('career.tournaments')}>
          <ul className="list">
            {(state.tournaments ?? []).slice().reverse().map((tournament, i) => (
              <li key={`${tournament.season}-${tournament.id}-${i}`} className="list-item">
                <span className="grow" style={{ fontSize: 13.5 }}>
                  {t(`tournament.${tournament.id}`)} <span className="faint num">{formatSeason(tournament.season)}</span>
                </span>
                <span className="chip">{t(`tournament.finish.${tournament.finish}`)}</span>
                <span className="num faint" style={{ fontSize: 12 }}>
                  {tournament.caps}/{tournament.goals}
                </span>
              </li>
            ))}
          </ul>
          <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 6 }}>{t('career.capsGoalsHint')}</p>
        </Card>
      )}

      <Card title={t('career.achievements')}>
        {state.achievements.length === 0 ? (
          <Empty>—</Empty>
        ) : (
          <div className="row wrap" style={{ gap: 6 }}>
            {state.achievements.map((achievement) => (
              <Chip key={achievement.id} tone="amber">
                {t(`achievement.${achievement.id}`)}
              </Chip>
            ))}
          </div>
        )}
      </Card>

      <button className="btn btn-quiet btn-block" onClick={() => goto('national')}>
        {t('national.title')} →
      </button>

      {canRetire && (
        <Card>
          {confirming ? (
            <div className="stack">
              <p className="headline">{t('career.retire.confirm')}</p>
              <p className="muted" style={{ fontSize: 13 }}>{t('career.retire.warning')}</p>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-quiet grow" onClick={() => setConfirming(false)}>{t('action.cancel')}</button>
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
        </Card>
      )}
    </div>
  );
}
