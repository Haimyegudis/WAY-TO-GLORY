import { useLang, useT } from '../i18n/index.js';
import { countryName as localisedCountry } from '../lib/names.js';
import { getPack, useGame } from '../state/store.js';
import { Chip, Meter, Card, Stat } from '../components/ui.js';

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
