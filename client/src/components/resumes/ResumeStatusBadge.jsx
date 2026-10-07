import React from 'react';

/**
 * Reusable Resume Status Badge
 * Minimalist status badge matching Stitch design with soft colored pill and dot indicator.
 *
 * @param {object} props
 * @param {'PENDING'|'PROCESSING'|'COMPLETED'|'FAILED'} props.status
 * @param {string} [props.className='']
 */
export const ResumeStatusBadge = ({ status, className = '' }) => {
  const normalized = String(status || '').toUpperCase();

  let label = status || 'Unknown';
  let dotColor = 'var(--text-muted)';
  let bg = 'var(--bg-container)';
  let color = 'var(--text-secondary)';
  let isPinging = false;

  switch (normalized) {
    case 'COMPLETED':
      label = 'Completed';
      dotColor = 'var(--success)';
      bg = 'var(--success-bg)';
      color = 'var(--success-text)';
      break;
    case 'PROCESSING':
      label = 'Processing';
      dotColor = 'var(--accent-primary)';
      bg = 'var(--accent-muted)';
      color = 'var(--accent-primary)';
      isPinging = true;
      break;
    case 'PENDING':
      label = 'Pending';
      dotColor = 'var(--warning)';
      bg = 'var(--warning-bg)';
      color = 'var(--warning-text)';
      break;
    case 'FAILED':
      label = 'Failed';
      dotColor = 'var(--danger)';
      bg = 'var(--danger-bg)';
      color = 'var(--danger-text)';
      break;
    default:
      label = status || 'Unknown';
      break;
  }

  return (
    <span
      className={`badge ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.2rem 0.625rem',
        borderRadius: 'var(--radius-full)',
        fontSize: '0.6875rem',
        fontWeight: 600,
        backgroundColor: bg,
        color: color,
        border: '1px solid transparent',
        transition: 'all var(--transition-fast)',
      }}
      role="status"
      aria-label={`Extraction status: ${label}`}
      data-testid="resume-status-badge"
    >
      <span
        style={{
          width: '0.45rem',
          height: '0.45rem',
          borderRadius: 'var(--radius-full)',
          backgroundColor: dotColor,
          display: 'inline-block',
          flexShrink: 0,
        }}
        className={isPinging ? 'animate-pulse' : ''}
      />
      <span>{label}</span>
    </span>
  );
};

export default ResumeStatusBadge;
