import React from 'react';
import Icon from '../common/Icon.jsx';

/**
 * Verification Badge Component
 * Displays factual verification status (VERIFIED / UNVERIFIED) with unverified reason tooltip.
 *
 * @param {object} props
 * @param {'VERIFIED'|'UNVERIFIED'|string} props.status
 * @param {string|null} [props.reason]
 * @param {string} [props.className='']
 */
export const VerificationBadge = ({ status, reason = null, className = '' }) => {
  const isVerified = status === 'VERIFIED';

  if (isVerified) {
    return (
      <span
        className={`badge ${className}`.trim()}
        style={{
          backgroundColor: 'var(--success-bg)',
          color: 'var(--success)',
          border: '1px solid var(--success-border)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          padding: '0.2rem 0.5rem',
          borderRadius: 'var(--radius-full)',
        }}
        title="Grounded in authoritative document evidence or deterministic analysis"
        data-testid="verification-badge-verified"
      >
        <Icon name="check" size={12} />
        <span>Verified</span>
      </span>
    );
  }

  return (
    <span
      className={`badge ${className}`.trim()}
      style={{
        backgroundColor: 'var(--warning-bg)',
        color: 'var(--warning)',
        border: '1px solid var(--warning-border)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        padding: '0.2rem 0.5rem',
        borderRadius: 'var(--radius-full)',
      }}
      title={reason ? `Unverified: ${reason}` : 'Unverified claim lacking supporting document evidence'}
      data-testid="verification-badge-unverified"
    >
      <Icon name="alert" size={12} />
      <span>Unverified</span>
    </span>
  );
};

export default VerificationBadge;
