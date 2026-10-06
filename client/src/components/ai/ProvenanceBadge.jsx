import React from 'react';
import Icon from '../common/Icon.jsx';

/**
 * Provenance Badge Component
 * Displays claim source provenance according to strict Stage 3.1 & Stage 4 semantics.
 *
 * @param {object} props
 * @param {'RESUME_EVIDENCE'|'DETERMINISTIC_ANALYSIS'|'JOB_REQUIREMENT'|string} props.sourceType
 * @param {string} [props.className='']
 */
export const ProvenanceBadge = ({ sourceType, className = '' }) => {
  switch (sourceType) {
    case 'RESUME_EVIDENCE':
      return (
        <span
          className={`badge ${className}`.trim()}
          style={{
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            border: '1px solid var(--success-border)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--radius-full)',
          }}
          title="Directly grounded in candidate resume text"
          data-testid="provenance-badge-resume"
        >
          <Icon name="file" size={12} />
          <span>Resume Evidence</span>
        </span>
      );

    case 'DETERMINISTIC_ANALYSIS':
      return (
        <span
          className={`badge ${className}`.trim()}
          style={{
            backgroundColor: 'var(--accent-muted)',
            color: 'var(--accent-primary)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--radius-full)',
          }}
          title="Derived from authoritative deterministic skill analysis"
          data-testid="provenance-badge-deterministic"
        >
          <Icon name="chart" size={12} />
          <span>Deterministic Analysis</span>
        </span>
      );

    case 'JOB_REQUIREMENT':
      return (
        <span
          className={`badge ${className}`.trim()}
          style={{
            backgroundColor: 'var(--info-bg)',
            color: 'var(--info)',
            border: '1px solid var(--info-border)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--radius-full)',
          }}
          title="Identified from employer job description — does not indicate that the candidate possesses this skill"
          data-testid="provenance-badge-job"
        >
          <Icon name="briefcase" size={12} />
          <span>Role Requirement — Employer Expectation</span>
        </span>
      );

    default:
      return (
        <span
          className={`badge ${className}`.trim()}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--radius-full)',
          }}
          data-testid="provenance-badge-default"
        >
          {sourceType || 'Source Unknown'}
        </span>
      );
  }
};

export default ProvenanceBadge;
