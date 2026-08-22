import { useState } from 'react';
import {
  estimatedScorers,
  leaguePhaseTable,
  sortedTable,
  userYouthCompetitionId,
  type CareerState,
  type EuroState,
} from '@fc/engine';
import { useLang, useT } from '../i18n/index.js';
import { cityName, clubName, clubShortName } from '../lib/club.js';
import { toHebrew } from '../lib/transliterate.js';
import { competitionLabel, competitionName, findPlayer, playerName } from '../lib/names.js';
import { getPack, useGame } from '../state/store.js';
import { club, myClub, myCompetitionState, squad, table, topScorers } from '../state/selectors.js';
import { Card, ClubLine, Crest, Empty, Meter } from '../components/ui.js';
import { YouthScreen } from './YouthScreen.js';
import { clubColor } from '../lib/club.js';

type Tab = 'table' | 'squad' | 'scorers' | 'europe' | 'youth';

export function ClubScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  // A sixteen year old's league is the youth league. Opening his club on the first
  // team's table would be showing him a competition he does not play in.
  const inTheAgeGroup = Boolean(state.world.youth && userYouthCompetitionId(state));
  const [tab, setTab] = useState<Tab>(inTheAgeGroup ? 'youth' : 'table');
  const home = myClub(state);
  // Whether his football happens in Europe at all.
  const inEurope = ((getPack().countries.find((c) => c.code === home?.country)?.confederation ?? 'UEFA') === 'UEFA');

  if (!home) {
    return (
      <div className="screen">
        <Empty>{t('hub.freeAgent')}</Empty>
      </div>
    );
  }

  return (
    <div className="screen stack">
      <header
        className="row"
        style={{
          gap: 12,
          padding: '12px 14px',
          borderRadius: 'var(--radius)',
          background: `linear-gradient(110deg, ${clubColor(home)}40, transparent 70%)`,
        }}
      >
        <Crest club={home} size="lg" />
        <div>
          <p className="eyebrow">{t('club.title')}</p>
          <h1 className="title">{clubName(home, lang)}</h1>
          {/* The city was the last Latin word left on a Hebrew screen. */}
          <p className="faint" style={{ fontSize: 12 }}>{cityName(home.city, lang)}</p>
        </div>
      </header>

      <Card>
        <div className="stack" style={{ gap: 9 }}>
          <Bar label={t('club.facilities')} value={home.training} />
          <Bar label={t('club.academyQuality')} value={home.academy} />
          <Bar label={t('club.finances')} value={home.finances} />
          <Bar label={t('academy.reputation')} value={home.reputation} />
        </div>
      </Card>

      <div className="seg">
        <button aria-pressed={tab === 'table'} onClick={() => setTab('table')}>{t('club.table')}</button>
        <button aria-pressed={tab === 'squad'} onClick={() => setTab('squad')}>{t('club.squad')}</button>
        <button aria-pressed={tab === 'scorers'} onClick={() => setTab('scorers')}>{t('club.scorers')}</button>
        {/* The age group has its own table, its own chart and its own boys. */}
        {state.world.youth && (
          <button aria-pressed={tab === 'youth'} onClick={() => setTab('youth')}>{t('youth.tab')}</button>
        )}
        {/*
          Europe is there whether or not his own club is in it: he wants to follow it.
          Not, though, if he plays in Brazil - a Thursday night in Trabzon is nothing to
          do with him, and the tab was offering him a competition he cannot reach.
        */}
        {Object.keys(state.world.europe ?? {}).length > 0 && inEurope && (
          <button aria-pressed={tab === 'europe'} onClick={() => setTab('europe')}>{t('competition.europe')}</button>
        )}
      </div>

      {tab === 'table' && <LeagueTable />}
      {tab === 'squad' && <SquadList />}
      {tab === 'scorers' && <Scorers />}
      {tab === 'youth' && <YouthScreen />}
      {tab === 'europe' && <EuropeanRun />}
    </div>
  );
}


