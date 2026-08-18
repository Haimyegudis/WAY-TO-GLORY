import { currentOvr, potentialLabel, relationshipLabel } from '@fc/engine';
import { formatMoney, formatSeason, useLang, useT } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { myClub, myPosition, nextFixture, seasonLine, weeksInjured } from '../state/selectors.js';
import { clubColor, clubName } from '../lib/club.js';
import { Card, Chip, ClubLine, Crest, Gauge, RatingBadge, Stat } from '../components/ui.js';

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
  const listed = Boolean(state.flags['transferListed']);
  const frozen = (state.world.season * 52 + state.world.week) < Number(state.flags['benchedUntilWeek'] ?? 0);

  const ovrTone = ovr >= 82 ? 'ovr-tile-elite' : ovr >= 70 ? 'ovr-tile-high' : '';

  return (
    <div className="screen stack">
      <div className="row-between">
        <span className="eyebrow">{formatSeason(state.world.season)}</span>
        <span className="eyebrow">{t('hub.week', { week: state.world.week })}</span>
      </div>

      <header className="identity">
        <div className="identity-club" style={{ ['--club-color' as string]: clubColor(club) }}>
          {club?.crest && <img className="identity-watermark" src={`/crests/${club.crest}`} alt="" />}
          <div className="identity-name">
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {player.firstName} {player.lastName}
            </span>
            <Crest club={club} />
          </div>
          <div className="identity-meta">
            <Chip tone="pink">{player.primaryPos}</Chip>
            <Chip>{t('hub.ageValue', { age })}</Chip>
            <Chip>{t(`role.${player.squadRole}`)}</Chip>
          </div>
          <p className="muted" style={{ fontSize: 12.5, textAlign: 'end' }}>
            {club ? clubName(club, lang) : t('hub.freeAgent')}
          </p>
        </div>
        <div className={`ovr-tile ${ovrTone}`}>
          <small>OVR</small>
          <b>{ovr}</b>
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

      <Card>
        <div className="statrow">
          <Stat label={t('career.apps')} value={season.apps} />
          <Stat label={t('match.goals')} value={season.goals} />
          <Stat label={t('match.assists')} value={season.assists} />
          <Stat label={t('match.rating')} value={season.rating > 0 ? season.rating.toFixed(2) : '—'} />
        </div>
      </Card>

      <Card title={t('hub.condition')}>
        <div className="stack" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 14 }}>
            <Gauge label={t('hub.form')} value={player.form} tone={player.form < 40 ? 'red' : 'green'} />
            <Gauge label={t('hub.fitness')} value={player.fitness} tone={player.fitness < 60 ? 'red' : 'blue'} />
          </div>
          <div className="row" style={{ gap: 14 }}>
            <Gauge label={t('hub.morale')} value={player.morale} tone={player.morale < 40 ? 'amber' : 'green'} />
            <Gauge label={t('train.fatigue')} value={player.condition.fatigue} tone={player.condition.fatigue > 55 ? 'red' : 'amber'} />
          </div>
        </div>
      </Card>

      <Card
        title={t('social.standing')}
        action={
          <button className="eyebrow" style={{ color: 'var(--amber)' }} onClick={() => goto('social')}>
            {t('social.open')} →
          </button>
        }
      >
        <div className="stack" style={{ gap: 10 }}>
          <RelationRow label={t('rel.manager')} value={state.relationships.manager} />
          <RelationRow label={t('rel.teammates')} value={state.relationships.teammates} />
          <RelationRow label={t('rel.fans')} value={state.relationships.fans} />
          <RelationRow label={t('rel.board')} value={state.relationships.board} />
        </div>
      </Card>

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
                  {fixture.home ? t('match.home') : t('match.away')} · {t('hub.week', { week: fixture.fixture.week })}
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
          <div className="row-between">
            <span className="grow" style={{ fontSize: 13.5, minWidth: 0 }}>
              <ClubLine club={state.world.clubs[state.lastMatch.homeClubId]} size="sm" />
            </span>
            <span className="num" style={{ fontSize: 17 }}>
              {state.lastMatch.homeGoals}–{state.lastMatch.awayGoals}
            </span>
            <span className="grow" style={{ fontSize: 13.5, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
              <ClubLine club={state.world.clubs[state.lastMatch.awayClubId]} size="sm" />
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
      </Card>

      <Card title={t('hub.money')}>
        <div className="row-between">
          <span className="eyebrow">{t('hub.value')}</span>
          <span className="num">{formatMoney(state.marketValue, lang)}</span>
        </div>
        {state.contract && (
          <>
            <div className="row-between" style={{ marginBlockStart: 8 }}>
              <span className="eyebrow">{t('hub.wage')}</span>
              <span className="num">{formatMoney(state.contract.salaryPerWeek, lang)}</span>
            </div>
            <div className="row-between" style={{ marginBlockStart: 8 }}>
              <span className="eyebrow">{t('market.until')}</span>
              <span className="num">{formatSeason(state.contract.endSeason)}</span>
            </div>
          </>
        )}
        <div className="row" style={{ gap: 8, marginBlockStart: 12 }}>
          <button className="btn btn-quiet grow" onClick={() => goto('train')}>{t('nav.train')}</button>
          <button className="btn btn-quiet grow" onClick={() => goto('market')}>{t('nav.market')}</button>
        </div>
      </Card>

      <p className="faint center" style={{ fontSize: 11.5 }}>
        {t('hub.potential')}: {t(`potential.${potentialLabel(state)}`)}
      </p>
    </div>
  );
}

function RelationRow({ label, value }: { label: string; value: number }) {
  const t = useT();
  const tone = value >= 62 ? 'green' : value >= 40 ? 'amber' : 'red';
  return (
    <div>
      <div className="row-between" style={{ marginBlockEnd: 5 }}>
        <span style={{ fontSize: 13 }}>{label}</span>
        <span className="faint" style={{ fontSize: 11.5 }}>{t(relationshipLabel(value))}</span>
      </div>
      <div className="meter" style={{ height: 5 }}>
        <i
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: tone === 'green' ? 'var(--green)' : tone === 'amber' ? 'var(--amber)' : 'var(--red)',
          }}
        />
      </div>
    </div>
  );
}
