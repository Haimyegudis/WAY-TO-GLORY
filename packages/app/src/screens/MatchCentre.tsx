import { formatSeason, useT } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { club, recentMatches } from '../state/selectors.js';
import { Empty, Panel, RatingBadge, Stat } from '../components/ui.js';

/** Three phrasings per repeated beat, chosen by minute, so reports do not repeat verbatim. */
function variantKey(key: string, minute: number): string {
  const varied = ['match.event.userMiss', 'match.event.userSaved', 'match.event.userTackle', 'match.event.teamGoal'];
  if (!varied.includes(key)) return key;
  const variant = minute % 3;
  return variant === 0 ? key : `${key}${variant + 1}`;
}

export function MatchCentre() {
  const t = useT();
  const state = useGame((s) => s.state)!;
  const match = state.lastMatch;

  if (!match) {
    return (
      <div className="screen">
        <Empty>{t('hub.noFixture')}</Empty>
      </div>
    );
  }

  const home = club(state, match.homeClubId);
  const away = club(state, match.awayClubId);
  const line = match.userLine;
  // A match report is a highlights reel, not a log: keep every decisive moment but
  // only a couple of the near misses, otherwise the timeline reads like a stuck record.
  const allEvents = match.events ?? [];
  let missesShown = 0;
  const events = allEvents.filter((e) => {
    const decisive = e.type === 'goal' || e.type === 'concede' || e.type === 'assist'
      || e.type === 'yellow' || e.type === 'red' || e.type === 'injury' || e.type === 'penaltyScored' || e.type === 'penaltyMissed';
    if (decisive) return true;
    if (!e.byUser) return false;
    if (e.type === 'miss' || e.type === 'save') {
      missesShown += 1;
      return missesShown <= 2;
    }
    return true;
  });

  return (
    <div className="screen stack">
      <div className="row-between">
        <span className="eyebrow">{t('match.title')}</span>
        <span className="eyebrow">
          {formatSeason(match.season)} · {t('hub.week', { week: match.week })}
        </span>
      </div>

      <Panel lit>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <p className="display" style={{ fontSize: 17 }}>{home?.shortName ?? match.homeClubId}</p>
          </div>
          <div className="num" style={{ fontSize: 34, letterSpacing: '0.04em' }} dir="ltr">
            {match.homeGoals}–{match.awayGoals}
          </div>
          <div style={{ flex: 1, textAlign: 'end' }}>
            <p className="display" style={{ fontSize: 17 }}>{away?.shortName ?? match.awayClubId}</p>
          </div>
        </div>
        {match.importance && match.importance !== 'normal' && (
          <p className="eyebrow" style={{ textAlign: 'center', marginBlockStart: 10, color: 'var(--flood)' }}>
            {t(`match.importance.${match.importance}`)}
          </p>
        )}
      </Panel>

      {line?.played ? (
        <>
          <Panel title={t('match.rating')}>
            <div className="row-between" style={{ marginBlockEnd: 12 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="chip">{line.position}</span>
                <span className="num">{line.minutes}′</span>
                {line.motm && <span className="chip chip-flood">{t('match.motm')}</span>}
              </div>
              <span className="num" style={{ fontSize: 30 }}>
                <RatingBadge rating={line.rating} />
              </span>
            </div>
            <div className="statgrid">
              <Stat label={t('match.goals')} value={line.goals} />
              <Stat label={t('match.assists')} value={line.assists} />
              <Stat label={t('match.shots')} value={line.shots} />
              <Stat label={line.saves > 0 ? t('match.saves') : t('match.keyPasses')} value={line.saves > 0 ? line.saves : line.keyPasses} />
            </div>
          </Panel>

          {events.length > 0 && (
            <Panel title="90′">
              <div className="timeline">
                {events.map((event, i) => {
                  const good = event.type === 'goal' || event.type === 'assist' || event.type === 'save' || event.type === 'tackle';
                  const bad = event.type === 'concede' || event.type === 'yellow' || event.type === 'red' || event.type === 'miss';
                  return (
                    <div
                      key={i}
                      className={`tl-item ${event.byUser && good ? 'tl-goal' : bad ? 'tl-bad' : ''}`}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <span className="tl-minute">{event.minute}′</span>
                      <p style={{ fontSize: 13.5, color: event.byUser ? 'var(--ink)' : 'var(--ink-dim)' }}>
                        {t(variantKey(event.detailKey ?? `match.event.${event.type}`, event.minute))}
                      </p>
                      {event.score && (
                        <p className="num faint" style={{ fontSize: 11 }}>
                          {event.score[0]}–{event.score[1]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </>
      ) : (
        <Panel>
          <p className="headline">{t('match.didNotPlay')}</p>
          {line?.reasonNotPlayed && (
            <p className="muted" style={{ marginBlockStart: 6, fontSize: 13.5 }}>
              {t(`match.reason.${line.reasonNotPlayed}`)}
            </p>
          )}
        </Panel>
      )}

      <Panel title={t('club.fixtures')}>
        <ul className="list">
          {recentMatches(state).map((m) => {
            const h = club(state, m.homeClubId);
            const a = club(state, m.awayClubId);
            return (
              <li key={m.id} className="list-item">
                <span className="faint num" style={{ fontSize: 11, minWidth: 26 }}>{m.week}</span>
                <span className="grow" style={{ fontSize: 13 }} dir="ltr">
                  {h?.shortName} <span className="num">{m.homeGoals}–{m.awayGoals}</span> {a?.shortName}
                </span>
                {m.userLine?.played ? (
                  <RatingBadge rating={m.userLine.rating} />
                ) : (
                  <span className="faint" style={{ fontSize: 11 }}>—</span>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
