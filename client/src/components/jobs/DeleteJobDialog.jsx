import React, { useEffect } from 'react';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Accessible confirmation modal for deleting a job description
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {string} props.jobTitle
 * @param {function} props.onConfirm
 * @param {function} props.onCancel
 * @param {boolean} [props.isDeleting=false]
 * @param {string} [props.error]
 */
export const DeleteJobDialog = ({
  isOpen,
  jobTitle,
  onConfirm,
  onCancel,
  isDeleting = false,
  error,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={!isDeleting ? onCancel : undefined}
      role="presentation"
      data-testid="delete-job-dialog-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-overlay, rgba(15, 23, 42, 0.6))',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-job-dialog-title"
        aria-describedby="delete-job-dialog-desc"
        onClick={(e) => e.stopPropagation()}
        data-testid="delete-job-dialog"
        style={{
          width: '100%',
          maxWidth: '28rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl, 1rem)',
          boxShadow: 'var(--shadow-lg)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                border: '1px solid var(--danger-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <Icon name="trash" size={18} />
            </div>
            <div>
              <h3
                id="delete-job-dialog-title"
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  margin: 0,
                }}
              >
                Delete Job Description
              </h3>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Irreversible deletion action
              </span>
            </div>
          </div>

          <p
            id="delete-job-dialog-desc"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Are you sure you want to delete{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{jobTitle}</strong>?
            This will permanently remove the job description and its extracted requirements.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            data-testid="delete-job-dialog-error"
          >
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isDeleting}
            data-testid="delete-job-cancel-btn"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            loading={isDeleting}
            disabled={isDeleting}
            data-testid="delete-job-confirm-btn"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            Delete Job
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeleteJobDialog;
