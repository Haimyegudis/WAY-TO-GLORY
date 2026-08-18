import { currentOvr, potentialLabel } from '@fc/engine';
import { formatMoney, formatSeason, useLang, useT } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { myClub, myCompetitionState, myPosition, nextFixture, seasonLine, weeksInjured } from '../state/selectors.js';
import { Chip, Gauge, Panel, RatingBadge, Stat } from '../components/ui.js';

export function Hub() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const goto = useGame((s) => s.goto);
  const markInboxRead = useGame((s) => s.markInboxRead);

  const player = state.player;
  const club = myClub(state);
  const ovr = currentOvr(state);
  const age = state.world.season - player.birthYear;
  const fixture = nextFixture(state);
  const season = seasonLine(state);
  const position = myPosition(state);
  const injuredWeeks = weeksInjured(state);
  const unread = state.inbox.filter((m) => !m.read);
  const suspended = player.condition.suspensions.length > 0;

  return (
    <div className="screen stack">
      <div className="row-between">
        <span className="eyebrow">{t('hub.season.label', { season: formatSeason(state.world.season) })}</span>
        <span className="eyebrow">{t('hub.week', { week: state.world.week })}</span>
      </div>

      <header className="hero">
        <span className="hero-number num">{ovr}</span>
        <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
          <div className="grow">
            <h1 className="hero-name">
              {player.firstName}
              <br />
              {player.lastName}
            </h1>
            <div className="hero-meta">
              <Chip tone="flood">{player.primaryPos}</Chip>
              <Chip>{age}</Chip>
              <Chip>{t(`role.${player.squadRole}`)}</Chip>
              {injuredWeeks > 0 && <Chip tone="blood">{t('hub.injured', { weeks: injuredWeeks })}</Chip>}
              {suspended && <Chip tone="amber">{t('hub.suspended')}</Chip>}
            </div>
            <p className="muted" style={{ marginBlockStart: 10, fontSize: 13.5 }}>
              {club ? club.name : t('hub.freeAgent')}
            </p>
            <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 2 }}>
              {t('hub.potential')}: {t(`potential.${potentialLabel(state)}`)}
            </p>
          </div>
          <div className="ovr">
            <span className="ovr-value">{ovr}</span>
            <span className="ovr-label">OVR</span>
          </div>
        </div>
      </header>

      <Panel>
        <div className="stack" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 14 }}>
            <Gauge label={t('hub.form')} value={player.form} />
            <Gauge label={t('hub.fitness')} value={player.fitness} tone={player.fitness < 60 ? 'blood' : 'sky'} />
          </div>
          <div className="row" style={{ gap: 14 }}>
            <Gauge label={t('hub.morale')} value={player.morale} tone={player.morale < 40 ? 'amber' : 'flood'} />
            <Gauge label={t('hub.trust')} value={state.managerTrust} tone={state.managerTrust < 35 ? 'blood' : 'flood'} />
          </div>
        </div>
      </Panel>

      <Panel title={t('hub.nextMatch')}>
        {fixture ? (
          <div className="row-between">
            <div>
              <p className="headline">{fixture.opponent?.shortName ?? '—'}</p>
              <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 3 }}>
                {fixture.home ? t('match.home') : t('match.away')} · {t('hub.week', { week: fixture.fixture.week })}
              </p>
            </div>
            {position && (
              <div style={{ textAlign: 'center' }}>
                <p className="num" style={{ fontSize: 22 }}>{position}</p>
                <p className="stat-label">{t('club.pos')}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="faint">{t('hub.noFixture')}</p>
        )}
      </Panel>

      <Panel
        title={t('hub.season')}
        action={
          state.lastMatch ? (
            <button className="eyebrow" style={{ color: 'var(--flood)' }} onClick={() => goto('match')}>
              {t('hub.lastMatch')} →
            </button>
          ) : undefined
        }
      >
        <div className="statgrid">
          <Stat label={t('career.apps')} value={season.apps} />
          <Stat label={t('match.goals')} value={season.goals} />
          <Stat label={t('match.assists')} value={season.assists} />
          <Stat label={t('match.rating')} value={season.rating > 0 ? season.rating.toFixed(2) : '—'} />
        </div>
        <div className="row-between" style={{ marginBlockStart: 12 }}>
          <span className="eyebrow">{t('hub.value')}</span>
          <span className="num">{formatMoney(state.marketValue, lang)}</span>
        </div>
        {state.contract && (
          <div className="row-between" style={{ marginBlockStart: 6 }}>
            <span className="eyebrow">{t('hub.wage')}</span>
            <span className="num">{formatMoney(state.contract.salaryPerWeek, lang)}</span>
          </div>
        )}
      </Panel>

      <Panel
        title={t('hub.inbox')}
        lit={unread.length > 0}
        action={unread.length > 0 ? <button className="eyebrow" onClick={markInboxRead}>{t('action.viewAll')}</button> : undefined}
      >
        {state.inbox.length === 0 ? (
          <p className="faint" style={{ fontSize: 13 }}>—</p>
        ) : (
          <ul className="list">
            {state.inbox.slice(0, 6).map((message) => (
              <li key={message.id} className="list-item">
                <i className={`dot ${message.read ? 'dot-read' : ''}`} />
                <div className="grow">
                  <p style={{ fontSize: 13.5 }}>{t(message.titleKey, message.args)}</p>
                  <p className="faint" style={{ fontSize: 10.5 }}>
                    {formatSeason(message.season)} · {t('hub.week', { week: message.week })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={t('hub.news')}>
        {state.news.length === 0 ? (
          <p className="faint" style={{ fontSize: 13 }}>—</p>
        ) : (
          <ul className="list">
            {state.news.slice(0, 6).map((item, i) => (
              <li key={`${item.season}-${item.week}-${i}`} className="list-item">
                <i className="dot" style={{ background: item.importance === 'high' ? 'var(--flood)' : 'var(--pitch-600)' }} />
                <span style={{ fontSize: 13 }}>{t(item.key, item.args)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {state.lastMatch?.userLine?.played && (
        <Panel title={t('hub.lastMatch')}>
          <div className="row-between">
            <span style={{ fontSize: 13.5 }}>
              {myCompetitionState(state)?.competitionId ?? ''} · {state.lastMatch.homeGoals}–{state.lastMatch.awayGoals}
            </span>
            <RatingBadge rating={state.lastMatch.userLine.rating} />
          </div>
        </Panel>
      )}
    </div>
  );
}
