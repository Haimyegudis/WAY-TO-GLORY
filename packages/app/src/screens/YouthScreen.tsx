import { useState } from 'react';
import { sortedTable, userYouthCompetition, userYouthCompetitionId, youthSquad } from '@fc/engine';
import { useLang, useT } from '../i18n/index.js';
import { clubName, clubShortName } from '../lib/club.js';
import { competitionLabel, playerName } from '../lib/names.js';
import { getPack, useGame } from '../state/store.js';
import { club } from '../state/selectors.js';
import { Card, Crest, Empty, RatingBadge } from '../components/ui.js';

type YouthTab = 'table' | 'scorers' | 'squad';

/**
 * The age group.
 *
 * A table with his club in it, a scoring chart with his name somewhere on it, and the
 * fifteen boys he trains with every day - who are the same fifteen he is trying to be
 * picked ahead of. This is the whole world of a sixteen year old, and it is the one
 * the first team is watching.
 */
export function YouthScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const pack = getPack();
  const [tab, setTab] = useState<YouthTab>('table');

  const youth = state.world.youth;
  const comp = userYouthCompetition(state);
  const divisionId = userYouthCompetitionId(state);

  if (!youth || !comp || !divisionId) {
    return <Empty>{t('youth.none')}</Empty>;
  }

  return (
    <Card title={competitionLabel(divisionId, pack, lang, t)}>
      <div className="seg" style={{ marginBlockEnd: 10 }}>
        <button aria-pressed={tab === 'table'} onClick={() => setTab('table')}>{t('youth.table')}</button>
        <button aria-pressed={tab === 'scorers'} onClick={() => setTab('scorers')}>{t('youth.scorers')}</button>
        <button aria-pressed={tab === 'squad'} onClick={() => setTab('squad')}>{t('youth.squad')}</button>
      </div>

      {tab === 'table' && <YouthTable />}
      {tab === 'scorers' && <YouthScorers />}
      {tab === 'squad' && <YouthSquad />}
    </Card>
  );
}

function YouthTable() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const comp = userYouthCompetition(state);
  const mine = state.player.clubId;
  const rows = comp ? sortedTable(comp) : [];

  if (rows.length === 0) return <Empty>—</Empty>;

  return (
    <div className="scroll-x">
      <table className="tbl">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('club.player')}</th>
            <th>{t('club.pld')}</th>
            <th>{t('club.gd')}</th>
            <th>{t('club.pts')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const side = club(state, row.clubId);
            return (
              <tr key={row.clubId} className={row.clubId === mine ? 'me' : ''}>
                <td className="n">{i + 1}</td>
                <td className="start">
                  <span className="row" style={{ gap: 6 }}>
                    <Crest club={side} size="sm" />
                    {clubShortName(side, lang) || row.clubId}
                  </span>
                </td>
                <td className="n">{row.played}</td>
                <td className="n" dir="ltr">{row.goalsFor - row.goalsAgainst}</td>
                <td className="n">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function YouthScorers() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const comp = userYouthCompetition(state);
  const youth = state.world.youth;
  if (!comp || !youth) return <Empty>{t('chart.empty')}</Empty>;

  const rows = Object.entries(comp.scorers)
    .map(([playerId, goals]) => ({ playerId, goals }))
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 20);

  if (rows.length === 0) return <Empty>{t('chart.empty')}</Empty>;

  return (
    <ul className="list">
      {rows.map((row, i) => {
        const boy = row.playerId === state.player.id ? state.player : youth.players[row.playerId];
        const side = boy?.clubId ? club(state, boy.clubId) : null;
        return (
          <li key={row.playerId} className={`list-item ${row.playerId === state.player.id ? 'me' : ''}`}>
            <span className="num" style={{ minWidth: 22 }}>{i + 1}</span>
            <span className="grow" style={{ fontSize: 13.5 }}>
              {boy ? playerName(boy, lang) : row.playerId}
              {side && <span className="faint" style={{ fontSize: 11.5 }}> · {clubShortName(side, lang)}</span>}
            </span>
            <span className="num">{row.goals}</span>
          </li>
        );
      })}
    </ul>
  );
}

function YouthSquad() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const youth = state.world.youth;
  const clubId = state.player.clubId;
  if (!youth || !clubId) return <Empty>—</Empty>;

  const home = club(state, clubId);
  const boys = youthSquad(state, clubId);
  const season = state.world.season;

  if (boys.length === 0) return <Empty>—</Empty>;

  const rows = [...boys].sort((a, b) => {
    const sa = youth.stats[a.id];
    const sb = youth.stats[b.id];
    return (sb?.goals ?? 0) - (sa?.goals ?? 0) || (sb?.apps ?? 0) - (sa?.apps ?? 0);
  });

  return (
    <>
      <p className="faint" style={{ fontSize: 11.5, marginBlockEnd: 8 }}>
        {t('youth.squadHint', { club: clubName(home, lang) })}
      </p>
      <ul className="list">
        {rows.map((boy) => {
          const stats = youth.stats[boy.id];
          return (
            <li key={boy.id} className="list-item">
              <span className="num" style={{ minWidth: 26 }}>{season - boy.birthYear}</span>
              <span className="grow" style={{ fontSize: 13.5 }}>
                {playerName(boy, lang)}
                <span className="faint" style={{ fontSize: 11.5 }}> · {t(`pos.${boy.primaryPos}`)}</span>
              </span>
              <span className="faint num" style={{ fontSize: 11.5, minWidth: 62, textAlign: 'end' }}>
                {stats ? `${stats.apps}/${stats.goals}/${stats.assists}` : '—'}
              </span>
              <RatingBadge rating={stats && stats.ratedApps > 0 ? stats.ratingSum / stats.ratedApps : 0} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
