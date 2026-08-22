import { useState } from 'react';
import { careerLegacy, careerSummary, peers } from '@fc/engine';
import { formatMoney, formatSeason, useLang, useT } from '../i18n/index.js';
import { clubName, clubShortName } from '../lib/club.js';
import { getPack, useGame } from '../state/store.js';
import { club } from '../state/selectors.js';
import { competitionLabel } from '../lib/names.js';
import { Card, Chip, Crest, Empty, RatingBadge, Stat } from '../components/ui.js';
import { SeasonChart } from '../components/SeasonChart.js';

/** Age pill colour: youth, prime, veteran - the shape of a career at a glance. */

/**
 * The retrospective: every club he played for, what he did there, what he won, and
 * the clubs that would call him one of their own. Only shown once he has retired,
 * because that is when a career becomes a story rather than a table.
 */
function Legacy() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const legacy = careerLegacy(state);
  const keeperOrDefender = state.player.primaryPos === 'GK'
    || ['CB', 'RB', 'LB', 'RWB', 'LWB'].includes(state.player.primaryPos);

  return (
    <>
      <Card title={t('legacy.clubs')}>
        <ul className="list">
          {legacy.spells.map((spell) => {
            const club = state.world.clubs[spell.clubId];
            return (
              <li key={spell.clubId} className="list-item" style={{ alignItems: 'flex-start' }}>
                <Crest club={club} size="sm" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ fontSize: 13.5 }}>{club ? clubName(club, lang) : spell.clubId}</span>
                    {spell.legend && <span className="chip chip-amber">{t('legacy.legend')}</span>}
                    {spell.onLoan && <span className="chip">{t('market.loan')}</span>}
                  </div>
                  <p className="faint" style={{ fontSize: 11.5 }}>
                    <span className="num">{formatSeason(spell.firstSeason)}–{formatSeason(spell.lastSeason)}</span>
                    {' · '}
                    {t('legacy.line', { apps: spell.apps, goals: spell.goals, assists: spell.assists })}
                    {keeperOrDefender && spell.cleanSheets > 0 && (
                      <> · {t('legacy.cleanSheets', { count: spell.cleanSheets })}</>
                    )}
                  </p>
                </div>
                {spell.trophies > 0 && (
                  <span className="num" style={{ fontSize: 13 }}>🏆 {spell.trophies}</span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title={t('legacy.totals')}>
        <div className="statrow">
          <Stat label={t('career.matches')} value={legacy.totals.apps} />
          <Stat label={t('match.goals')} value={legacy.totals.goals} />
          <Stat label={t('match.assists')} value={legacy.totals.assists} />
          <Stat label={t('match.motm')} value={legacy.totals.motm} />
        </div>
        <div className="statrow" style={{ marginBlockStart: 1 }}>
          <Stat label={t('legacy.minutes')} value={Math.round(legacy.totals.minutes / 90)} />
          <Stat label={t('match.cleanSheet')} value={legacy.totals.cleanSheets} />
          <Stat label={t('chart.cards')} value={legacy.totals.yellowCards} />
          <Stat label={t('legacy.reds')} value={legacy.totals.redCards} />
        </div>
      </Card>

      {(legacy.teamTrophies.length > 0 || legacy.awards.length > 0) && (
        <Card title={t('legacy.honours')}>
          {legacy.teamTrophies.length > 0 && (
            <>
              <p className="eyebrow" style={{ marginBlockEnd: 6 }}>{t('legacy.team')}</p>
              <div className="row wrap" style={{ gap: 6, marginBlockEnd: 12 }}>
                {legacy.teamTrophies.map((trophy) => (
                  <Chip key={trophy.competitionId} tone="amber">
                    {competitionLabel(trophy.competitionId, getPack(), lang, t)}
                    {trophy.count > 1 && <span className="num"> ×{trophy.count}</span>}
                  </Chip>
                ))}
              </div>
            </>
          )}
          {legacy.awards.length > 0 && (
            <>
              <p className="eyebrow" style={{ marginBlockEnd: 6 }}>{t('legacy.individual')}</p>
              <div className="row wrap" style={{ gap: 6 }}>
                {legacy.awards.map((award) => (
                  <Chip key={award.award} tone="pink">
                    {t(`award.${award.award}`)}
                    {award.count > 1 && <span className="num"> ×{award.count}</span>}
                  </Chip>
                ))}
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}

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
  const hisYear = peers(state);
  // Seasons he played in more than one shirt, which is the only case where a season
  // total on its own is misleading.
  const splitSeasons = state.seasonHistory.filter((record) => (record.spells?.length ?? 0) > 1);
  const myClub = state.player.clubId ? state.world.clubs[state.player.clubId] : undefined;
  const myClubName = myClub ? clubShortName(myClub, lang) : '—';

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

      {state.retired && <Legacy />}

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
          <span className="eyebrow">{t('career.teamOfTheWeek')}</span>
          <span className="num">{Number(state.flags['totwCount'] ?? 0)}</span>
        </div>
        <div className="row-between" style={{ marginBlockStart: 6 }}>
          <span className="eyebrow">{t('career.peakValue')}</span>
          <span className="num">{formatMoney(summary.peakValue, lang)}</span>
        </div>
        <div className="row-between" style={{ marginBlockStart: 6 }}>
          <span className="eyebrow">{t('market.earnings')}</span>
          <span className="num">{formatMoney(summary.careerEarnings, lang)}</span>
        </div>
      </Card>

      {/*
        * The shape of the career, before the table of it.
        *
        * The table below answers "what did I do in 2031"; it never answers "am I getting
        * better", which is the question a player actually has. Three small charts do,
        * one measure each - a rating out of ten and three thousand minutes have no
        * business sharing an axis.
        */}
      {state.seasonHistory.length >= 2 && (
        <Card title={t('career.shape')}>
          <SeasonChart
            label={t('career.ovrBySeason')}
            points={state.seasonHistory.map((r) => ({ season: r.season, value: r.ovrEnd }))}
            format={(v: number) => String(Math.round(v))}
            seasonLabel={formatSeason}
          />
          <SeasonChart
            label={t('career.minutesBySeason')}
            points={state.seasonHistory.map((r) => ({ season: r.season, value: r.minutes }))}
            format={(v: number) => String(Math.round(v))}
            seasonLabel={formatSeason}
          />
          <SeasonChart
            label={t('career.ratingBySeason')}
            points={state.seasonHistory.map((r) => ({
              season: r.season,
              value: r.ratedApps > 0 ? r.ratingSum / r.ratedApps : 0,
            }))}
            format={(v: number) => (v > 0 ? v.toFixed(2) : '—')}
            seasonLabel={formatSeason}
          />
        </Card>
      )}

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

      {/*
        * The boys he came through with.
        *
        * The one comparison a footballer actually lives by, and the reason the world
        * keeps these eight people alive when it throws everybody else away: at twenty-six
        * he can see exactly who from his own year is at Fulham and who stopped at
        * twenty-two, and where that leaves him.
        */}
      {splitSeasons.length > 0 && (
        <Card title={t('career.splitSeasons')}>
          {/* A season played at two clubs is two seasons as far as anybody reading it is
              concerned: eleven goals is a wonderful record and a poor one depending on
              which shirt they were scored in. */}
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('career.season')}</th>
                  <th>{t('career.hisYear.club')}</th>
                  <th className="num">{t('career.apps')}</th>
                  <th className="num">{t('match.goals')}</th>
                  <th className="num">{t('match.rating')}</th>
                </tr>
              </thead>
              <tbody>
                {splitSeasons.flatMap((record) => (record.spells ?? []).map((spell, i) => (
                  <tr key={`${record.season}-${spell.clubId}`}>
                    <td>{i === 0 ? formatSeason(record.season) : ''}</td>
                    <td>{clubShortName(club(state, spell.clubId), lang) || spell.clubId}</td>
                    <td className="num">{spell.apps}</td>
                    <td className="num">{spell.goals}</td>
                    <td className="num">
                      {spell.ratedApps > 0 ? (spell.ratingSum / spell.ratedApps).toFixed(2) : '—'}
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title={t('career.hisYear')}>
        {hisYear.length === 0 ? (
          <Empty>{t('career.hisYear.none')}</Empty>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('career.hisYear.player')}</th>
                  <th>{t('career.hisYear.club')}</th>
                  <th className="num">{t('career.apps')}</th>
                  <th className="num">{t('match.goals')}</th>
                </tr>
              </thead>
              <tbody>
                {hisYear.map((peer) => (
                  <tr key={peer.playerId} className={peer.aheadOfYou ? undefined : 'faint'}>
                    <td>
                      {peer.name}
                      {!peer.sameYear && <span className="faint"> · {t('career.hisYear.rival')}</span>}
                      {peer.retired && <span className="faint"> · {t('career.hisYear.finished')}</span>}
                    </td>
                    <td>{peer.clubName || '—'}</td>
                    <td className="num">{peer.apps}</td>
                    <td className="num">{peer.goals}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid var(--amber)' }}>
                  <td style={{ color: 'var(--amber)' }}>{t('career.hisYear.you')}</td>
                  <td>{myClubName}</td>
                  <td className="num">{summary.matches}</td>
                  <td className="num">{summary.goals}</td>
                </tr>
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
