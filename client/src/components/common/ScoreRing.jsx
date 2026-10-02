import React from 'react';

/**
 * ScoreRing Component
 * Circular SVG score meter displaying exact backend numeric overall_score.
 *
 * CRITICAL SCORE RULE:
 * This component is purely visual. It MUST NOT categorize, classify, or interpret
 * the score into labels (such as "Strong", "Moderate", "Low", "Poor", "Excellent").
 *
 * @param {object} props
 * @param {number|string} props.score - Numeric score (0 - 100)
 * @param {number} [props.size=130] - Diameter in pixels
 * @param {number} [props.strokeWidth=10] - Stroke thickness
 * @param {string} [props.label='Overall Match Score'] - Primary descriptive label
 * @param {string} [props.sublabel='Deterministic match score'] - Subordinate text
 * @param {string} [props.className='']
 */
export const ScoreRing = ({
  score = 0,
  size = 130,
  strokeWidth = 10,
  label = 'Overall Match Score',
  sublabel = 'Deterministic match score',
  className = '',
}) => {
  const numericScore = Math.max(0, Math.min(100, Number(score) || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (numericScore / 100) * circumference;

  return (
    <div
      className={`score-ring-container ${className}`.trim()}
      role="meter"
      aria-label={label}
      aria-valuenow={numericScore}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="scoreRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-primary)" />
              <stop offset="100%" stopColor="var(--accent-secondary)" />
            </linearGradient>
          </defs>

          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--bg-elevated)"
            strokeWidth={strokeWidth}
          />

          {/* Dynamic Value Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#scoreRingGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </svg>

        {/* Center Score Display */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: size >= 130 ? '1.75rem' : '1.35rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {numericScore.toFixed(1)}%
          </span>
        </div>
      </div>

      {label && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            marginTop: '0.75rem',
          }}
        >
          {label}
        </span>
      )}

      {sublabel && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            marginTop: '0.25rem',
          }}
        >
          {sublabel}
        </span>
      )}
    </div>
  );
};

export default ScoreRing;
