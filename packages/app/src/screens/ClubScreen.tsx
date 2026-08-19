import { useState } from 'react';
import { sortedTable, type CareerState, type EuroState } from '@fc/engine';
import { useLang, useT } from '../i18n/index.js';
import { clubName, clubShortName } from '../lib/club.js';
import { competitionLabel, competitionName, playerName } from '../lib/names.js';
import { getPack, useGame } from '../state/store.js';
import { club, myClub, myCompetitionState, squad, table, topScorers } from '../state/selectors.js';
import { Card, ClubLine, Crest, Empty, Meter } from '../components/ui.js';
import { clubColor } from '../lib/club.js';

type Tab = 'table' | 'squad' | 'scorers' | 'europe';

export function ClubScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const [tab, setTab] = useState<Tab>('table');
  const home = myClub(state);

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
          <p className="faint" style={{ fontSize: 12 }}>{home.city}</p>
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
        {europeanRun(state) && (
          <button aria-pressed={tab === 'europe'} onClick={() => setTab('europe')}>{t('competition.europe')}</button>
        )}
      </div>

      {tab === 'table' && <LeagueTable />}
      {tab === 'squad' && <SquadList />}
      {tab === 'scorers' && <Scorers />}
      {tab === 'europe' && <EuropeanRun />}
    </div>
  );
}


/** The European competition the user's club is in this season, if any. */
function europeanRun(state: CareerState): EuroState | null {
  const clubId = state.player.clubId;
  if (!clubId) return null;
  for (const competition of Object.values(state.world.europe ?? {}) as EuroState[]) {
    const inGroup = competition.groups.some((g) => g.clubIds.includes(clubId));
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
function EuropeanRun() {
  const t = useT();
  const state = useGame((s) => s.state)!;
  const competitions = Object.values(state.world.europe ?? {}) as EuroState[];
  const mine = europeanRun(state);
  const [selected, setSelected] = useState(mine?.id ?? competitions[0]?.id ?? '');

  if (competitions.length === 0) return <Empty>—</Empty>;
  const competition = competitions.find((c) => c.id === selected) ?? competitions[0]!;

  return (
    <>
      <div className="seg" style={{ marginBlockEnd: 10 }}>
        {competitions.map((entry) => (
          <button
            key={entry.id}
            aria-pressed={entry.id === competition.id}
            onClick={() => setSelected(entry.id)}
          >
            {t(`competition.${entry.id}`)}
            {mine?.id === entry.id && ' ★'}
          </button>
        ))}
      </div>
      <Card title={t(`competition.${competition.id}`)}>
        <EuroTables competition={competition} />
      </Card>
    </>
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
  const europe = Object.keys(state.world.europe ?? {});

  const euro = (state.world.europe ?? {})[selected] as EuroState | undefined;
  const compState = state.world.competitions[selected];
  const rows = compState ? sortedTable(compState) : [];

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
          <optgroup label={t('club.leagues')}>
            {leagues.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competitionName(competition, lang)}
              </option>
            ))}
          </optgroup>
          {europe.length > 0 && (
            <optgroup label={t('competition.europe')}>
              {europe.map((id) => (
                <option key={id} value={id}>{t(`competition.${id}`)}</option>
              ))}
            </optgroup>
          )}
        </select>
      }
    >
      {euro ? (
        <EuroTables competition={euro} />
      ) : rows.length === 0 ? (
        <Empty>—</Empty>
      ) : (
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
                <tr key={row.clubId} className={row.clubId === mine ? 'me' : ''}>
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
      )}
    </Card>
  );
}

