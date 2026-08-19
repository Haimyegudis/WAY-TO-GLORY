import { useLang, useT } from '../i18n/index.js';
import { countryName as localisedCountry } from '../lib/names.js';
import { getPack, useGame } from '../state/store.js';
import { Chip, Meter, Card, Stat } from '../components/ui.js';
import { qualifyingTable } from '@fc/engine';

export function NationalScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const goto = useGame((s) => s.goto);
  const pack = getPack();
  const nt = state.nationalTeam;

  const countryName = (code: string) => localisedCountry(pack.countries.find((c) => c.code === code), lang) || code;

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
