import React, { useEffect } from 'react';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Accessible confirmation modal for deleting a historical analysis report
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {object} [props.analysis] - Analysis item being deleted
 * @param {function} props.onConfirm
 * @param {function} props.onCancel
 * @param {boolean} [props.isDeleting=false]
 * @param {string} [props.error]
 */
export const DeleteAnalysisDialog = ({
  isOpen,
  analysis,
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

  const jobTitle = analysis?.job_title || 'Target Job';
  const resumeName = analysis?.resume_file_name || 'Resume';

  return (
    <div
      className="modal-backdrop"
      onClick={!isDeleting ? onCancel : undefined}
      role="presentation"
      data-testid="delete-analysis-dialog-backdrop"
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-analysis-dialog-title"
        aria-describedby="delete-analysis-dialog-desc"
        onClick={(e) => e.stopPropagation()}
        data-testid="delete-analysis-dialog"
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
              id="delete-analysis-dialog-title"
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Delete Analysis Report
            </h3>
          </div>

          <p
            id="delete-analysis-dialog-desc"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              marginTop: '0.5rem',
              lineHeight: 1.5,
            }}
          >
            Are you sure you want to delete the analysis report between{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{resumeName}</strong> and{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{jobTitle}</strong>?
            This action permanently removes the match breakdown and itemized skill evaluations.
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
            data-testid="delete-analysis-dialog-error"
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
            data-testid="delete-analysis-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            loading={isDeleting}
            disabled={isDeleting}
            data-testid="delete-analysis-confirm-btn"
          >
            Delete Analysis
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAnalysisDialog;
