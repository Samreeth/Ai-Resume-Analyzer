import React from 'react';

/**
 * Reusable Resume Status Badge
 * Maps backend extraction lifecycle statuses to visual badges.
 *
 * @param {object} props
 * @param {'PENDING'|'PROCESSING'|'COMPLETED'|'FAILED'} props.status
 * @param {string} [props.className='']
 */
export const ResumeStatusBadge = ({ status, className = '' }) => {
  const normalized = String(status || '').toUpperCase();

  let badgeClass = 'badge';
  let label = status || 'Unknown';
  let icon = null;

  switch (normalized) {
    case 'COMPLETED':
      badgeClass = 'badge badge-completed';
      label = 'Completed';
      icon = '✓';
      break;
    case 'PROCESSING':
      badgeClass = 'badge badge-processing';
      label = 'Processing';
      icon = (
        <span
          className="spinner"
          style={{ width: '0.625rem', height: '0.625rem', borderWidth: '1px' }}
          aria-hidden="true"
        />
      );
      break;
    case 'PENDING':
      badgeClass = 'badge badge-pending';
      label = 'Pending';
      icon = '⏳';
      break;
    case 'FAILED':
      badgeClass = 'badge badge-failed';
      label = 'Failed';
      icon = '✕';
      break;
    default:
      badgeClass = 'badge';
      label = status || 'Unknown';
      break;
  }

  return (
    <span
      className={`${badgeClass} ${className}`.trim()}
      role="status"
      aria-label={`Extraction status: ${label}`}
      data-testid="resume-status-badge"
    >
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      <span>{label}</span>
    </span>
  );
};

export default ResumeStatusBadge;
