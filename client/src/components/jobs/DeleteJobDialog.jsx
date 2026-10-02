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
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-job-dialog-title"
        aria-describedby="delete-job-dialog-desc"
        onClick={(e) => e.stopPropagation()}
        data-testid="delete-job-dialog"
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-hidden="true"
            >
              <Icon name="trash" size={16} />
            </div>
            <h3
              id="delete-job-dialog-title"
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Delete Job Description
            </h3>
          </div>

          <p
            id="delete-job-dialog-desc"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              marginTop: '0.5rem',
              lineHeight: 1.5,
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
              marginBottom: '1rem',
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isDeleting}
            data-testid="delete-job-cancel-btn"
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
          >
            Delete Job
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeleteJobDialog;
