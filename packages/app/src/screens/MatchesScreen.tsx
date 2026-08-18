import { useState } from 'react';
import type { MatchResult } from '@fc/engine';
import { formatSeason, useLang, useT } from '../i18n/index.js';
import { competitionName } from '../lib/names.js';
import { getPack, useGame } from '../state/store.js';
import { clubShortName } from '../lib/club.js';
import { Card, Crest, Empty, RatingBadge, ResultDot, Stat } from '../components/ui.js';

/**
 * Every match of the season: the result, and what he did in it. This is the page a
 * player checks after a run of games, so it has to answer "how am I actually doing".
 */
export function MatchesScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const goto = useGame((s) => s.goto);
  const pack = getPack();

  const seasons = [...new Set(state.matchLog.map((m) => m.season))].sort((a, b) => b - a);
  const [season, setSeason] = useState(seasons[0] ?? state.world.season);

  const matches = state.matchLog
    .filter((m) => m.season === season)
    .slice()
    .sort((a, b) => b.week - a.week);

  const played = matches.filter((m) => m.userLine?.played);
  const totals = played.reduce(
    (acc, m) => {
      const line = m.userLine!;
      acc.minutes += line.minutes;
      acc.goals += line.goals;
      acc.assists += line.assists;
      acc.rating += line.rating;
      acc.conceded += concededBy(state.player.clubId, m);
      if (concededBy(state.player.clubId, m) === 0 && line.minutes >= 60) acc.cleanSheets++;
      return acc;
    },
    { minutes: 0, goals: 0, assists: 0, rating: 0, conceded: 0, cleanSheets: 0 },
  );

  const competition = (id: string) => competitionName(pack.competitions.find((c) => c.id === id), lang) || t('club.cup');

  return (
    <div className="screen stack">
      <header className="row-between">
        <div>
          <p className="eyebrow">{t('matches.title')}</p>
          <h1 className="title">{formatSeason(season)}</h1>
        </div>
        {seasons.length > 1 && (
          <select
            value={season}
            onChange={(event) => setSeason(Number(event.target.value))}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--pill)',
              padding: '8px 12px',
              fontSize: 13,
            }}
          >
            {seasons.map((value) => (
              <option key={value} value={value}>{formatSeason(value)}</option>
            ))}
          </select>
        )}
      </header>

      <Card>
        <div className="statrow">
          <Stat label={t('career.apps')} value={played.length} />
          <Stat label={t('match.goals')} value={totals.goals} />
          <Stat label={t('match.assists')} value={totals.assists} />
          <Stat label={t('match.rating')} value={played.length > 0 ? (totals.rating / played.length).toFixed(2) : '—'} />
        </div>
        <div className="statrow" style={{ marginBlockStart: 10 }}>
          <Stat label={t('match.minutes')} value={totals.minutes} />
          <Stat label={t('match.conceded')} value={totals.conceded} />
          <Stat label={t('match.cleanSheets')} value={totals.cleanSheets} />
          <Stat label={t('matches.missed')} value={matches.length - played.length} />
        </div>
      </Card>

      {matches.length === 0 ? (
        <Empty>{t('matches.none')}</Empty>
      ) : (
        <Card title={t('matches.list')}>
          <ul className="list">
            {matches.map((match) => {
              const mine = state.player.clubId;
              const isHome = match.homeClubId === mine;
              const opponent = state.world.clubs[isHome ? match.awayClubId : match.homeClubId];
              const forGoals = isHome ? match.homeGoals : match.awayGoals;
              const againstGoals = isHome ? match.awayGoals : match.homeGoals;
              const outcome = forGoals > againstGoals ? 'W' : forGoals === againstGoals ? 'D' : 'L';
              const line = match.userLine;

              return (
                <li key={match.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <ResultDot result={outcome} />
                  <Crest club={opponent} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row-between">
                      <span style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {clubShortName(opponent, lang)}
                      </span>
                      <span className="num" style={{ fontSize: 14 }}>{forGoals}–{againstGoals}</span>
                    </div>
                    <div className="row-between" style={{ marginBlockStart: 3 }}>
                      <span className="faint" style={{ fontSize: 11 }}>
                        {isHome ? t('match.home') : t('match.away')} · {competition(match.competitionId)}
                      </span>
                      {line?.played ? (
                        <span className="faint" style={{ fontSize: 11.5 }}>
                          <span className="num">{line.minutes}′</span>
                          {line.goals > 0 && <> · ⚽ <span className="num">{line.goals}</span></>}
                          {line.assists > 0 && <> · 🅰 <span className="num">{line.assists}</span></>}
                          {line.yellow > 0 && <> · 🟨</>}
                          {line.red > 0 && <> · 🟥</>}
                          {line.saves > 0 && <> · 🧤 <span className="num">{line.saves}</span></>}
                        </span>
                      ) : (
                        <span className="faint" style={{ fontSize: 11 }}>
                          {t(`match.reason.${line?.reasonNotPlayed ?? 'notSelected'}`)}
                        </span>
                      )}
                    </div>
                  </div>
                  {line?.played ? <RatingBadge rating={line.rating} /> : <span className="faint">—</span>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {state.lastMatch && (
        <button className="btn btn-block" onClick={() => goto('match')}>
          {t('hub.lastMatch')} →
        </button>
      )}
    </div>
  );
}

function concededBy(clubId: string | null, match: MatchResult): number {
  if (!clubId) return 0;
  return match.homeClubId === clubId ? match.awayGoals : match.homeGoals;
}
