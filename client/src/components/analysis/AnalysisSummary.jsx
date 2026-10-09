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

  const targetThreshold = 80.0;
  const delta = score - targetThreshold;

  const matchedRequired = summary.matched_required_count ?? 0;
  const totalRequired = summary.required_skills_count ?? 0;
  const matchedPreferred = summary.matched_preferred_count ?? 0;
  const totalPreferred = summary.preferred_skills_count ?? 0;

  const totalDetected = matchedRequired + matchedPreferred;
  const totalSkills = summary.total_job_skills ?? (totalRequired + totalPreferred);

  // Circular SVG meter values
  const radius = 37;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div
      data-testid="analysis-summary-card"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1rem',
      }}
    >
      {/* Card 1: Authoritative Match Score */}
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          borderRadius: 'var(--radius-xl, 1.25rem)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--text-muted, #94a3b8)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              PRIMARY METRIC
            </div>
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0.2rem 0 0',
                letterSpacing: '-0.01em',
              }}
            >
              Authoritative Match Score
            </h2>
          </div>

          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
            }}
            title="Deterministic Calculation"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
              tune
            </span>
          </div>
        </div>

        {/* Center Score Display with Circular Meter */}
        <div
          data-testid="overall-score-display"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
          }}
        >
          {/* Circular SVG Meter */}
          <div style={{ position: 'relative', width: '92px', height: '92px', flexShrink: 0 }}>
            <svg
              width="92"
              height="92"
              viewBox="0 0 92 92"
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="scoreMeterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
              {/* Background Track */}
              <circle
                cx="46"
                cy="46"
                r={radius}
                fill="none"
                stroke="var(--bg-container-low, rgba(255, 255, 255, 0.08))"
                strokeWidth="8"
              />
              {/* Value Ring */}
              <circle
                cx="46"
                cy="46"
                r={radius}
                fill="none"
                stroke="url(#scoreMeterGradient)"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </svg>

            {/* Centered Chart Icon */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(99, 102, 241, 0.16)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '0.95rem', color: '#818cf8' }}
                >
                  insert_chart_outlined
                </span>
              </div>
            </div>
          </div>

          {/* Text Stack */}
          <div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '2.2rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {score.toFixed(1)}%
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: '0.3rem',
              }}
            >
              Overall Match Score
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '0.1rem',
              }}
            >
              Deterministic calculation
            </div>
          </div>
        </div>

        {/* Footer Threshold Delta */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
            paddingTop: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.78rem',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>Target role threshold: {targetThreshold.toFixed(1)}%</span>
          <span
            style={{
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              color: delta >= 0 ? '#10b981' : '#f87171',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
              {delta >= 0 ? 'trending_up' : 'trending_down'}
            </span>
            <span>{delta >= 0 ? `+${delta.toFixed(1)}% vs. baseline` : `${delta.toFixed(1)}% vs. baseline`}</span>
          </span>
        </div>
      </div>

      {/* Card 2: Skill Match Precision */}
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          borderRadius: 'var(--radius-xl, 1.25rem)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--text-muted, #94a3b8)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              SKILL PRECISION
            </div>
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0.2rem 0 0',
                letterSpacing: '-0.01em',
              }}
            >
              Skill Match Precision
            </h2>
          </div>

          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
            title="Skill Precision"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
              code
            </span>
          </div>
        </div>

        {/* Progress Bars Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Required Skills Coverage */}
          <div data-testid="required-coverage-stat">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.35rem',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    display: 'inline-block',
                  }}
                  aria-hidden="true"
                />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Required Skills</span>
              </div>
              <span
                className="tabular-nums"
                style={{ fontWeight: 700, color: '#10b981' }}
              >
                {reqCoverage}% ({matchedRequired} / {totalRequired})
              </span>
            </div>

            {/* Progress Track */}
            <div
              style={{
                height: '6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-container-low, rgb(19, 19, 22))',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(0, Number(reqCoverage)))}%`,
                  backgroundColor: '#10b981',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>

          {/* Preferred Bonus Coverage */}
          <div data-testid="preferred-coverage-stat">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.35rem',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b',
                    display: 'inline-block',
                  }}
                  aria-hidden="true"
                />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Preferred Bonus</span>
              </div>
              <span
                className="tabular-nums"
                style={{ fontWeight: 700, color: '#f59e0b' }}
              >
                {prefCoverage}% ({matchedPreferred} / {totalPreferred})
              </span>
            </div>

            {/* Progress Track */}
            <div
              style={{
                height: '6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-container-low, rgb(19, 19, 22))',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(0, Number(prefCoverage)))}%`,
                  backgroundColor: '#f59e0b',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer Confidence Precision */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
            paddingTop: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.78rem',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>Avg Confidence Precision</span>
          <span
            className="tabular-nums"
            style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}
          >
            {(Number(summary.average_confidence !== undefined ? summary.average_confidence : 0.92) * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default AnalysisSummary;
