import React from 'react';
import Button from '../common/Button.jsx';

/**
 * Accessible confirmation modal for deleting a resume
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {string} props.resumeName
 * @param {function} props.onConfirm
 * @param {function} props.onCancel
 * @param {boolean} [props.isDeleting=false]
 * @param {string} [props.error]
 */
export const DeleteResumeDialog = ({
  isOpen,
  resumeName,
  onConfirm,
  onCancel,
  isDeleting = false,
  error,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={!isDeleting ? onCancel : undefined}
      role="presentation"
      data-testid="delete-dialog-backdrop"
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-desc"
        onClick={(e) => e.stopPropagation()}
        data-testid="delete-dialog"
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <h3
            id="delete-dialog-title"
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Delete Resume
          </h3>
          <p
            id="delete-dialog-desc"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              marginTop: '0.5rem',
              lineHeight: 1.5,
            }}
          >
            Are you sure you want to delete{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{resumeName}</strong>?
            This will permanently remove the stored resume file and its extraction metadata.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              marginBottom: '1rem',
            }}
            data-testid="delete-dialog-error"
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isDeleting}
            data-testid="delete-dialog-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            loading={isDeleting}
            disabled={isDeleting}
            data-testid="delete-dialog-confirm-btn"
          >
            Delete Resume
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeleteResumeDialog;
