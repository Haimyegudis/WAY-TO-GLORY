import { MATCH_PLANS, type MatchPlanId, type MatchPreparation, type OpponentReport } from '@fc/engine';
import { useT } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { Card } from '../components/ui.js';

/**
 * The week before the match, as the player sees it.
 *
 * A scouting report he can read and a job he has to choose, with the fit of each one
 * shown rather than hidden - the point is that he makes the judgement himself and finds
 * out on Saturday whether he was right. The plan is his own afternoon, not the team's
 * shape: he is one man in eleven and the game does not pretend otherwise.
 */
export function PrepareCard({ preparation }: { preparation: MatchPreparation }) {
  const t = useT();
  const setPlan = useGame((s) => s.setMatchPlan);
  const report = preparation.report;

  return (
    <Card title={t('prepare.title', { opponent: preparation.opponentName })}>
      <div className="stack" style={{ gap: 8 }}>
        <p style={{ fontSize: 13 }}>
          {t('prepare.shape', { formation: report.formation })} ·{' '}
          {t(report.gap >= 6 ? 'prepare.gap.stronger' : report.gap <= -6 ? 'prepare.gap.weaker' : 'prepare.gap.even')}
        </p>
        <p style={{ fontSize: 13 }}>{t(`prepare.threat.${report.threat}`)}</p>
        {report.weakness !== 'none' && (
          <p style={{ fontSize: 13, color: 'var(--amber)' }}>{t(`prepare.weakness.${report.weakness}`)}</p>
        )}
        {report.dangerMan && (
          <p className="faint" style={{ fontSize: 12.5 }}>
            {t('prepare.dangerMan', {
              name: report.dangerMan.name,
              pos: `position.${report.dangerMan.position}`,
              rating: report.dangerMan.rating,
            })}
          </p>
        )}
        {report.marker && (
          <p className="faint" style={{ fontSize: 12.5 }}>
            {t('prepare.marker', {
              name: report.marker.name,
              pos: `position.${report.marker.position}`,
              rating: report.marker.rating,
            })}
          </p>
        )}
      </div>

      <div className="stack" style={{ gap: 8, marginBlockStart: 12 }}>
        {preparation.options.map((option) => {
          const chosen = preparation.chosen === option.id;
          return (
            <button
              key={option.id}
              className="option"
              aria-pressed={chosen}
              style={chosen ? { borderColor: 'var(--amber)' } : undefined}
              onClick={() => setPlan(option.id as MatchPlanId)}
            >
              <span className="row-between" style={{ gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{t(`plan.${option.id}`)}</span>
                <span className={`risk ${fitClass(option.fit)}`}>{t(fitKey(option.fit))}</span>
              </span>
              <span className="faint" style={{ display: 'block', fontSize: 12.5, marginBlockStart: 4 }}>
                {t(`plan.${option.id}.detail`)}
              </span>
              {/*
                * Why this one, against these. The fit was a single word - "ideal",
                * "wrong" - with nothing tying it to the report above it, so the report
                * and the choice read like two unrelated cards.
                */}
              {reasons(option.id as MatchPlanId, report).map((reason) => (
                <span
                  key={reason.key}
                  className="faint"
                  style={{ display: 'block', fontSize: 11.5, marginBlockStart: 3, color: reason.good ? 'var(--green)' : 'var(--red)' }}
                >
                  {t(reason.key, { what: reason.what })}
                </span>
              ))}
            </button>
          );
        })}
      </div>

      <p className="faint" style={{ fontSize: 12, marginBlockStart: 10 }}>
        {preparation.chosen
          ? t('prepare.chosen', { plan: `plan.${preparation.chosen}` })
          : t('prepare.none', { plan: `plan.${preparation.recommended}` })}
      </p>
      <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 4 }}>
        {t('prepare.cost', { fatigue: Math.round((MATCH_PLANS[preparation.chosen ?? preparation.recommended].effect.fatigue - 1) * 100) })}
      </p>
    </Card>
  );
}

/** The line between the scouting report and this job: what it uses, and what it risks. */
function reasons(id: MatchPlanId, report: OpponentReport): { key: string; what: string; good: boolean }[] {
  const plan = MATCH_PLANS[id];
  const out: { key: string; what: string; good: boolean }[] = [];
  if (report.weakness !== 'none' && plan.punishes.includes(report.weakness)) {
    out.push({ key: 'prepare.because.punishes', what: `scout.weakness.${report.weakness}`, good: true });
  }
  if (plan.counters.includes(report.threat)) {
    out.push({ key: 'prepare.because.counters', what: `scout.threat.${report.threat}`, good: true });
  }
  if (plan.exposedTo.includes(report.threat)) {
    out.push({ key: 'prepare.because.exposed', what: `scout.threat.${report.threat}`, good: false });
  }
  return out;
}

function fitKey(fit: number): string {
  if (fit >= 0.5) return 'prepare.fit.ideal';
  if (fit > 0.1) return 'prepare.fit.good';
  if (fit >= -0.1) return 'prepare.fit.neutral';
  if (fit > -0.5) return 'prepare.fit.poor';
  return 'prepare.fit.wrong';
}

function fitClass(fit: number): string {
  if (fit > 0.1) return 'risk-low';
  if (fit >= -0.1) return 'risk-medium';
  return 'risk-high';
}
