import { useState } from 'react';
import type { CareerState, EuroState } from '@fc/engine';
import { useLang, useT } from '../i18n/index.js';
import { clubName, clubShortName } from '../lib/club.js';
import { competitionName, playerName } from '../lib/names.js';
import { useGame } from '../state/store.js';
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
function EuropeanRun() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const competition = europeanRun(state);
  if (!competition) return <Empty>—</Empty>;

  const clubId = state.player.clubId;
  const group = competition.groups.find((g) => g.clubIds.includes(clubId ?? ''));
  const ties = competition.ties.filter((tie) => tie.homeClubId === clubId || tie.awayClubId === clubId);

  return (
    <Card title={t(`competition.${competition.id}`)}>
      <p className="eyebrow" style={{ marginBlockEnd: 8 }}>
        {t(`competition.stage.${competition.stage === 'done' ? 'final' : competition.stage}`)}
      </p>

      {group && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th className="start">{t('competition.group', { letter: group.letter })}</th>
                <th className="n">{t('club.pld')}</th>
                <th className="n">{t('club.gd')}</th>
                <th className="n">{t('club.pts')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(group.table)
                .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst))
                .map((row) => (
                  <tr key={row.clubId} className={row.clubId === clubId ? 'row-me' : ''}>
                    <td className="start">
                      <ClubLine club={state.world.clubs[row.clubId]} size="sm" />
                    </td>
                    <td className="n">{row.played}</td>
                    <td className="n">{row.goalsFor - row.goalsAgainst}</td>
                    <td className="n">{row.points}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {ties.length > 0 && (
        <ul className="list" style={{ marginBlockStart: 10 }}>
          {ties.map((tie, i) => {
            const opponentId = tie.homeClubId === clubId ? tie.awayClubId : tie.homeClubId;
            return (
              <li key={`${tie.stage}-${i}`} className="list-item">
                <span className="chip">{t(`competition.stage.${tie.stage}`)}</span>
                <span className="grow" style={{ fontSize: 13 }}>
                  <ClubLine club={state.world.clubs[opponentId]} size="sm" />
                </span>
                <span className="num" style={{ fontSize: 13 }}>
                  {tie.result ? `${tie.result[0]}\u2013${tie.result[1]}` : `${tie.week}\u2032`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 8 }}>{lang === 'he' ? '' : ''}</p>
    </Card>
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

function LeagueTable() {
  const t = useT();
  const lang = useLang((x) => x.lang);
  const state = useGame((s) => s.state)!;
  const rows = table(state);
  const comp = myCompetitionState(state);
  const mine = state.player.clubId;

  if (rows.length === 0) return <Empty>—</Empty>;

  return (
    <Card title={comp?.competitionId}>
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
    </Card>
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

function Scorers() {
  const t = useT();
  const lang = useLang((x) => x.lang);
  const state = useGame((s) => s.state)!;
  const rows = topScorers(state);

  if (rows.length === 0) return <Empty>—</Empty>;

  return (
    <Card title={t('club.scorers')}>
      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('club.player')}</th>
              <th>{t('career.club')}</th>
              <th>{t('club.goals')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.playerId} className={row.isUser ? 'me' : ''}>
                <td className="n">{i + 1}</td>
                <td className="start">{playerName(row.player, lang)}</td>
                <td className="faint" style={{ fontSize: 12 }}>
                  <span className="row" style={{ gap: 6 }}>
                    <Crest club={club(state, row.clubId)} size="sm" />
                    <span>{clubShortName(club(state, row.clubId), lang)}</span>
                  </span>
                </td>
                <td className="n" style={{ fontWeight: 700 }}>{row.goals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
