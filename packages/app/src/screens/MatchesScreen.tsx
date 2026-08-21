import { useState } from 'react';
import type { MatchResult } from '@fc/engine';
import { formatSeason, useLang, useT } from '../i18n/index.js';
import { competitionLabel, competitionName, countryName } from '../lib/names.js';
import { getPack, useGame } from '../state/store.js';
import { clubShortName } from '../lib/club.js';
import { Card, Crest, Empty, RatingBadge, ResultDot, Stat } from '../components/ui.js';
import { RoundScreen } from './RoundScreen.js';

type MatchKind = 'official' | 'friendly';
type OfficialCategory = 'all' | 'league' | 'cup' | 'europe' | 'national';

function matchKind(match: MatchResult): MatchKind {
  return match.competitionId.startsWith('friendly') ? 'friendly' : 'official';
}

function officialCategory(match: MatchResult): Exclude<OfficialCategory, 'all'> {
  const id = match.competitionId.toLowerCase();
  if (id === 'ucl' || id === 'uel' || id === 'uecl' || id.startsWith('europe.')) return 'europe';
  if (id.endsWith('_cup') || id.startsWith('cup.')) return 'cup';
  if (id.startsWith('national.') || id.startsWith('international.') || id.startsWith('qualifier.')) return 'national';
  return 'league';
}

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
  // Two questions live on this page: how am I doing, and what happened last weekend.
  const [view, setView] = useState<'mine' | 'round'>('mine');
  const [kind, setKind] = useState<MatchKind>('official');
  const [official, setOfficial] = useState<OfficialCategory>('all');

  /*
   * Sunday morning and Saturday afternoon are two different careers, and adding them up
   * together tells him nothing: thirty appearances reads like a season in the first team
   * when twenty of them were in the age group. The list and the totals above it follow
   * whichever football he is asking about.
   */
  const seasonMatches = state.matchLog.filter((m) => m.season === season);
  const isYouth = (id: string) => id.endsWith('.youth');
  const hasYouth = seasonMatches.some((m) => isYouth(m.competitionId));
  const hasSenior = seasonMatches.some((m) => !isYouth(m.competitionId));
  const [side, setSide] = useState<'all' | 'senior' | 'youth'>('all');

  const sideMatches = seasonMatches.filter(
    (match) => (side === 'all' ? true : side === 'youth' ? isYouth(match.competitionId) : !isYouth(match.competitionId)),
  );
  const hasOfficial = sideMatches.some((match) => match.userLine?.played && matchKind(match) === 'official');
  const hasFriendlies = sideMatches.some((match) => match.userLine?.played && matchKind(match) === 'friendly');
  const shownKind: MatchKind = kind === 'official' && !hasOfficial && hasFriendlies
    ? 'friendly'
    : kind === 'friendly' && !hasFriendlies && hasOfficial ? 'official' : kind;
  const availableOfficial = (['league', 'cup', 'europe', 'national'] as const).filter((category) =>
    sideMatches.some(
      (match) => match.userLine?.played && matchKind(match) === 'official' && officialCategory(match) === category,
    ),
  );
  const shownOfficial: OfficialCategory = official !== 'all' && !availableOfficial.includes(official)
    ? 'all'
    : official;

  const matches = sideMatches
    .filter((match) => matchKind(match) === shownKind)
    .filter((match) => shownKind === 'friendly' || shownOfficial === 'all' || officialCategory(match) === shownOfficial)
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
      const teamId = m.userClubId ?? state.player.clubId;
      acc.conceded += concededBy(teamId, m);
      if (concededBy(teamId, m) === 0 && line.minutes >= 60) acc.cleanSheets++;
      return acc;
    },
    { minutes: 0, goals: 0, assists: 0, rating: 0, conceded: 0, cleanSheets: 0 },
  );

  const competition = (id: string) => competitionLabel(id, pack, lang, t);

  if (view === 'round') {
    return (
      <div className="stack" style={{ gap: 0 }}>
        <div className="seg" style={{ margin: '12px 14px 0' }}>
          <button aria-pressed={false} onClick={() => setView('mine')}>{t('matches.mine')}</button>
          <button aria-pressed>{t('matches.round')}</button>
        </div>
        <RoundScreen />
      </div>
    );
  }

  return (
    <div className="screen stack">
      <div className="seg">
        <button aria-pressed onClick={() => setView('mine')}>{t('matches.mine')}</button>
        <button aria-pressed={false} onClick={() => setView('round')}>{t('matches.round')}</button>
      </div>
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

      {hasYouth && hasSenior && (
        <div className="seg">
          <button aria-pressed={side === 'all'} onClick={() => setSide('all')}>{t('matches.all')}</button>
          <button aria-pressed={side === 'senior'} onClick={() => setSide('senior')}>{t('matches.senior')}</button>
          <button aria-pressed={side === 'youth'} onClick={() => setSide('youth')}>{t('matches.youth')}</button>
        </div>
      )}

      {hasOfficial && hasFriendlies && (
        <div className="seg" aria-label={t('matches.matchType')}>
          <button aria-pressed={shownKind === 'official'} onClick={() => setKind('official')}>
            {t('matches.official')}
          </button>
          <button aria-pressed={shownKind === 'friendly'} onClick={() => setKind('friendly')}>
            {t('matches.friendlies')}
          </button>
        </div>
      )}

      {shownKind === 'official' && availableOfficial.length > 1 && (
        <div className="row wrap competition-filters" role="group" aria-label={t('matches.officialCompetition')}>
          <button className="chip" aria-pressed={shownOfficial === 'all'} onClick={() => setOfficial('all')}>
            {t('matches.officialAll')}
          </button>
          {availableOfficial.map((category) => (
            <button
              className="chip"
              key={category}
              aria-pressed={shownOfficial === category}
              onClick={() => setOfficial(category)}
            >
              {t(`matches.filter.${category}`)}
            </button>
          ))}
        </div>
      )}

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
              const mine = match.userClubId ?? state.player.clubId;
              const isHome = match.homeClubId === mine;
              const opponentId = isHome ? match.awayClubId : match.homeClubId;
              const opponent = state.world.clubs[opponentId];
              const opponentCountry = pack.countries.find((country) => country.code === opponentId);
              const opponentLabel = opponent
                ? clubShortName(opponent, lang)
                : countryName(opponentCountry, lang) || opponentId;
              const forGoals = isHome ? match.homeGoals : match.awayGoals;
              const againstGoals = isHome ? match.awayGoals : match.homeGoals;
              const outcome = forGoals > againstGoals ? 'W' : forGoals === againstGoals ? 'D' : 'L';
              const line = match.userLine;

              return (
                <li key={match.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <ResultDot result={outcome} />
                  {opponent
                    ? <Crest club={opponent} />
                    : <span className="crest crest-fallback">{opponentLabel.slice(0, 2)}</span>}
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row-between">
                      <span style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {opponentLabel}
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
