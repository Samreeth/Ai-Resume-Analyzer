import React from 'react';

/**
 * Reusable Progress / Coverage Bar Component
 *
 * @param {object} props
 * @param {number|string} props.value - Coverage percentage (0 - 100)
 * @param {'primary'|'required'|'preferred'|'success'|'warning'|'info'|'danger'} [props.variant='primary']
 * @param {string} [props.height='8px']
 * @param {string} [props.label]
 * @param {string} [props.sublabel]
 * @param {boolean} [props.showValue=true]
 * @param {string} [props.className='']
 */
export const ProgressBar = ({
  value = 0,
  variant = 'primary',
  height = '8px',
  label,
  sublabel,
  showValue = true,
  className = '',
}) => {
  const numericValue = Math.max(0, Math.min(100, Number(value) || 0));

  const getBarColor = (v) => {
    switch (v) {
      case 'required':
      case 'danger':
        return 'var(--danger)';
      case 'preferred':
      case 'info':
        return 'var(--info)';
      case 'success':
        return 'var(--success)';
      case 'warning':
        return 'var(--warning)';
      case 'primary':
      default:
        return 'var(--accent-primary)';
    }
  };

  const barColor = getBarColor(variant);

  return (
    <div className={`progress-bar-group ${className}`.trim()} style={{ width: '100%' }}>
      {(label || showValue) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '0.375rem',
            fontSize: 'var(--text-xs)',
          }}
        >
          {label && (
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </span>
          )}
          {showValue && (
            <span style={{ fontWeight: 700, color: barColor, fontVariantNumeric: 'tabular-nums' }}>
              {numericValue.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* Progress Track */}
      <div
        role="progressbar"
        aria-valuenow={numericValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
        style={{
          width: '100%',
          height,
          backgroundColor: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${numericValue}%`,
            height: '100%',
            backgroundColor: barColor,
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>

      {sublabel && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {sublabel}
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
