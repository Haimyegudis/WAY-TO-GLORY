import { useState } from 'react';
import type { CareerState, MatchResult, PendingHalfTime } from '@fc/engine';
import { formatSeason, useLang, useT } from '../i18n/index.js';
import { clubShortName, localiseArgs } from '../lib/club.js';
import { getPack, useGame } from '../state/store.js';
import { club, openHalfTime, recentMatches } from '../state/selectors.js';
import { competitionLabel, countryName, findPlayer, playerName } from '../lib/names.js';
import { Card, Crest, Empty, RatingBadge, Stat } from '../components/ui.js';
import { LiveMatch } from '../components/LiveMatch.js';
import { HalfTimeSheet } from './HalfTimeSheet.js';

/** Three phrasings per repeated beat, chosen by minute, so reports do not repeat verbatim. */
function variantKey(key: string, minute: number): string {
  const varied = ['match.event.userMiss', 'match.event.userSaved', 'match.event.userTackle', 'match.event.teamGoal'];
  if (!varied.includes(key)) return key;
  const variant = minute % 3;
  return variant === 0 ? key : `${key}${variant + 1}`;
}

/** The name behind a goal, an assist or a booking, when we model that player. */
function namedFor(event: { type: string; playerId?: string; byUser: boolean }, state: CareerState, lang: 'he' | 'en'): string {
  if (!event.playerId) return '';
  if (event.playerId === state.player.id) return '';
  const player = findPlayer(state, event.playerId);
  return player ? playerName(player, lang) : '';
}

/** The first half, dressed up as a match so the same playback can show it. */
function firstHalfAsMatch(state: CareerState, half: PendingHalfTime): MatchResult {
  return {
    id: half.matchId,
    season: state.world.season,
    week: state.world.week,
    competitionId: half.competitionId,
    homeClubId: half.homeClubId,
    awayClubId: half.awayClubId,
    homeGoals: half.score[0],
    awayGoals: half.score[1],
    detailLevel: 1,
    importance: half.importance,
    userLine: {
      played: true,
      started: half.minutes.started,
      minutes: Math.min(45, half.minutes.minutes),
      position: half.minutes.slot,
      goals: 0, assists: 0, shots: 0, keyPasses: 0, tackles: 0, saves: 0,
      yellow: 0, red: 0, rating: half.rating, motm: false,
      ...(half.minutes.cameOnMinute !== undefined ? { cameOnMinute: half.minutes.cameOnMinute } : {}),
    },
    events: half.firstHalfEvents,
    instructionChanges: half.liveInstructions ?? [],
    ...(half.liveInstructions?.length
      ? { instruction: half.liveInstructions[half.liveInstructions.length - 1]!.instruction }
      : {}),
  };
}