/** The European competition the user's club is in this season, if any. */
function europeanRun(state: CareerState): EuroState | null {
  const clubId = state.player.clubId;
  if (!clubId) return null;
  for (const competition of Object.values(state.world.europe ?? {}) as EuroState[]) {
    const inGroup =
      Boolean(competition.leaguePhase?.[clubId]) || competition.groups.some((g) => g.clubIds.includes(clubId));
    const inKnockout = competition.ties.some((tie) => tie.homeClubId === clubId || tie.awayClubId === clubId);
    if (inGroup || inKnockout) return competition;
  }
  return null;
}

/** The group table and the ties, which is all a player needs to know about the draw. */
/**
 * All of Europe, not only his corner of it: pick the competition, see every group,
 * every knockout tie and who is left. His own club and his own group are marked, but
 * nothing is hidden - the whole draw is there.
 */
/**
 * Europe, laid out the way you would actually read it: pick the competition, pick the
 * group, and look at either the table or that group's results. The knockout bracket is
 * its own view. Nothing is stacked into one endless scroll.
 */
/**
 * One fixture, written the way a results page writes it: both clubs by name, the
 * score in the middle, and on a second leg the first leg in brackets so the tie makes
 * sense without scrolling back up.
 */
function TieRow({
  homeClubId,
  awayClubId,
  result,
  label,
  note,
}: {
  homeClubId: string;
  awayClubId: string;
  result?: [number, number] | undefined;
  label?: string;
  note?: string;
}) {
  const lang = useLang((x) => x.lang);
  const state = useGame((s) => s.state)!;
  const mine = state.player.clubId;
  const home = club(state, homeClubId);
  const away = club(state, awayClubId);

  return (
    <li className="list-item tie-row">
      {label && <span className="chip tie-stage">{label}</span>}
      <span className={`tie-side tie-home ${homeClubId === mine ? 'me' : ''}`}>
        <span className="tie-name">{clubShortName(home, lang) || homeClubId}</span>
        <Crest club={home} size="sm" />
      </span>
      <span className="tie-score num">
        {result ? `${result[0]}\u2013${result[1]}` : '–'}
        {note && <small className="tie-note">{note}</small>}
      </span>
      <span className={`tie-side tie-away ${awayClubId === mine ? 'me' : ''}`}>
        <Crest club={away} size="sm" />
        <span className="tie-name">{clubShortName(away, lang) || awayClubId}</span>
      </span>
    </li>
  );
}

