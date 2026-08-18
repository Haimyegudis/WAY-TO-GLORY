import { useState } from 'react';
import { useLang, useT } from '../i18n/index.js';
import { clubName, clubShortName } from '../lib/club.js';
import { competitionName, playerName } from '../lib/names.js';
import { useGame } from '../state/store.js';
import { club, myClub, myCompetitionState, squad, table, topScorers } from '../state/selectors.js';
import { Card, Crest, Empty, Meter } from '../components/ui.js';
import { clubColor } from '../lib/club.js';

type Tab = 'table' | 'squad' | 'scorers';

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
      </div>

      {tab === 'table' && <LeagueTable />}
      {tab === 'squad' && <SquadList />}
      {tab === 'scorers' && <Scorers />}
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
