import { shirtRival } from '@fc/engine';
import { useLang, useT } from '../i18n/index.js';
import { personName } from '../lib/names.js';
import { useGame } from '../state/store.js';
import { weeksInjured } from '../state/selectors.js';
import { Card } from '../components/ui.js';

/**
 * Whether he is playing on Saturday, and who is in the way.
 *
 * This used to be four sentences in the middle of the front page, between his fitness
 * and his post. It is not news and it is not this week - it is where he stands at the
 * club, which is what the club screen is for, and it belongs next to the table he is
 * trying to climb and the squad he is trying to get into.
 */
export function SelectionCard() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const goto = useGame((s) => s.goto);

  const player = state.player;
  const injuredWeeks = weeksInjured(state);
  const rival = shirtRival(state);
  const youthForm = state.world.youth?.form;
  const youthAverage = youthForm && youthForm.apps > 0 ? youthForm.ratingSum / youthForm.apps : 0;
  const nationalInterest = Math.round(Math.max(0, ...Object.values(state.nationalTeam.interest)));

  const formBand = player.form >= 72 ? 'excellent' : player.form >= 56 ? 'good' : player.form >= 42 ? 'unstable' : 'poor';
  const selectionOutlook = injuredWeeks > 0
    ? 'injured'
    : state.flags['formBenchNotified']
      ? 'benchForm'
      : state.flags['calledUpToSeniors']
        ? 'seniorTraining'
        : player.squadRole === 'academy'
          ? 'academy'
          : ['starter', 'important', 'key', 'star'].includes(player.squadRole)
            ? 'starting'
            : 'competing';

  return (
    <Card title={t('status.title')}>
      <div className="stack" style={{ gap: 7 }}>
        <p style={{ fontSize: 13 }}>{t(`status.form.${formBand}`)}</p>
        <p style={{ fontSize: 13 }}>{t(`status.selection.${selectionOutlook}`)}</p>
        {player.squadRole !== 'academy' && (
          <p style={{ fontSize: 13 }} className={rival?.ahead ? 'faint' : undefined}>
            {rival
              ? t(rival.ahead ? 'club.shirtRival.ahead' : 'club.shirtRival.behind', { name: rival.name })
              : t('club.shirtRival.none')}
          </p>
        )}
        {state.manager && (
          <p style={{ fontSize: 13 }} className="faint">
            {t('club.manager')}: {personName(state.manager.name, lang)} · {t(`manager.style.${state.manager.style}`)}
          </p>
        )}
        {player.squadRole === 'academy' && youthForm && (
          <p style={{ fontSize: 13 }}>
            {t('status.youthPath', {
              apps: youthForm.apps,
              rating: youthAverage > 0 ? youthAverage.toFixed(2) : '—',
              interest: nationalInterest,
            })}
          </p>
        )}
      </div>
      <button
        className="btn btn-block"
        style={{ marginBlockStart: 12 }}
        onClick={() => goto(player.form < 56 ? 'social' : 'train')}
      >
        {t(player.form < 56 ? 'status.openActions' : 'status.openTraining')}
      </button>
    </Card>
  );
}