function EuropeanRun() {
  const t = useT();
  const lang = useLang((x) => x.lang);
  const state = useGame((s) => s.state)!;
  const competitions = Object.values(state.world.europe ?? {}) as EuroState[];
  const mine = europeanRun(state);
  const myClubId = state.player.clubId;

  const [selected, setSelected] = useState(mine?.id ?? competitions[0]?.id ?? '');
  const [view, setView] = useState<'table' | 'results' | 'knockout'>('table');
  const [groupLetter, setGroupLetter] = useState<string>('');
  const [matchday, setMatchday] = useState<number>(0);

  if (competitions.length === 0) return <Empty>—</Empty>;
  const competition = competitions.find((c) => c.id === selected) ?? competitions[0]!;

  // One table of thirty-six, or the eight groups a career saved under the old format is
  // still playing.
  const phase = competition.leaguePhase;
  const phaseRows = phase ? leaguePhaseTable(competition) : [];
  const matchdays = [...new Set(competition.fixtures.map((f) => f.round))].sort((a, b) => a - b);
  const shownDay = matchdays.includes(matchday) ? matchday : matchdays[0] ?? 0;

  const myGroup = competition.groups.find((g) => g.clubIds.includes(myClubId ?? ''));
  const group =
    competition.groups.find((g) => g.letter === groupLetter) ?? myGroup ?? competition.groups[0];

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="seg">
        {competitions.map((entry) => (
          <button key={entry.id} aria-pressed={entry.id === competition.id} onClick={() => setSelected(entry.id)}>
            {t(`competition.${entry.id}`)}{mine?.id === entry.id ? ' ★' : ''}
          </button>
        ))}
      </div>

      <div className="seg">
        <button aria-pressed={view === 'table'} onClick={() => setView('table')}>{t('europe.tables')}</button>
        <button aria-pressed={view === 'results'} onClick={() => setView('results')}>{t('europe.results')}</button>
        <button aria-pressed={view === 'knockout'} onClick={() => setView('knockout')}>{t('competition.knockout')}</button>
      </div>

      {competition.stage === 'qualifying' && (
        <Card title={t('europe.qualifying')}>
          {(competition.qualifying?.ties ?? []).length === 0 ? (
            <Empty>{t('europe.notDrawn')}</Empty>
          ) : (
            <ul className="list">
              {(competition.qualifying?.ties ?? []).map((tie, i) => (
                <TieRow
                  key={`q-${i}`}
                  label={t('europe.round', { round: tie.round })}
                  homeClubId={tie.homeClubId}
                  awayClubId={tie.awayClubId}
                  result={tie.result}
                />
              ))}
            </ul>
          )}
          <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 8 }}>{t('europe.qualifyingHint')}</p>
        </Card>
      )}

      {competition.stage !== 'qualifying' && view === 'results' && phase && matchdays.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {matchdays.map((round) => (
            <button
              key={round}
              className="chip"
              aria-pressed={round === shownDay}
              onClick={() => setMatchday(round)}
            >
              {t('europe.matchday', { round })}
            </button>
          ))}
        </div>
      )}

      {competition.stage !== 'qualifying' && view === 'table' && phase && (
        <Card title={t('europe.leaguePhase')}>
          <table className="tbl">
            <thead>
              <tr>
                <th className="start">#</th>
                <th className="n">{t('club.pld')}</th>
                <th className="n">{t('club.gd')}</th>
                <th className="n">{t('club.pts')}</th>
              </tr>
            </thead>
            <tbody>
              {phaseRows.map((row, i) => (
                <tr
                  key={row.clubId}
                  className={`${row.clubId === myClubId ? 'me' : ''} ${i === 7 ? 'cut-direct' : i === 23 ? 'cut-playoff' : ''}`}
                >
                  <td className="start">
                    <span className="row" style={{ gap: 7, minWidth: 0 }}>
                      <span className="num faint" style={{ fontSize: 11 }}>{i + 1}</span>
                      <Crest club={club(state, row.clubId)} size="sm" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {clubShortName(club(state, row.clubId), lang) || row.clubId}
                      </span>
                    </span>
                  </td>
                  <td className="n">{row.played}</td>
                  <td className="n">{row.goalsFor - row.goalsAgainst}</td>
                  <td className="n" style={{ fontWeight: 700 }}>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="faint" style={{ fontSize: 11, marginBlockStart: 8 }}>{t('europe.cutLines')}</p>
        </Card>
      )}

      {competition.stage !== 'qualifying' && view === 'results' && phase && (
        <Card title={t('europe.matchday', { round: shownDay })}>
          <ul className="list">
            {competition.fixtures
              .filter((fixture) => fixture.round === shownDay)
              .map((fixture, i) => (
                <TieRow
                  key={`md-${i}`}
                  label={`${fixture.week}`}
                  homeClubId={fixture.homeClubId}
                  awayClubId={fixture.awayClubId}
                  result={fixture.result}
                />
              ))}
          </ul>
        </Card>
      )}

      {competition.stage !== 'qualifying' && view !== 'knockout' && !phase && competition.groups.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {competition.groups.map((entry) => (
            <button
              key={entry.letter}
              className="chip"
              aria-pressed={entry.letter === group?.letter}
              onClick={() => setGroupLetter(entry.letter)}
            >
              {t('competition.group', { letter: entry.letter })}
              {myGroup?.letter === entry.letter ? ' ★' : ''}
            </button>
          ))}
        </div>
      )}

      {competition.stage !== 'qualifying' && view === 'table' && !phase && group && (
        <Card title={t('competition.group', { letter: group.letter })}>
          <table className="tbl">
            <thead>
              <tr>
                <th className="start">#</th>
                <th className="n">{t('club.pld')}</th>
                <th className="n">{t('club.gd')}</th>
                <th className="n">{t('club.pts')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(group.table)
                .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst))
                .map((row, i) => (
                  <tr key={row.clubId} className={row.clubId === myClubId ? 'me' : ''}>
                    <td className="start">
                      <span className="row" style={{ gap: 7, minWidth: 0 }}>
                        <span className="num faint" style={{ fontSize: 11 }}>{i + 1}</span>
                        <Crest club={club(state, row.clubId)} size="sm" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {clubShortName(club(state, row.clubId), lang) || row.clubId}
                        </span>
                      </span>
                    </td>
                    <td className="n">{row.played}</td>
                    <td className="n">{row.goalsFor - row.goalsAgainst}</td>
                    <td className="n" style={{ fontWeight: 700 }}>{row.points}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="faint" style={{ fontSize: 11, marginBlockStart: 8 }}>{t('europe.topTwo')}</p>
        </Card>
      )}

      {competition.stage !== 'qualifying' && view === 'results' && !phase && group && (
        <Card title={t('competition.group', { letter: group.letter })}>
          <ul className="list">
            {competition.fixtures
              .filter((fixture) => group.clubIds.includes(fixture.homeClubId))
              .sort((a, b) => a.week - b.week)
              .map((fixture, i) => (
                <TieRow
                  key={`${group.letter}-${i}`}
                  label={`${fixture.week}`}
                  homeClubId={fixture.homeClubId}
                  awayClubId={fixture.awayClubId}
                  result={fixture.result}
                />
              ))}
          </ul>
        </Card>
      )}

      {competition.stage !== 'qualifying' && view === 'knockout' && (
        <Card title={t('competition.knockout')}>
          {competition.ties.length === 0 ? (
            <Empty>{t('europe.notDrawn')}</Empty>
          ) : (
            <ul className="list">
              {competition.ties.map((tie, i) => {
                // On a second leg, show what happened in the first one.
                const firstLeg = tie.leg === 2
                  ? competition.ties.find(
                      (other) =>
                        other.stage === tie.stage &&
                        other.leg === 1 &&
                        other.homeClubId === tie.awayClubId &&
                        other.awayClubId === tie.homeClubId,
                    )
                  : undefined;
                const note = firstLeg?.result
                  ? t('europe.firstLeg', { home: firstLeg.result[1], away: firstLeg.result[0] })
                  : undefined;
                return (
                  <TieRow
                    key={`${tie.stage}-${i}`}
                    label={t(`competition.stage.${tie.stage}`)}
                    homeClubId={tie.homeClubId}
                    awayClubId={tie.awayClubId}
                    result={tie.result}
                    note={note}
                  />
                );
              })}
            </ul>
          )}
          {competition.winner && (
            <p className="eyebrow" style={{ marginBlockStart: 10 }}>
              {t('europe.winner')} · <span className="who">{clubShortName(club(state, competition.winner), lang)}</span>
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="row-between" style={{ marginBlockEnd: 4 }}>
        <span className="eyebrow">{label}</span>
        <span className="num" style={{ fontSize: 12 }}>{Math.round(value)}</span>
      </div>
      <Meter value={value} />
    </div>
  );
}

/**
 * Any table in the game, not only his own: every league we simulate, and the group
 * tables of the three European competitions. A player who has just been relegated
 * wants to see the division above him, and a player in Europe wants to see the group
 * his club drew - both are one dropdown away.
 */
function LeagueTable() {
  const t = useT();
  const lang = useLang((x) => x.lang);
  const state = useGame((s) => s.state)!;
  const pack = getPack();
  const mine = state.player.clubId;
  const myCompetition = mine ? state.world.clubs[mine]?.competitionId ?? '' : '';

  const [selected, setSelected] = useState(myCompetition);

  const leagues = pack.competitions.filter((competition) => state.world.competitions[competition.id]);

  const compState = state.world.competitions[selected];
  const rows = compState ? sortedTable(compState) : [];
  /*
   * What this division has been. Every league in the game plays out a full season, and
   * until now none of them had a past he could see - a table with no winners behind it
   * is a fixture list, not a competition.
   */
  const won = state.world.history.champions
    .filter((entry) => entry.competitionId === selected)
    .sort((a, b) => b.season - a.season)
    .slice(0, 3);

  return (
    <Card
      title={competitionLabel(selected, pack, lang, t)}
      action={
        <select
          className="picker"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          aria-label={t('club.table')}
        >
          {leagues.map((competition) => (
            <option key={competition.id} value={competition.id}>
              {competitionName(competition, lang)}
            </option>
          ))}
        </select>
      }
    >
      {rows.length === 0 ? (
        <Empty>—</Empty>
      ) : (
        <>
          {compState?.splitGroups && (
            <div className="row wrap league-split-legend">
              <span className="chip chip-green">{t('club.championshipGroup')}</span>
              <span className="chip chip-amber">{t('club.relegationGroup')}</span>
              <span className="faint">{t('club.splitPointsCarry')}</span>
            </div>
          )}
          <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('club.player')}</th>
                <th>{t('club.pld')}</th>
                <th>{t('club.won')}</th>
                <th>{t('club.drawn')}</th>
                <th>{t('club.lost')}</th>
                <th>{t('club.gd')}</th>
                <th>{t('club.pts')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.clubId}
                  className={`${row.clubId === mine ? 'me' : ''} ${compState?.splitGroups && i === compState.splitGroups.upper.length ? 'split-cut' : ''}`}
                >
                  <td className="n">{i + 1}</td>
                  <td className="start">
                    <span className="row" style={{ gap: 7, minWidth: 0 }}>
                      <Crest club={club(state, row.clubId)} size="sm" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {clubShortName(club(state, row.clubId), lang) || row.clubId}
                      </span>
                    </span>
                  </td>
                  <td className="n">{row.played}</td>
                  <td className="n">{row.won}</td>
                  <td className="n">{row.drawn}</td>
                  <td className="n">{row.lost}</td>
                  <td className="n">{row.goalsFor - row.goalsAgainst}</td>
                  <td className="n" style={{ fontWeight: 700 }}>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {won.length > 0 && (
            <div className="stack" style={{ gap: 4, marginBlockStart: 10 }}>
              <p className="eyebrow">{t('club.pastChampions')}</p>
              {won.map((entry) => (
                <p key={entry.season} className="faint" style={{ fontSize: 12 }}>
                  <span dir="ltr">{`${entry.season}/${String((entry.season + 1) % 100).padStart(2, '0')}`}</span>
                  {' · '}
                  {clubShortName(club(state, entry.clubId), lang) || entry.clubId}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/** Every group of a European competition, and the knockout ties once they are drawn. */
function SquadList() {
  const t = useT();
  const lang = useLang((x) => x.lang);
  const state = useGame((s) => s.state)!;
  const players = squad(state);

  if (players.length === 0) return <Empty>—</Empty>;

  return (
    <Card title={t('club.squad')}>
      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('club.pos')}</th>
              <th>{t('club.player')}</th>
              <th>{t('club.age')}</th>
              <th>{t('club.ovr')}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((entry) => (
              <tr key={entry.player.id} className={entry.isUser ? 'me' : ''}>
                <td className="n">{entry.player.primaryPos}</td>
                <td className="start">
                  {playerName(entry.player, lang)}
                  {entry.isUser && <span className="chip chip-flood" style={{ marginInlineStart: 6 }}>{t('club.you')}</span>}
                </td>
                <td className="n">{entry.age}</td>
                <td className="n" style={{ fontWeight: 700 }}>{entry.ovr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * The charts: who is scoring, who is creating and who cannot stay out of the
 * referee's book - for any league we simulate, not only his own.
 */
function Scorers() {
  const t = useT();
  const lang = useLang((x) => x.lang);
  const state = useGame((s) => s.state)!;
  const index = useGame((s) => s.index)!;
  const pack = getPack();
  const mine = state.player.clubId;
  const myCompetition = mine ? state.world.clubs[mine]?.competitionId ?? '' : '';

  const [selected, setSelected] = useState(myCompetition);
  const [chart, setChart] = useState<'goals' | 'assists' | 'cards'>('goals');

  const leagues = pack.competitions.filter((competition) => state.world.competitions[competition.id]);
  const youth = state.world.youth;
  const compState = state.world.competitions[selected];

  type ChartRow = { playerId: string; value: number; second?: number; name?: string; clubId?: string };
  // A league nobody is simulating player by player still has somebody top of its scoring
  // chart, and he follows it the way anybody follows the leagues he does not play in.
  const estimated = chart === 'goals' && Object.keys(compState?.scorers ?? {}).length === 0;
  const rows: ChartRow[] = (() => {
    if (!compState) return [];
    if (chart === 'goals') {
      if (estimated) {
        return estimatedScorers(state, index, selected, 15)
          .map((row) => ({ playerId: row.playerId, value: row.goals, name: row.name, clubId: row.clubId }));
      }
      return Object.entries(compState.scorers)
        .map(([playerId, value]) => ({ playerId, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);
    }
    if (chart === 'assists') {
      return Object.entries(compState.assists ?? {})
        .map(([playerId, value]) => ({ playerId, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);
    }
    return Object.entries(compState.cards ?? {})
      .map(([playerId, card]) => ({ playerId, value: card.yellow, second: card.red }))
      // A red is worth three yellows when ranking the worst disciplinary record.
      .sort((a, b) => b.value + b.second * 3 - (a.value + a.second * 3))
      .slice(0, 15);
  })();

  const nameOf = (row: ChartRow): string => {
    if (row.name) return lang === 'he' ? toHebrew(row.name) : row.name;
    if (row.playerId === state.player.id) return `${state.player.firstName} ${state.player.lastName}`;
    const player = findPlayer(state, row.playerId);
    return player ? playerName(player, lang) : row.playerId;
  };

  const clubOf = (row: ChartRow) => {
    if (row.clubId) return club(state, row.clubId);
    const player = findPlayer(state, row.playerId);
    return player?.clubId ? club(state, player.clubId) : null;
  };

  return (
    <Card
      title={competitionLabel(selected, pack, lang, t)}
      action={
        <select
          className="picker"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          aria-label={t('club.scorers')}
        >
          {leagues.map((competition) => (
            <option key={competition.id} value={competition.id}>
              {competitionName(competition, lang)}
            </option>
          ))}
        </select>
      }
    >
      <div className="seg" style={{ marginBlockEnd: 10 }}>
        <button aria-pressed={chart === 'goals'} onClick={() => setChart('goals')}>{t('chart.goals')}</button>
        <button aria-pressed={chart === 'assists'} onClick={() => setChart('assists')}>{t('chart.assists')}</button>
        <button aria-pressed={chart === 'cards'} onClick={() => setChart('cards')}>{t('chart.cards')}</button>
      </div>

      {estimated && rows.length > 0 && (
        <p className="faint" style={{ fontSize: 11, marginBlockEnd: 8 }}>{t('chart.estimated')}</p>
      )}

      {rows.length === 0 ? (
        <Empty>{t('chart.empty')}</Empty>
      ) : (
        <ul className="list">
          {rows.map((row, i) => (
            <li key={row.playerId} className={`list-item ${row.playerId === state.player.id ? 'me' : ''}`}>
              <span className="num faint" style={{ fontSize: 11, minWidth: 18 }}>{i + 1}</span>
              <Crest club={clubOf(row)} size="sm" />
              <span className="grow" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nameOf(row)}
              </span>
              {chart === 'cards' ? (
                <span className="row" style={{ gap: 5 }}>
                  <span className="card-pip card-yellow" />
                  <span className="num" style={{ fontSize: 13 }}>{row.value}</span>
                  {(row.second ?? 0) > 0 && (
                    <>
                      <span className="card-pip card-red" />
                      <span className="num" style={{ fontSize: 13 }}>{row.second}</span>
                    </>
                  )}
                </span>
              ) : (
                <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>{row.value}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
