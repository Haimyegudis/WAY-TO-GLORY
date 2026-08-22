import { useState } from 'react';
import { seasonGoalStanding, userYouthCompetitionId } from '@fc/engine';
import { useLang, useT } from '../i18n/index.js';
import { cityName, clubName } from '../lib/club.js';
import { playerName } from '../lib/names.js';
import { useGame } from '../state/store.js';
import { myClub, squad } from '../state/selectors.js';
import { Card, Crest, Empty, Meter } from '../components/ui.js';
import { YouthScreen } from './YouthScreen.js';
import { SelectionCard } from './SelectionCard.js';
import { clubColor } from '../lib/club.js';

type Tab = 'squad' | 'youth';

export function ClubScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  // What the club asked of him in the summer. It belongs with the club, not in the middle
  // of his week - he agreed it once and checks it now and then.
  const goal = state.seasonGoal?.season === state.world.season ? state.seasonGoal : null;
  const standing = seasonGoalStanding(state);
  // A sixteen year old's league is the youth league. Opening his club on the first
  // team's table would be showing him a competition he does not play in.
  const inTheAgeGroup = Boolean(state.world.youth && userYouthCompetitionId(state));
  const [tab, setTab] = useState<Tab>(inTheAgeGroup ? 'youth' : 'squad');
  const goto = useGame((s) => s.goto);
  const home = myClub(state);
  // Whether his football happens in Europe at all.

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

      {/*
        * What the season is for.
        *
        * The summer conversation is only worth having if he can see it all year, so the
        * three terms it was written in sit with the club he agreed them with, and each
        * one shows where he stands against it.
        */}
      {goal && standing && (
        <Card title={t('seasonGoal.title')}>
          <div className="stack" style={{ gap: 10 }}>
            <div>
              <div className="row-between" style={{ marginBlockEnd: 4 }}>
                <span style={{ fontSize: 13 }}>{t('seasonGoal.minutes')}</span>
                <span className="num" style={{ fontSize: 12 }}>
                  {Math.round(standing.minutesPct * 100)}% / {Math.round(goal.minutes * 100)}%
                </span>
              </div>
              <Meter value={Math.min(100, (standing.minutesPct / Math.max(0.01, goal.minutes)) * 100)} tone={standing.metMinutes ? 'amber' : 'blue'} />
            </div>
            {goal.contributions > 0 && (
              <div>
                <div className="row-between" style={{ marginBlockEnd: 4 }}>
                  <span style={{ fontSize: 13 }}>{t('seasonGoal.contributions')}</span>
                  <span className="num" style={{ fontSize: 12 }}>{standing.contributions} / {goal.contributions}</span>
                </div>
                <Meter value={Math.min(100, (standing.contributions / Math.max(1, goal.contributions)) * 100)} tone={standing.metContributions ? 'amber' : 'blue'} />
              </div>
            )}
            {goal.tablePosition !== null && standing.position !== null && (
              <div className="row-between">
                <span style={{ fontSize: 13 }}>{t('seasonGoal.position')}</span>
                <span className="num" style={{ fontSize: 12 }}>
                  {standing.position} / {goal.tablePosition}
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Where he stands here: whether he is playing, who is ahead of him, who picks. */}
      <SelectionCard />

      {/*
        * Only what he has with this club.
        *
        * Tables, scoring charts and European nights live under their own tab now: they
        * are the competitions he follows, not business he has with his employer, and
        * they had made the club screen mostly other people's leagues.
        */}
      <div className="seg">
        <button aria-pressed={tab === 'squad'} onClick={() => setTab('squad')}>{t('club.squad')}</button>
        {/* The age group has its own table, its own chart and its own boys. */}
        {state.world.youth && (
          <button aria-pressed={tab === 'youth'} onClick={() => setTab('youth')}>{t('youth.tab')}</button>
        )}
      </div>

      {tab === 'squad' && <SquadList />}
      {tab === 'youth' && <YouthScreen />}

      <button className="btn btn-quiet btn-block" onClick={() => goto('competitions')}>
        {t('nav.competitions.title')} →
      </button>
    </div>
  );
}


/** The European competition the user's club is in this season, if any. */
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
