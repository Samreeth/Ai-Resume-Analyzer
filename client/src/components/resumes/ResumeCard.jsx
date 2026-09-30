import React from 'react';
import { Link } from 'react-router-dom';
import ResumeStatusBadge from './ResumeStatusBadge.jsx';
import Button from '../common/Button.jsx';

/**
 * Resume Card item for list display
 *
 * @param {object} props
 * @param {object} props.resume
 * @param {function} props.onDeleteClick
 */
export const ResumeCard = ({ resume, onDeleteClick }) => {
  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_) {
      return String(dateStr);
    }
  };

  const isDocx =
    resume.mime_type?.includes('word') ||
    resume.file_name?.toLowerCase().endsWith('.docx');

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '1rem',
      }}
      data-testid={`resume-card-${resume.resume_id}`}
    >
      {/* Header with Title & Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                padding: '0.125rem 0.375rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isDocx ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isDocx ? '#60a5fa' : '#f87171',
                textTransform: 'uppercase',
              }}
            >
              {isDocx ? 'DOCX' : 'PDF'}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {formatFileSize(resume.file_size)}
            </span>
          </div>

          <Link
            to={`/resumes/${resume.resume_id}`}
            style={{
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              wordBreak: 'break-word',
            }}
            title={resume.file_name}
          >
            {resume.file_name}
          </Link>
        </div>

        <ResumeStatusBadge status={resume.extraction_status} />
      </div>

      {/* Footer Info & Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 'auto',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}
      >
        <span>Uploaded {formatDate(resume.uploaded_at)}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            to={`/resumes/${resume.resume_id}`}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 'var(--text-xs)' }}
          >
            View
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDeleteClick(resume)}
            ariaLabel={`Delete resume ${resume.file_name}`}
            style={{ fontSize: 'var(--text-xs)' }}
            data-testid={`delete-resume-btn-${resume.resume_id}`}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResumeCard;
