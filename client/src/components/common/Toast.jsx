import React from 'react';

/**
 * Accessible Toast alert item
 *
 * @param {object} props
 * @param {string} props.id
 * @param {'success'|'error'|'info'} [props.type='info']
 * @param {string} [props.title]
 * @param {string} props.message
 * @param {function} props.onDismiss
 */
export const Toast = ({
  id,
  type = 'info',
  title,
  message,
  onDismiss,
}) => {
  const isError = type === 'error';

  return (
    <div
      className={`toast toast-${type}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <div style={{ flex: 1 }}>
        {title && (
          <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
            {title}
          </div>
        )}
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {message}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '0.25rem',
          fontSize: '1rem',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ×
      </button>
    </div>
  );
};

export default Toast;
