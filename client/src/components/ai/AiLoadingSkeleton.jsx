import React from 'react';
import Spinner from '../common/Spinner.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Component-Level AI Loading Skeleton
 * Renders non-blocking loading feedback with contextual status text.
 * Never fabricates fake progress percentages.
 *
 * @param {object} props
 * @param {string} [props.message='Analyzing document with Gemini AI...']
 * @param {string} [props.subtext='Redacting PII and verifying evidence against authoritative sources.']
 * @param {string} [props.className='']
 */
export const AiLoadingSkeleton = ({
  message = 'Analyzing document with Gemini AI...',
  subtext = 'Redacting PII and verifying evidence against authoritative sources.',
  className = '',
}) => {
  return (
    <div
      className={`card ${className}`.trim()}
      style={{
        border: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-card)',
        padding: '2rem 1.5rem',
        textAlign: 'center',
      }}
      data-testid="ai-loading-skeleton"
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spinner size="lg" />
          <div
            style={{
              position: 'absolute',
              color: 'var(--accent-primary)',
            }}
            aria-hidden="true"
          >
            <Icon name="sparkles" size={16} />
          </div>
        </div>

        <div>
          <h4
            style={{
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 0.25rem 0',
            }}
            data-testid="ai-loading-message"
          >
            {message}
          </h4>
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              margin: 0,
            }}
            data-testid="ai-loading-subtext"
          >
            {subtext}
          </p>
        </div>

        {/* Shimmer Placeholder Lines */}
        <div
          style={{
            width: '100%',
            maxWidth: '480px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
            marginTop: '0.5rem',
          }}
          aria-hidden="true"
        >
          <div
            style={{
              height: '10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-elevated)',
              opacity: 0.6,
            }}
          />
          <div
            style={{
              height: '10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-elevated)',
              width: '80%',
              margin: '0 auto',
              opacity: 0.4,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AiLoadingSkeleton;
