import { useState } from 'react';
import {
  buildTeamOfTheWeek, sortedTable, userYouthCompetitionId,
  type CompetitionSeasonState, type Fixture, type TeamOfTheWeekEntry,
} from '@fc/engine';
import { useLang, useT } from '../i18n/index.js';
import { clubShortName } from '../lib/club.js';
import { competitionLabel, playerName } from '../lib/names.js';
import { getPack, useGame } from '../state/store.js';
import { club } from '../state/selectors.js';
import { Card, Crest, Empty } from '../components/ui.js';

/**
 * The matchday.
 *
 * A player who was not picked still wants to know what happened - what the score was,
 * who scored it, and where that leaves his side. Without this the table simply moves
 * every week and he never sees the football that moved it.
 */
export function RoundScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const pack = getPack();

  const clubId = state.player.clubId;
  const youthId = userYouthCompetitionId(state);
  const youth = youthId ? state.world.youth?.competitions[youthId] ?? null : null;
  const senior = clubId ? state.world.competitions[state.world.clubs[clubId]?.competitionId ?? ''] ?? null : null;

  // A boy in an academy is shown his own division first; everybody else the first team's.
  const options = [youth, senior].filter((c): c is CompetitionSeasonState => Boolean(c));
  const [pickedId, setPickedId] = useState(options[0]?.competitionId ?? '');
  const comp = options.find((c) => c.competitionId === pickedId) ?? options[0] ?? null;

  const playedRounds = comp
    ? [...new Set(comp.fixtures.filter((f) => f.played).map((f) => f.round))].sort((a, b) => b - a)
    : [];
  const [round, setRound] = useState<number | null>(null);
  const shownRound = round !== null && playedRounds.includes(round) ? round : playedRounds[0] ?? null;

  if (!comp || shownRound === null) {
    return (
      <div className="screen">
        <Empty>{t('round.none')}</Empty>
      </div>
    );
  }

  const fixtures = comp.fixtures.filter((f) => f.round === shownRound);
  // The division's eleven for this round, rebuilt from the same fixtures the page is
  // showing. Deterministic, so the round he looked at last week reads the same today.
  const roundWeek = fixtures.find((f) => f.played)?.week ?? null;
  const eleven = roundWeek === null
    ? null
    : buildTeamOfTheWeek(state, comp.competitionId, roundWeek, comp === youth);
  const table = sortedTable(comp);
  const place = clubId ? table.findIndex((row) => row.clubId === clubId) + 1 : 0;

  return (
    <div className="screen stack">
      <header className="row-between">
        <div>
          <p className="eyebrow">{t('round.title')}</p>
          <h1 className="title">{t('round.number', { round: shownRound })}</h1>
        </div>
        {options.length > 1 && (
          <select
            className="picker"
            value={comp.competitionId}
            onChange={(event) => { setPickedId(event.target.value); setRound(null); }}
            aria-label={t('round.title')}
          >
            {options.map((option) => (
              <option key={option.competitionId} value={option.competitionId}>
                {competitionLabel(option.competitionId, pack, lang, t)}
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="row" style={{ gap: 8 }}>
        <button
          className="btn grow"
          disabled={!playedRounds.includes(shownRound + 1)}
          onClick={() => setRound(shownRound + 1)}
        >
          {t('round.later')}
        </button>
        <button
          className="btn grow"
          disabled={!playedRounds.includes(shownRound - 1)}
          onClick={() => setRound(shownRound - 1)}
        >
          {t('round.earlier')}
        </button>
      </div>

      <Card title={competitionLabel(comp.competitionId, pack, lang, t)}>
        <ul className="list">
          {fixtures.map((fixture, i) => (
            <FixtureRow key={`${fixture.homeClubId}-${fixture.awayClubId}-${i}`} fixture={fixture} comp={comp} />
          ))}
        </ul>
      </Card>

      {eleven && (
        <Card title={t('round.teamOfTheWeek')}>
          <ul className="list">
            {eleven.entries.map((entry) => (
              <ElevenRow key={entry.playerId} entry={entry} />
            ))}
          </ul>
        </Card>
      )}

      {place > 0 && (
        <p className="faint center" style={{ fontSize: 12 }}>
          {t('round.standing', { place, teams: table.length })}
        </p>
      )}
    </div>
  );
}

/** One name in the eleven: where he played, who for, and what he was given. */
function ElevenRow({ entry }: { entry: TeamOfTheWeekEntry }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const side = club(state, entry.clubId);
  const player = entry.isUser
    ? state.player
    : state.world.players[entry.playerId] ?? state.world.youth?.players[entry.playerId];
  return (
    <li className={`list-item ${entry.isUser ? 'me' : ''}`}>
      <span className="chip" style={{ minWidth: 38, justifyContent: 'center' }}>
        {t(`pos.${entry.slot}`)}
      </span>
      <span className="grow" style={{ minWidth: 0, fontSize: 13 }}>
        {playerName(player, lang) || entry.name}
        {entry.goals > 0 && <span className="faint"> {'⚽'.repeat(Math.min(entry.goals, 4))}</span>}
      </span>
      <Crest club={side} size="sm" />
      <span className="num" style={{ fontSize: 13 }} dir="ltr">{entry.rating.toFixed(1)}</span>
    </li>
  );
}

function FixtureRow({ fixture, comp }: { fixture: Fixture; comp: CompetitionSeasonState }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const mine = state.player.clubId;
  const home = club(state, fixture.homeClubId);
  const away = club(state, fixture.awayClubId);
  const involvesHim = fixture.homeClubId === mine || fixture.awayClubId === mine;

  // What he did in it. The same two clubs meet twice a season, so the week has to match
  // as well - otherwise the second meeting shows what he did in the first.
  const his = involvesHim && fixture.played
    ? state.matchLog.find(
      (m) => m.competitionId === comp.competitionId
        && m.homeClubId === fixture.homeClubId
        && m.awayClubId === fixture.awayClubId
        && m.season === comp.season
        && m.week === fixture.week,
    )
    : undefined;
  const line = his?.userLine;

  const named = (playerId: string) => {
    if (playerId === state.player.id) return playerName(state.player, lang);
    const senior = state.world.players[playerId];
    if (senior) return playerName(senior, lang);
    const boy = state.world.youth?.players[playerId];
    return boy ? playerName(boy, lang) : '';
  };

  return (
    <li className={`list-item ${involvesHim ? 'me' : ''}`} style={{ alignItems: 'flex-start' }}>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row-between">
          <span className="row" style={{ gap: 6, minWidth: 0 }}>
            <Crest club={home} size="sm" />
            <span style={{ fontSize: 13 }}>{clubShortName(home, lang)}</span>
          </span>
          <span className="num" style={{ fontSize: 14 }} dir="ltr">
            {fixture.result ? `${fixture.result[0]}–${fixture.result[1]}` : '—'}
          </span>
          <span className="row" style={{ gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 13 }}>{clubShortName(away, lang)}</span>
            <Crest club={away} size="sm" />
          </span>
        </div>

        {(fixture.goals ?? []).length > 0 && (
          <ul className="stack" style={{ gap: 2, marginBlockStart: 6 }}>
            {(fixture.goals ?? []).map((goal, i) => (
              <li key={`${goal.playerId}-${i}`} className="faint" style={{ fontSize: 11.5 }}>
                ⚽ {named(goal.playerId) || '—'}
                <span className="faint"> ({clubShortName(club(state, goal.clubId), lang)})</span>
                {goal.assistId && named(goal.assistId) && (
                  <span className="faint"> · {t('round.assistedBy', { player: named(goal.assistId) })}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {involvesHim && fixture.played && (
          <p style={{ fontSize: 11.5, marginBlockStart: 6, color: 'var(--amber)' }}>
            {line?.played
              ? t('round.yourLine', {
                minutes: line.minutes,
                goals: line.goals,
                assists: line.assists,
                rating: line.rating.toFixed(1),
              })
              : t(`round.didNotPlay.${line?.reasonNotPlayed ?? 'notSelected'}`)}
          </p>
        )}
      </div>
    </li>
  );
}
