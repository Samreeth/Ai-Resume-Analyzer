import React from 'react';
import Button from '../common/Button.jsx';

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
          <h3
            id="delete-analysis-dialog-title"
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Delete Analysis Report
          </h3>
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
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              marginBottom: '1rem',
            }}
            data-testid="delete-analysis-dialog-error"
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