/** Every group of a European competition, and the knockout ties once they are drawn. */
function EuroTables({ competition }: { competition: EuroState }) {
  const t = useT();
  const lang = useLang((x) => x.lang);
  const state = useGame((s) => s.state)!;
  const mine = state.player.clubId;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="eyebrow">
        {t(`competition.stage.${competition.stage === 'done' ? 'final' : competition.stage}`)}
        {competition.winner && (
          <span className="who"> · {clubShortName(club(state, competition.winner), lang)}</span>
        )}
      </p>

      {competition.groups.map((group) => (
        <div key={group.letter}>
          <p className="eyebrow" style={{ marginBlockEnd: 6 }}>{t('competition.group', { letter: group.letter })}</p>
          <div className="scroll-x">
            <table className="tbl">
              <tbody>
                {Object.values(group.table)
                  .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst))
                  .map((row, i) => (
                    <tr key={row.clubId} className={row.clubId === mine ? 'me' : ''}>
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
                      <td className="n">{row.goalsFor - row.goalsAgainst}</td>
                      <td className="n" style={{ fontWeight: 700 }}>{row.points}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <ul className="list" style={{ marginBlockStart: 4 }}>
            {competition.fixtures
              .filter((fixture) => group.clubIds.includes(fixture.homeClubId))
              .sort((a, b) => a.week - b.week)
              .map((fixture, i) => (
                <li key={`${group.letter}-${i}`} className="list-item score-row" style={{ padding: '4px 0' }}>
                  <span className="faint num" style={{ fontSize: 10.5, minWidth: 22 }}>{fixture.week}</span>
                  <span className="grow row" style={{ gap: 6, fontSize: 12, minWidth: 0 }}>
                    <Crest club={club(state, fixture.homeClubId)} size="sm" />
                    <span className="num">
                      {fixture.result ? `${fixture.result[0]}–${fixture.result[1]}` : '–'}
                    </span>
                    <Crest club={club(state, fixture.awayClubId)} size="sm" />
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}

      {competition.ties.length > 0 && (
        <div>
          <p className="eyebrow" style={{ marginBlockEnd: 6 }}>{t('competition.knockout')}</p>
          <ul className="list">
            {competition.ties.map((tie, i) => (
              <li key={`${tie.stage}-${i}`} className="list-item score-row">
                <span className="chip">{t(`competition.stage.${tie.stage}`)}</span>
                <span className="grow row" style={{ gap: 6, fontSize: 12.5, minWidth: 0 }}>
                  <Crest club={club(state, tie.homeClubId)} size="sm" />
                  <span className="num">{tie.result ? `${tie.result[0]}\u2013${tie.result[1]}` : '–'}</span>
                  <Crest club={club(state, tie.awayClubId)} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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
  const pack = getPack();
  const mine = state.player.clubId;
  const myCompetition = mine ? state.world.clubs[mine]?.competitionId ?? '' : '';

  const [selected, setSelected] = useState(myCompetition);
  const [chart, setChart] = useState<'goals' | 'assists' | 'cards'>('goals');

  const leagues = pack.competitions.filter((competition) => state.world.competitions[competition.id]);
  const compState = state.world.competitions[selected];

  type ChartRow = { playerId: string; value: number; second?: number };
  const rows: ChartRow[] = (() => {
    if (!compState) return [];
    if (chart === 'goals') {
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

  const nameOf = (playerId: string): string => {
    if (playerId === state.player.id) return `${state.player.firstName} ${state.player.lastName}`;
    const player = state.world.players[playerId];
    return player ? playerName(player, lang) : playerId;
  };

  const clubOf = (playerId: string) => {
    const player = playerId === state.player.id ? state.player : state.world.players[playerId];
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

      {rows.length === 0 ? (
        <Empty>{t('chart.empty')}</Empty>
      ) : (
        <ul className="list">
          {rows.map((row, i) => (
            <li key={row.playerId} className={`list-item ${row.playerId === state.player.id ? 'me' : ''}`}>
              <span className="num faint" style={{ fontSize: 11, minWidth: 18 }}>{i + 1}</span>
              <Crest club={clubOf(row.playerId)} size="sm" />
              <span className="grow" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nameOf(row.playerId)}
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
