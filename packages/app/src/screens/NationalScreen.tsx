import { useLang, useT } from '../i18n/index.js';
import { countryName as localisedCountry } from '../lib/names.js';
import { getPack, useGame } from '../state/store.js';
import { Chip, Meter, Card, Stat } from '../components/ui.js';
import {
  currentOvr,
  levelForAge,
  minutesPct,
  nationalStandard,
  qualifyingTable,
  youthMinutesPct,
} from '@fc/engine';

/** The interest a selector needs before he picks up the phone. Mirrors rollCallUp. */
const CALL_UP_INTEREST = 55;

export function NationalScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const goto = useGame((s) => s.goto);
  const pack = getPack();
  const nt = state.nationalTeam;

  const countryName = (code: string) => localisedCountry(pack.countries.find((c) => c.code === code), lang) || code;

  const road = (() => {
    const age = state.world.season - state.player.birthYear;
    const level = levelForAge(age);
    if (!level) return null;
    // The association that likes him most is the one he is playing for the attention of.
    const code = [...nt.eligibleCountries].sort((a, b) => (nt.interest[b] ?? 0) - (nt.interest[a] ?? 0))[0];
    if (!code) return null;
    const country = pack.countries.find((c) => c.code === code);
    if (!country) return null;

    const bar = Math.round(nationalStandard(country.reputation, level));
    const ovr = currentOvr(state);
    const interest = Math.round(nt.interest[code] ?? 0);
    const senior = minutesPct(state);
    const youth = youthMinutesPct(state);

    // One line of advice, and it is the true one: the biggest thing standing in his way.
    const advice =
      ovr < bar - 4 ? 'national.road.advice.rating'
      : level === 'u17' || level === 'u19'
        ? (youth < 0.4 && senior < 0.2 ? 'national.road.advice.youthMinutes' : 'national.road.advice.keepGoing')
        : senior < 0.35 ? 'national.road.advice.minutes'
        : 'national.road.advice.keepGoing';

    return { level, code, bar, ovr, interest, advice };
  })();

  return (
    <div className="screen stack">
      <header className="row-between">
        <div>
          <p className="eyebrow">{t('national.title')}</p>
          <h1 className="title">
            {nt.countryCode ? countryName(nt.countryCode) : t('national.uncommitted')}
          </h1>
        </div>
        <button className="eyebrow" onClick={() => goto('career')}>← {t('career.title')}</button>
      </header>

      <Card>
        <div className="statrow">
          <Stat label={t('national.caps')} value={nt.caps} />
          <Stat label={t('national.goals')} value={nt.goals} />
          <Stat label={t('national.level')} value={<span style={{ fontSize: 13 }}>{t(`national.level.${nt.level}`)}</span>} />
          <Stat label={t('career.season')} value={nt.callUpHistory.length} />
        </div>
      </Card>

      {/*
        * The road to a call-up.
        *
        * The interest meters below say how close he is without ever saying to what, or
        * what would move them, so a fifteen year old reads "not tied to any association"
        * and closes the screen. This is the same arithmetic the selector uses, printed:
        * the level his age belongs to, the standard for it, where he stands against it,
        * and the one thing most worth doing about it.
        */}
      {road && (
        <Card title={t('national.road')}>
          <p style={{ fontSize: 14, marginBlockEnd: 10 }}>
            {t('national.road.level', { level: t(`national.level.${road.level}`), country: countryName(road.code) })}
          </p>
          <div className="row-between" style={{ marginBlockEnd: 4 }}>
            <span className="faint" style={{ fontSize: 12 }}>{t('national.road.rating')}</span>
            <span className="num" style={{ fontSize: 12 }}>{road.ovr} / {road.bar}</span>
          </div>
          <Meter value={Math.min(100, (road.ovr / road.bar) * 100)} tone={road.ovr >= road.bar ? 'amber' : 'blue'} />
          <div className="row-between" style={{ marginBlock: '10px 4px' }}>
            <span className="faint" style={{ fontSize: 12 }}>{t('national.road.interest')}</span>
            <span className="num" style={{ fontSize: 12 }}>{road.interest} / {CALL_UP_INTEREST}</span>
          </div>
          <Meter value={(road.interest / CALL_UP_INTEREST) * 100} tone={road.interest >= CALL_UP_INTEREST ? 'amber' : 'blue'} />
          <p className="faint" style={{ fontSize: 12, marginBlockStart: 10 }}>{t(road.advice)}</p>
        </Card>
      )}

      <Card title={t('national.eligible')}>
        <div className="stack" style={{ gap: 10 }}>
          {nt.eligibleCountries.map((code) => (
            <div key={code}>
              <div className="row-between" style={{ marginBlockEnd: 4 }}>
                <span style={{ fontSize: 14 }}>
                  {countryName(code)}
                  {nt.countryCode === code && <Chip tone="amber"> ✓ </Chip>}
                </span>
                <span className="num" style={{ fontSize: 12 }}>{Math.round(nt.interest[code] ?? 0)}</span>
              </div>
              <Meter value={nt.interest[code] ?? 0} tone={(nt.interest[code] ?? 0) > 55 ? 'amber' : 'blue'} />
            </div>
          ))}
        </div>
        <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 12 }}>{t('national.note')}</p>
      </Card>

      {state.campaign && (
        <Card title={t('national.campaign')}>
          <table className="tbl">
            <thead>
              <tr>
                <th className="start">{t(`tournament.${state.campaign.tournament}`)}</th>
                <th className="n">{t('club.pld')}</th>
                <th className="n">{t('club.gd')}</th>
                <th className="n">{t('club.pts')}</th>
              </tr>
            </thead>
            <tbody>
              {qualifyingTable(state.campaign).map((row) => (
                <tr key={row.countryCode} className={row.countryCode === state.campaign!.countryCode ? 'me' : ''}>
                  <td className="start">{countryName(row.countryCode)}</td>
                  <td className="n">{row.played}</td>
                  <td className="n">{row.goalsFor - row.goalsAgainst}</td>
                  <td className="n" style={{ fontWeight: 700 }}>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {state.campaign.playoff && (
            <p className="faint" style={{ fontSize: 12, marginBlockStart: 8 }}>
              {t('national.playoffVs', { opponent: countryName(state.campaign.playoff.opponent) })}
              {state.campaign.playoff.played
                ? ` · ${state.campaign.playoff.result?.[0]}-${state.campaign.playoff.result?.[1]}`
                : ''}
            </p>
          )}
          {state.campaign.outcome && (
            <p style={{ fontSize: 13, marginBlockStart: 8 }}>
              <Chip tone={state.campaign.outcome === 'out' ? 'red' : 'solid-green'}>
                {t(`national.campaign.${state.campaign.outcome}`)}
              </Chip>
            </p>
          )}

          <ul className="list" style={{ marginBlockStart: 10 }}>
            {state.campaign.fixtures
              .filter((fixture) =>
                fixture.homeCountry === state.campaign!.countryCode ||
                fixture.awayCountry === state.campaign!.countryCode,
              )
              .map((fixture, i) => (
                <li key={i} className="list-item fixture-row">
                  <span className="faint num" style={{ fontSize: 11 }}>{fixture.week}</span>
                  <span className="score-row" style={{ fontSize: 13 }}>
                    <span style={{ textAlign: 'end', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {countryName(fixture.homeCountry)}
                    </span>
                    <span className="num">{fixture.played ? `${fixture.result?.[0]}–${fixture.result?.[1]}` : '–'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {countryName(fixture.awayCountry)}
                    </span>
                  </span>
                  <span className="fixture-rating">
                    {fixture.userPlayed ? (
                      <span className="num" style={{ fontSize: 12 }}>{fixture.userRating?.toFixed(1)}</span>
                    ) : (
                      <span className="faint" style={{ fontSize: 11 }}>—</span>
                    )}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}

      {(state.tournaments ?? []).length > 0 && (
        <Card title={t('career.tournaments')}>
          <ul className="list">
            {(state.tournaments ?? []).slice().reverse().map((tournament, i) => (
              <li key={`${tournament.season}-${i}`} className="list-item" style={{ alignItems: 'flex-start' }}>
                <span className="grow">
                  <span style={{ fontSize: 13.5 }}>{t(`tournament.${tournament.id}`)}</span>
                  <span className="faint num" style={{ fontSize: 11.5 }}> {tournament.season + 1}</span>
                  <p className="faint" style={{ fontSize: 11.5 }}>
                    {t('national.tournamentLine', {
                      caps: tournament.caps,
                      goals: tournament.goals,
                      rating: tournament.averageRating > 0 ? tournament.averageRating.toFixed(1) : '—',
                    })}
                  </p>
                </span>
                <span className="chip chip-amber">{t(`tournament.finish.${tournament.finish}`)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {nt.callUpHistory.length > 0 && (
        <Card title={t('career.history')}>
          <ul className="list">
            {[...nt.callUpHistory].reverse().slice(0, 12).map((entry, i) => (
              <li key={`${entry.season}-${i}`} className="list-item">
                <span className="num faint" style={{ fontSize: 11, minWidth: 40 }}>{entry.season}</span>
                <span className="grow" style={{ fontSize: 13 }}>{countryName(entry.countryCode)}</span>
                <span className="chip">{t(`national.level.${entry.level}`)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
