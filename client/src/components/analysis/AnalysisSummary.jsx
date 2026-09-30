import React from 'react';

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
    <div className="card" data-testid="analysis-summary-card">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.5rem',
          alignItems: 'center',
        }}
      >
        {/* Prominent Overall Score Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.75rem 1rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
          }}
          data-testid="overall-score-display"
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              marginBottom: '0.5rem',
            }}
          >
            Overall Match Score
          </span>

          <div
            style={{
              fontSize: '3rem',
              fontWeight: 800,
              lineHeight: 1,
              color: 'var(--text-primary)',
            }}
          >
            {score.toFixed(1)}%
          </div>

          <span
            style={{
              marginTop: '0.5rem',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
            }}
          >
            Deterministic match score
          </span>
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
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}
            data-testid="required-coverage-stat"
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Required Skills Match
            </span>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--danger)', marginTop: '0.25rem' }}>
              {reqCoverage}%
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {summary.matched_required_count ?? 0} of {summary.required_skills_count ?? 0} skills detected
            </div>
          </div>

          {/* Preferred Skills Coverage */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}
            data-testid="preferred-coverage-stat"
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Preferred Skills Match
            </span>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--info)', marginTop: '0.25rem' }}>
              {prefCoverage}%
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {summary.matched_preferred_count ?? 0} of {summary.preferred_skills_count ?? 0} skills detected
            </div>
          </div>

          {/* Total Skills Evaluated */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Total Role Skills
            </span>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              {summary.total_job_skills ?? 0}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {(summary.matched_required_count ?? 0) + (summary.matched_preferred_count ?? 0)} matched,{' '}
              {(summary.missing_required_count ?? 0) + (summary.missing_preferred_count ?? 0)} missing
            </div>
          </div>

          {/* Average Match Confidence */}
          {summary.average_confidence !== undefined && (
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Avg Confidence
              </span>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {(Number(summary.average_confidence) * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
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