export function MatchCentre() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const liveMatchId = useGame((s) => s.liveMatchId);
  const endLive = useGame((s) => s.endLive);
  // The match this screen is about. Following an id rather than "the last one written"
  // is what keeps a youth match and a cup tie in the same week apart.
  const focusMatchId = useGame((s) => s.focusMatchId);
  const match =
    (focusMatchId ? state.matchLog.find((entry) => entry.id === focusMatchId) : null) ?? state.lastMatch;
  const half = openHalfTime(state);
  const liveFrom = useGame((s) => s.liveFromMinute);
  const applyInboxAction = useGame((s) => s.applyInboxAction);
  // Which match he has already walked off the pitch for. This is held per match rather
  // than as a plain flag: the screen never unmounts between games, and a flag left
  // standing from the last team talk sent the next match straight to the dressing room
  // without a minute of the first half being played.
  const [roomFor, setRoomFor] = useState<string | null>(null);

  // A match waiting on a team talk: the first half is watched, then the question.
  if (half) {
    if (roomFor === half.matchId) return <HalfTimeSheet half={half} />;
    return (
      <div className="screen">
        <LiveMatch
          match={firstHalfAsMatch(state, half)}
          to={45}
          onFinish={() => setRoomFor(half.matchId)}
        />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="screen">
        <Empty>{t('hub.noFixture')}</Empty>
      </div>
    );
  }

  // A match he played is watched first and read afterwards.
  if (liveMatchId === match.id) {
    return (
      <div className="screen">
        <LiveMatch match={match} onFinish={endLive} {...(liveFrom > 0 ? { from: liveFrom } : {})} />
      </div>
    );
  }

  const home = club(state, match.homeClubId);
  const away = club(state, match.awayClubId);
  const pack = getPack();
  const homeCountry = pack.countries.find((country) => country.code === match.homeClubId);
  const awayCountry = pack.countries.find((country) => country.code === match.awayClubId);
  const homeLabel = clubShortName(home, lang) || countryName(homeCountry, lang) || match.homeClubId;
  const awayLabel = clubShortName(away, lang) || countryName(awayCountry, lang) || match.awayClubId;
  const line = match.userLine;
  const campFeedback = match.competitionId.startsWith('friendly')
    ? state.inbox.find(
      (message) => message.week === match.week
        && message.season === match.season
        && message.category === 'manager'
        && message.titleKey === `inbox.trainingCampFeedback.${match.week}`
        && message.action?.type === 'setTrainingFocus',
    )
    : undefined;
  // A match report is a highlights reel, not a log: keep every decisive moment but
  // only a couple of the near misses, otherwise the timeline reads like a stuck record.
  const allEvents = match.events ?? [];
  let missesShown = 0;
  const events = allEvents.filter((e) => {
    if (e.ambient) return false;
    const decisive = e.type === 'goal' || e.type === 'concede' || e.type === 'assist'
      || e.type === 'yellow' || e.type === 'red' || e.type === 'injury' || e.type === 'penaltyAwarded'
      || e.type === 'penaltyScored' || e.type === 'penaltyMissed';
    if (decisive) return true;
    if (!e.byUser) return false;
    if (e.type === 'miss' || e.type === 'save') {
      missesShown += 1;
      return missesShown <= 2;
    }
    return true;
  });

  return (
    <div className="screen stack match-report">
      <div className="match-report-meta">
        <span className="eyebrow">{competitionLabel(match.competitionId, pack, lang, t)}</span>
        <span className="eyebrow">
          {formatSeason(match.season)} · {t('hub.week', { week: match.week })}
        </span>
      </div>

      <Card lit>
        <div className="scoreline">
          <div className="side">
            {home
              ? <Crest club={home} size="lg" />
              : <span className="crest crest-lg crest-fallback">{homeLabel.slice(0, 2)}</span>}
            <span>{homeLabel}</span>
          </div>
          <div className="score">
            {match.homeGoals}–{match.awayGoals}
          </div>
          <div className="side away">
            {away
              ? <Crest club={away} size="lg" />
              : <span className="crest crest-lg crest-fallback">{awayLabel.slice(0, 2)}</span>}
            <span>{awayLabel}</span>
          </div>
        </div>
        {match.importance && match.importance !== 'normal' && (
          <p className="eyebrow" style={{ textAlign: 'center', marginBlockStart: 10, color: 'var(--amber)' }}>
            {t(`match.importance.${match.importance}`)}
          </p>
        )}
      </Card>

      {line?.played ? (
        <>
          <Card title={t('match.rating')}>
            <div className="match-player-summary" style={{ marginBlockEnd: 12 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="chip">{line.position}</span>
                <span className="num">{line.minutes}′</span>
                {line.motm && <span className="chip chip-flood">{t('match.motm')}</span>}
              </div>
              <span className="num" style={{ fontSize: 30 }}>
                <RatingBadge rating={line.rating} />
              </span>
            </div>
            <p className="faint" style={{ fontSize: 12, marginBlockEnd: 10 }}>
              {line.started ? t('match.started') : t('match.cameOn', { minute: line.cameOnMinute ?? 0 })}
              {' · '}
              {line.offMinute
                ? t('match.cameOff', { minute: line.offMinute })
                : t('match.sawItOut')}
              {' · '}
              {t('match.minutesPlayed', { minutes: line.minutes })}
            </p>
            <div className="statrow">
              <Stat label={t('match.goals')} value={line.goals} />
              <Stat label={t('match.assists')} value={line.assists} />
              <Stat label={t('match.shots')} value={line.shots} />
              <Stat label={line.saves > 0 ? t('match.saves') : t('match.keyPasses')} value={line.saves > 0 ? line.saves : line.keyPasses} />
            </div>
          </Card>

          {campFeedback && (
            <Card title={t('train.coachPlan')} className="camp-report-feedback">
              <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                {t(campFeedback.titleKey, localiseArgs(campFeedback.args, getPack().clubs, lang))}
              </p>
              <button
                className="btn btn-primary btn-block"
                style={{ marginBlockStart: 12 }}
                onClick={() => applyInboxAction(campFeedback.id)}
              >
                {t('inbox.action.applyTraining')}
              </button>
            </Card>
          )}

          {match.instruction && (
            <Card title={t('live.activeInstruction')}>
              <p style={{ fontWeight: 700 }}>{t(`halfTime.instruction.${match.instruction}`)}</p>
              <p className="faint" style={{ fontSize: 12.5, marginBlockStart: 5 }}>
                {t(`halfTime.instruction.${match.instruction}.hint`)}
              </p>
              {(match.instructionChanges?.length ?? 0) > 0 && (
                <div className="match-instruction-history">
                  {match.instructionChanges!.map((change) => (
                    <span className="chip" key={`${change.minute}-${change.instruction}`}>
                      <span className="num">{change.minute}′</span> · {t(`halfTime.instruction.${change.instruction}`)}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}

          {events.length > 0 && (
            <Card title="90′">
              <div className="timeline match-report-timeline">
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
                      <p style={{ fontSize: 13.5, color: event.byUser ? 'var(--text)' : 'var(--muted)' }}>
                        {t(variantKey(event.detailKey ?? `match.event.${event.type}`, event.minute))}
                        {namedFor(event, state, lang) && (
                          <span className="who"> · {namedFor(event, state, lang)}</span>
                        )}
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
            </Card>
          )}
        </>
      ) : (
        <Card>
          <p className="headline">{t('match.didNotPlay')}</p>
          {line?.reasonNotPlayed && (
            <p className="muted" style={{ marginBlockStart: 6, fontSize: 13.5 }}>
              {t(`match.reason.${line.reasonNotPlayed}`)}
            </p>
          )}
        </Card>
      )}

      <Card title={t('club.fixtures')}>
        <ul className="list">
          {recentMatches(state).map((m) => {
            const h = club(state, m.homeClubId);
            const a = club(state, m.awayClubId);
            return (
              <li key={m.id} className="list-item fixture-row">
                <span className="faint num" style={{ fontSize: 11 }}>{m.week}</span>
                <span className="score-row" style={{ fontSize: 13 }}>
                  <Crest club={h} size="sm" />
                  <span className="num">{m.homeGoals}–{m.awayGoals}</span>
                  <Crest club={a} size="sm" />
                </span>
                <span className="fixture-rating">
                  {m.userLine?.played ? (
                    <RatingBadge rating={m.userLine.rating} />
                  ) : (
                    <span className="faint" style={{ fontSize: 11 }}>—</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
