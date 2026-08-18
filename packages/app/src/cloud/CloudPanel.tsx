import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useT } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { myClub } from '../state/selectors.js';
import { Panel } from '../components/ui.js';
import {
  cloudConfigured,
  currentSession,
  leaderboard,
  pullLatestSave,
  pushSave,
  signInWithEmail,
  signOut,
  type LeaderboardRow,
} from './supabase.js';

export function CloudPanel() {
  const t = useT();
  const state = useGame((s) => s.state);
  const showToast = useGame((s) => s.showToast);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cloudConfigured()) return;
    void currentSession().then(setSession);
  }, []);

  useEffect(() => {
    if (!session) return;
    void leaderboard().then(setRows);
  }, [session]);

  if (!cloudConfigured()) {
    return (
      <Panel title={t('settings.cloud')}>
        <p className="faint" style={{ fontSize: 12.5 }}>{t('settings.notConfigured')}</p>
      </Panel>
    );
  }

  const sync = async () => {
    if (!state) return;
    setBusy(true);
    const result = await pushSave(state, myClub(state)?.name ?? '');
    setBusy(false);
    showToast(result.error ? result.error : t('settings.sync'));
    void leaderboard().then(setRows);
  };

  const restore = async () => {
    setBusy(true);
    const result = await pullLatestSave();
    setBusy(false);
    if (result.error || !result.state) {
      showToast(result.error ?? null);
      return;
    }
    useGame.setState({ state: result.state });
    await useGame.getState().save();
    showToast(t('action.loadCareer'));
  };

  return (
    <Panel title={t('settings.cloud')}>
      {session ? (
        <div className="stack">
          <div className="row-between">
            <span style={{ fontSize: 13 }}>{session.user.email}</span>
            <button className="btn btn-ghost" onClick={() => void signOut().then(() => setSession(null))}>
              {t('settings.signOut')}
            </button>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost grow" disabled={busy} onClick={() => void sync()}>{t('settings.sync')}</button>
            <button className="btn btn-ghost grow" disabled={busy} onClick={() => void restore()}>{t('action.loadCareer')}</button>
          </div>

          {rows.length > 0 && (
            <>
              <p className="eyebrow" style={{ marginBlockStart: 6 }}>{t('settings.leaderboard')}</p>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('club.player')}</th>
                    <th>OVR</th>
                    <th>{t('career.score')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={`${row.player_name}-${i}`}>
                      <td className="n">{i + 1}</td>
                      <td style={{ fontSize: 12.5 }}>{row.player_name}</td>
                      <td className="n">{row.ovr}</td>
                      <td className="n" style={{ fontWeight: 700 }}>{row.career_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ) : (
        <div className="stack">
          <div className="field">
            <label htmlFor="email">{t('settings.signIn')}</label>
            <input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button
            className="btn btn-ghost btn-block"
            disabled={!email.includes('@') || busy}
            onClick={() => {
              setBusy(true);
              void signInWithEmail(email).then((result) => {
                setBusy(false);
                showToast(result.error ?? `→ ${email}`);
              });
            }}
          >
            {t('settings.signIn')}
          </button>
        </div>
      )}
    </Panel>
  );
}
