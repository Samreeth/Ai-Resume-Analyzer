import React from 'react';
import ScoreRing from '../common/ScoreRing.jsx';
import ProgressBar from '../common/ProgressBar.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Visual summary of analysis scores and category coverages
 * Displays backend-provided overall_score and breakdown metrics without client-side score classification.
 *
 * @param {object} props
 * @param {object} props.analysis
 */
export const AnalysisSummary = ({ analysis }) => {
  if (!analysis) return null;

  const score = Number(analysis.overall_score) || 0;
  const summary = analysis.summary || {};

  const reqCoverage =
    summary.required_coverage !== undefined
      ? (Number(summary.required_coverage) * 100).toFixed(1)
      : '0.0';

  const prefCoverage =
    summary.preferred_coverage !== undefined
      ? (Number(summary.preferred_coverage) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="card" data-testid="analysis-summary-card" style={{ padding: '1.75rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '2rem',
          alignItems: 'center',
        }}
      >
        {/* Prominent Overall Score Card with ScoreRing */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            textAlign: 'center',
            boxShadow: 'var(--shadow-sm)',
          }}
          data-testid="overall-score-display"
        >
          <ScoreRing
            score={score}
            size={144}
            strokeWidth={11}
            label="Overall Match Score"
            sublabel="Deterministic match score"
          />
        </div>

        {/* Breakdown Metric Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            flex: 1,
          }}
        >
          {/* Required Skills Coverage */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
            data-testid="required-coverage-stat"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Required Skills Match
              </span>
              <Icon name="check" size={14} style={{ color: 'var(--danger)' }} />
            </div>

            <div
              className="tabular-nums"
              style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--danger)' }}
            >
              {reqCoverage}%
            </div>

            <ProgressBar
              value={Number(reqCoverage)}
              variant="required"
              height="6px"
              showValue={false}
            />

            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem' }} className="tabular-nums">
              {summary.matched_required_count ?? 0} of {summary.required_skills_count ?? 0} skills detected
            </div>
          </div>

          {/* Preferred Skills Coverage */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
            data-testid="preferred-coverage-stat"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Preferred Skills Match
              </span>
              <Icon name="sparkles" size={14} style={{ color: 'var(--info)' }} />
            </div>

            <div
              className="tabular-nums"
              style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--info)' }}
            >
              {prefCoverage}%
            </div>

            <ProgressBar
              value={Number(prefCoverage)}
              variant="preferred"
              height="6px"
              showValue={false}
            />

            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem' }} className="tabular-nums">
              {summary.matched_preferred_count ?? 0} of {summary.preferred_skills_count ?? 0} skills detected
            </div>
          </div>

          {/* Total Skills Evaluated */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Total Role Skills
              </span>
              <Icon name="briefcase" size={14} style={{ color: 'var(--accent-primary)' }} />
            </div>

            <div
              className="tabular-nums"
              style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}
            >
              {summary.total_job_skills ?? 0}
            </div>

            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'auto' }} className="tabular-nums">
              {(summary.matched_required_count ?? 0) + (summary.matched_preferred_count ?? 0)} matched,{' '}
              {(summary.missing_required_count ?? 0) + (summary.missing_preferred_count ?? 0)} missing
            </div>
          </div>

          {/* Average Match Confidence */}
          {summary.average_confidence !== undefined && (
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Avg Confidence
                </span>
                <Icon name="chart" size={14} style={{ color: 'var(--border-focus)' }} />
              </div>

              <div
                className="tabular-nums"
                style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}
              >
                {(Number(summary.average_confidence) * 100).toFixed(0)}%
              </div>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'auto' }}>
                Deterministic pattern precision
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisSummary;
