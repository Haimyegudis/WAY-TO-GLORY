import {
  currentOvr,
  potentialLabel,
  scoringRank,
  shirtRival,
  sortedTable,
  userYouthCompetition,
} from '@fc/engine';
import { formatSeason, hasTranslation, useLang, useT } from '../i18n/index.js';
import { getPack, useGame } from '../state/store.js';
import { PrepareCard } from './PrepareScreen.js';
import { campSchedule, inTrainingCamp, myClub, myPosition, nextFixture, weeksInjured } from '../state/selectors.js';
import { clubColor, clubName, clubShortName, localiseArgs } from '../lib/club.js';
import { competitionName, countryName, personName } from '../lib/names.js';
import { Card, Chip, ClubLine, Crest, Gauge, RatingBadge, Stat } from '../components/ui.js';
import { DecisionOptions } from './DecisionSheet.js';

export function Hub() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const goto = useGame((s) => s.goto);
  const openMatch = useGame((s) => s.openMatch);
  const markInboxRead = useGame((s) => s.markInboxRead);
  const openMessage = useGame((s) => s.openMessage);
  const applyInboxAction = useGame((s) => s.applyInboxAction);
  const openMessageId = useGame((s) => s.openMessageId);
  const openedMessage = openMessageId ? state.inbox.find((m) => m.id === openMessageId) ?? null : null;
  // Some messages are questions he has not answered. They wait here rather than stopping
  // his week, and they are answered from inside the message like a reply.
  const questionFor = (decisionId?: string) =>
    decisionId
      ? state.pendingDecisions.find((decision) => decision.id === decisionId && decision.blocking === false) ?? null
      : null;
  const openedQuestion = questionFor(openedMessage?.decisionId);

  const player = state.player;
  const club = myClub(state);
  const pack = getPack();
  const competition = club ? pack.competitions.find((c) => c.id === club.competitionId) ?? null : null;
  const ovr = currentOvr(state);
  const seasonStartOvr = Number(state.flags['seasonStartOvr'] ?? ovr);
  const ovrProgress = ovr - Math.round(seasonStartOvr);
  const age = state.world.season - player.birthYear;
  const fixture = nextFixture(state);
  const preparation = useGame((s) => s.preparation)();
  const season = state.world.seasonStats[player.id];
  const position = myPosition(state);
  const injuredWeeks = weeksInjured(state);
  const unread = state.inbox.filter((m) => !m.read);
  const suspended = player.condition.suspensions.length > 0;
  const listed = Boolean(state.flags['transferListed']);
  const frozen = (state.world.season * 52 + state.world.week) < Number(state.flags['benchedUntilWeek'] ?? 0);
  const lastHomeClub = state.lastMatch ? state.world.clubs[state.lastMatch.homeClubId] : undefined;
  const lastAwayClub = state.lastMatch ? state.world.clubs[state.lastMatch.awayClubId] : undefined;
  const lastHomeCountry = state.lastMatch
    ? pack.countries.find((country) => country.code === state.lastMatch?.homeClubId)
    : undefined;
  const lastAwayCountry = state.lastMatch
    ? pack.countries.find((country) => country.code === state.lastMatch?.awayClubId)
    : undefined;

  const ovrTone = ovr >= 82 ? 'ovr-tile-elite' : ovr >= 70 ? 'ovr-tile-high' : '';
  const inCamp = inTrainingCamp(state);
  const camp = inCamp ? campSchedule(state) : [];
  const campPlayed = camp.filter((entry) => entry.match);
  const campMatches = state.matchLog.filter(
    (match) => match.season === state.world.season && match.competitionId.startsWith('friendly') && match.userLine?.played,
  );
  const campAverage = campMatches.length > 0
    ? campMatches.reduce((sum, match) => sum + (match.userLine?.rating ?? 0), 0) / campMatches.length
    : 0;
  const campStartOvr = Number(state.flags[`campStartOvr:${state.world.season}`] ?? ovr);
  const campStrength = String(state.flags[`campStrength:${state.world.season}`] ?? '');
  const campWeakness = String(state.flags[`campWeakness:${state.world.season}`] ?? '');
  const campFocus = String(state.flags[`campRecommendedFocus:${state.world.season}`] ?? 'balanced');
  const campLoad = String(state.flags[`campRecommendedIntensity:${state.world.season}`] ?? 'normal');
  const recentRated = state.matchLog
    .filter((match) => match.userLine?.played && match.userLine.rating > 0)
    .slice(0, 5);
  const recentAverage = recentRated.length > 0
    ? recentRated.reduce((sum, match) => sum + (match.userLine?.rating ?? 0), 0) / recentRated.length
    : 0;
  const formBand = player.form >= 72 ? 'excellent' : player.form >= 56 ? 'good' : player.form >= 42 ? 'unstable' : 'poor';
  const selectionOutlook = injuredWeeks > 0
    ? 'injured'
    : state.flags['formBenchNotified']
      ? 'benchForm'
      : state.flags['calledUpToSeniors']
        ? 'seniorTraining'
        : player.squadRole === 'academy'
          ? 'academy'
          : ['starter', 'important', 'key', 'star'].includes(player.squadRole)
            ? 'starting'
            : 'competing';
  // Who is actually keeping him out of the side, by name. The manager's list is not a
  // secret in a dressing room, and a player who cannot see it cannot do anything about it.
  const rival = shirtRival(state);
  const nationalInterest = Math.round(Math.max(0, ...Object.values(state.nationalTeam.interest)));
  const youthForm = state.world.youth?.form;
  const youthAverage = youthForm && youthForm.apps > 0 ? youthForm.ratingSum / youthForm.apps : 0;

  return (
    <div className="screen stack">
      <div className="row-between">
        <span className="eyebrow">{formatSeason(state.world.season)}</span>
        <span className="row" style={{ gap: 10 }}>
          <span className="eyebrow">{t('hub.week', { week: state.world.week })}</span>
          <button className="icon-btn" aria-label={t('settings.title')} onClick={() => goto('settings')}>⚙</button>
        </span>
      </div>

      <header className="identity">
        <div className="identity-club" style={{ ['--club-color' as string]: clubColor(club) }}>
          {club?.crest && <img className="identity-watermark" src={`/crests/${club.crest}`} alt="" />}
          <h1 className="identity-name">
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {player.firstName} {player.lastName}
            </span>
            <Crest club={club} size="lg" />
          </h1>
          <div className="identity-meta">
            <Chip tone="pink">{player.primaryPos}</Chip>
            {player.shirtNumber && <Chip tone="amber"><span className="num">#{player.shirtNumber}</span></Chip>}
            <Chip>{t('hub.ageValue', { age })}</Chip>
            <Chip>{t(`role.${player.squadRole}`)}</Chip>
          </div>
          <p className="muted" style={{ fontSize: 12.5, textAlign: 'end' }}>
            {club ? clubName(club, lang) : t('hub.freeAgent')}
            {competition && <span className="faint"> · {competitionName(competition, lang)}</span>}
          </p>
        </div>
        <div className={`ovr-tile ${ovrTone}`}>
          <small>OVR</small>
          <b>{ovr}</b>
          <span className={`season-progress ${ovrProgress > 0 ? 'up' : ovrProgress < 0 ? 'down' : ''}`}>
            {ovrProgress > 0 ? '+' : ''}{ovrProgress} {t('progress.thisSeason')}
          </span>
        </div>
      </header>

      {(injuredWeeks > 0 || suspended || listed || frozen) && (
        <div className="row wrap" style={{ gap: 6 }}>
          {injuredWeeks > 0 && <Chip tone="red">{t('hub.injured', { weeks: injuredWeeks })}</Chip>}
          {suspended && <Chip tone="amber">{t('hub.suspended')}</Chip>}
          {listed && <Chip tone="amber">{t('hub.transferListed')}</Chip>}
          {frozen && <Chip tone="red">{t('hub.frozenOut')}</Chip>}
        </div>
      )}

      {inCamp && (
        <Card title={t('camp.title')}>
          <p className="muted" style={{ fontSize: 12.5, marginBlockEnd: 10 }}>
            {t('camp.phase', { week: state.world.week })}
          </p>
          {camp.length > 0 && (
            <ul className="list" style={{ marginBlockEnd: 12 }}>
              {camp.map((entry) => {
                const match = entry.match;
                const line = match?.userLine;
                const mine = club?.id;
                const isHome = match ? match.homeClubId === mine : entry.home;
                const forGoals = match ? (isHome ? match.homeGoals : match.awayGoals) : null;
                const againstGoals = match ? (isHome ? match.awayGoals : match.homeGoals) : null;
                return (
                  <li key={`${entry.week}${entry.slot}`} className="list-item">
                    <button
                      className="camp-row"
                      disabled={!match}
                      onClick={() => match && openMatch(match.id)}
                    >
                      <Crest club={entry.opponent} size="sm" />
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="row-between">
                          <span style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.opponent ? clubShortName(entry.opponent, lang) : '—'}
                          </span>
                          <span className="num" style={{ fontSize: 14 }}>
                            {match ? `${forGoals}–${againstGoals}` : '—'}
                          </span>
                        </span>
                        <span className="row-between" style={{ marginBlockStart: 3 }}>
                          <span className="faint" style={{ fontSize: 11 }}>
                            {t('camp.slot', { week: entry.week, when: t(`camp.when.${entry.slot}`) })}
                            {' · '}
                            {entry.home ? t('match.home') : t('match.away')}
                          </span>
                          <span className="faint" style={{ fontSize: 11 }}>
                            {line?.played
                              ? <><span className="num">{line.minutes}</span>′</>
                              : match
                                ? t(`match.reason.${line?.reasonNotPlayed ?? 'notSelected'}`)
                                : t('camp.toCome')}
                          </span>
                        </span>
                      </span>
                      {line?.played
                        ? <RatingBadge rating={line.rating} />
                        : <span className="faint" style={{ fontSize: 11 }}>—</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="statrow">
            <Stat label={t('camp.friendlies')} value={`${campPlayed.length}/${camp.length || 6}`} />
            <Stat label={t('match.rating')} value={campAverage > 0 ? campAverage.toFixed(2) : '—'} />
            <Stat label={t('rel.manager')} value={Math.round(state.managerTrust)} />
            <Stat label={t('camp.development')} value={`${ovr - campStartOvr >= 0 ? '+' : ''}${(ovr - campStartOvr).toFixed(1)}`} />
          </div>
          <div className="stack" style={{ gap: 6, marginBlockStart: 12 }}>
            {campStrength && <p style={{ fontSize: 13 }}>{t('camp.strength', { skill: `skill.${campStrength}` })}</p>}
            {campWeakness && <p style={{ fontSize: 13 }}>{t('camp.weakness', { skill: `skill.${campWeakness}` })}</p>}
            <p style={{ fontSize: 13 }}>{t('camp.coachFocus', { focus: `train.focus.${campFocus}` })}</p>
            <p style={{ fontSize: 13 }}>{t('camp.coachLoad', { intensity: `train.intensity.${campLoad}` })}</p>
          </div>
        </Card>
      )}

      {/*
        * How he is playing, in one card.
        *
        * Form was a number here, a gauge two cards down, and a sentence in between; his
        * standing with the manager was on this card and again on the next one. A screen
        * that says the same thing three times is not telling him more, it is making him
        * read more to find out less.
        */}
      {/*
        * His season, in the four numbers he actually quotes.
        *
        * Official matches only - the camp friendlies are not his record - and it comes
        * straight off the season the engine is keeping, so it counts every competition
        * he has played in rather than only the league he is in today.
        */}
      {season && season.apps > 0 && (
        <Card>
          <div className="statrow">
            <Stat label={t('career.apps')} value={season.apps} />
            <Stat label={t('match.goals')} value={season.goals} />
            <Stat label={t('match.assists')} value={season.assists} />
            <Stat
              label={t('chart.cards')}
              value={season.redCards > 0 ? `${season.yellowCards}/${season.redCards}` : season.yellowCards}
            />
          </div>
          <button
            className="faint"
            style={{ fontSize: 11.5, marginBlockStart: 8, textAlign: 'start' }}
            onClick={() => goto('matches')}
          >
            {t('hub.officialOnly')} ›
          </button>
        </Card>
      )}

      <Card>
        <div className="row" style={{ gap: 12 }}>
          <Gauge label={t('hub.form')} value={player.form} tone={player.form < 40 ? 'red' : 'green'} />
          <Gauge label={t('hub.fitness')} value={player.fitness} tone={player.fitness < 60 ? 'red' : 'blue'} />
          <Gauge label={t('hub.morale')} value={player.morale} tone={player.morale < 40 ? 'amber' : 'green'} />
          <Gauge label={t('train.fatigue')} value={player.condition.fatigue} tone={player.condition.fatigue > 55 ? 'red' : 'amber'} />
        </div>
        {recentAverage > 0 && (
          <div className="row-between" style={{ marginBlockStart: 12 }}>
            <span className="eyebrow">{t('status.lastFive')}</span>
            <span className="num">{recentAverage.toFixed(2)}</span>
          </div>
        )}
        {/*
          * How close the selectors are. It went out with the rest of the numbers and it
          * should not have: for a young player it is the one that moves the season, and
          * he watches it the way he watches his form.
          */}
        {nationalInterest > 0 && (
          <button className="row-between" style={{ marginBlockStart: 6, width: '100%' }} onClick={() => goto('national')}>
            <span className="eyebrow">{t('status.nationalInterest')}</span>
            <span className="num">{nationalInterest}% ›</span>
          </button>
        )}
      </Card>

      {/* The week's homework comes before the fixture card: he reads the report, picks
          his job, and then looks at who they are. */}
      {preparation && <PrepareCard preparation={preparation} />}

      <Card title={t('hub.nextMatch')}>
        {fixture ? (
          <div className="row-between">
            <div className="row" style={{ gap: 10, minWidth: 0 }}>
              <Crest club={fixture.opponent} size="lg" />
              <div style={{ minWidth: 0 }}>
                <p className="headline" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {clubName(fixture.opponent, lang)}
                </p>
                <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 2 }}>
                  {fixture.home ? t('match.home') : t('match.away')} · {fixture.competitionId === 'friendly' ? t('match.importance.friendly') : t('hub.week', { week: fixture.fixture.week })}
                </p>
              </div>
            </div>
            {position && (
              <div style={{ textAlign: 'center' }}>
                <p className="num" style={{ fontSize: 20 }}>{position}</p>
                <p className="stat-label">{t('club.pos')}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="faint" style={{ fontSize: 13 }}>{t('hub.noFixture')}</p>
        )}
      </Card>

      {state.lastMatch && (
        <Card
          title={t('hub.lastMatch')}
          action={
            <button className="eyebrow" style={{ color: 'var(--amber)' }} onClick={() => goto('match')}>
              {t('action.viewAll')} →
            </button>
          }
        >
          <div className="row-between score-row">
            <span className="grow" style={{ fontSize: 13.5, minWidth: 0 }}>
              {lastHomeClub
                ? <ClubLine club={lastHomeClub} size="sm" />
                : <span className="row"><span className="crest crest-sm crest-fallback">{countryName(lastHomeCountry, lang).slice(0, 2)}</span>{countryName(lastHomeCountry, lang)}</span>}
            </span>
            <span className="num" style={{ fontSize: 17 }}>
              {state.lastMatch.homeGoals}–{state.lastMatch.awayGoals}
            </span>
            <span className="grow" style={{ fontSize: 13.5, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
              {lastAwayClub
                ? <ClubLine club={lastAwayClub} size="sm" />
                : <span className="row"><span className="crest crest-sm crest-fallback">{countryName(lastAwayCountry, lang).slice(0, 2)}</span>{countryName(lastAwayCountry, lang)}</span>}
            </span>
          </div>
          {state.lastMatch.userLine?.played && (
            <div className="row-between" style={{ marginBlockStart: 10 }}>
              <span className="faint" style={{ fontSize: 12 }}>
                {state.lastMatch.userLine.minutes}′ · {state.lastMatch.userLine.goals} {t('match.goals')} · {state.lastMatch.userLine.assists} {t('match.assists')}
              </span>
              <RatingBadge rating={state.lastMatch.userLine.rating} />
            </div>
          )}
        </Card>
      )}

      <Card
        title={t('hub.inbox')}
        lit={unread.length > 0}
        action={
          unread.length > 0 ? (
            <button className="eyebrow" onClick={markInboxRead}>{t('action.markRead')}</button>
          ) : undefined
        }
      >
        {state.inbox.length === 0 ? (
          <p className="faint" style={{ fontSize: 13 }}>—</p>
        ) : (
          <ul className="list">
            {state.inbox.slice(0, 8).map((message) => (
              <li key={message.id} className="list-item">
                <button className="inbox-row" onClick={() => openMessage(message.id)}>
                  <i className={`dot ${questionFor(message.decisionId) ? 'dot-ask' : message.read ? 'dot-read' : ''}`} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="inbox-from">{t(`inboxFrom.${message.category}`)}</span>
                    <span className={`inbox-title ${message.read ? '' : 'unread'}`}>
                      {t(message.titleKey, localiseArgs(message.args, pack.clubs, lang))}
                    </span>
                    {questionFor(message.decisionId) && (
                      <span className="inbox-when" style={{ color: 'var(--amber)' }}>{t('inbox.needsAnswer')}</span>
                    )}
                    <span className="inbox-when faint">
                      {formatSeason(message.season)} · {t('hub.week', { week: message.week })}
                    </span>
                  </span>
                  <span className="inbox-chevron">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {openedMessage && (
        <div className="sheet-backdrop" onClick={() => openMessage(null)}>
          <div
            className="sheet mail"
            role="dialog"
            aria-modal="true"
            aria-label={t(openedMessage.titleKey, localiseArgs(openedMessage.args, pack.clubs, lang))}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-grip" />
            <p className="eyebrow">{t(`inboxFrom.${openedMessage.category}`)}</p>
            <h2 className="headline" style={{ marginBlockStart: 4 }}>
              {t(openedMessage.titleKey, localiseArgs(openedMessage.args, pack.clubs, lang))}
            </h2>
            <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 4 }}>
              {formatSeason(openedMessage.season)} · {t('hub.week', { week: openedMessage.week })}
            </p>
            <p style={{ fontSize: 13.5, marginBlockStart: 12, lineHeight: 1.6 }}>
              {hasTranslation(lang, `${openedMessage.titleKey}.body`)
                ? t(`${openedMessage.titleKey}.body`, localiseArgs(openedMessage.args, pack.clubs, lang))
                : t(openedMessage.titleKey, localiseArgs(openedMessage.args, pack.clubs, lang))}
            </p>
            {openedQuestion ? (
              <div style={{ marginBlockStart: 16 }}>
                <DecisionOptions decision={openedQuestion} />
              </div>
            ) : openedMessage.action ? (
              <div className="stack" style={{ marginBlockStart: 16, gap: 8 }}>
                <button className="btn btn-primary btn-block" onClick={() => applyInboxAction(openedMessage.id)}>
                  {t('inbox.action.applyTraining')}
                </button>
                <button className="btn btn-quiet btn-block" onClick={() => openMessage(null)}>
                  {t('action.close')}
                </button>
              </div>
            ) : (
              <button className="btn btn-primary btn-block" style={{ marginBlockStart: 16 }} onClick={() => openMessage(null)}>
                {t('action.close')}
              </button>
            )}
          </div>
        </div>
      )}

      <p className="faint center" style={{ fontSize: 11.5 }}>
        {t('hub.potential')}: {t(`potential.${potentialLabel(state)}`)}
      </p>
    </div>
  );
}

/**
 * Where he stands in his own age group: his club's place in the youth table and his own
 * place in its scoring chart. A sixteen year old has no league position of his own, so
 * this is the only standing that means anything to him yet.
 */
function YouthStanding() {
  const t = useT();
  const state = useGame((s) => s.state)!;
  const comp = userYouthCompetition(state);
  const clubId = state.player.clubId;
  if (!comp || !clubId) return null;

  const rows = sortedTable(comp);
  const place = rows.findIndex((row) => row.clubId === clubId) + 1;
  if (place === 0) return null;
  const rank = scoringRank(state);

  return (
    <p style={{ fontSize: 12.5, marginBlockStart: 6 }}>
      {rank > 0
        ? t('hub.youthStandingScoring', { place, teams: rows.length, rank })
        : t('hub.youthStanding', { place, teams: rows.length })}
    </p>
  );
}
