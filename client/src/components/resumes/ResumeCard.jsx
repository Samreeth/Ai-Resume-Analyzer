import React from 'react';
import { Link } from 'react-router-dom';
import ResumeStatusBadge from './ResumeStatusBadge.jsx';

/**
 * Resume Card item matching Stitch design
 * Clean, structured card with document format badge, file size, status pill, and action triggers.
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

  // Extract candidate role or word count if available in extracted_data
  const wordCount = resume.extracted_data?.wordCount || resume.word_count || null;
  const candidateName =
    resume.extracted_data?.candidate?.name ||
    resume.extracted_data?.name ||
    null;
  const candidateRole =
    resume.extracted_data?.candidate?.title ||
    resume.extracted_data?.title ||
    null;

  return (
    <div
      className="card group"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-xs)',
        transition: 'all var(--transition-fast)',
        minHeight: '220px',
      }}
      data-testid={`resume-card-${resume.resume_id}`}
    >
      <div>
        {/* Top Meta Bar: Format Pill + File Size + Status Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: isDocx ? 'var(--bg-container-high)' : 'var(--danger-bg)',
                color: isDocx ? 'var(--accent-primary)' : 'var(--danger-text)',
                letterSpacing: '0.04em',
              }}
            >
              {isDocx ? 'DOCX' : 'PDF'}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: 'var(--text-muted)',
              }}
              className="tabular-nums"
            >
              {formatFileSize(resume.file_size)}
            </span>
          </div>

          <ResumeStatusBadge status={resume.extraction_status} />
        </div>

        {/* Center File Info with Large Icon */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-container-low)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDocx ? 'var(--accent-primary)' : 'var(--danger)',
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.75rem' }}>
              {isDocx ? 'description' : 'picture_as_pdf'}
            </span>
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <Link
              to={`/resumes/${resume.resume_id}`}
              style={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                textDecoration: 'none',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.35,
              }}
              title={resume.file_name}
            >
              {resume.file_name}
            </Link>

            {candidateName || candidateRole ? (
              <p
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  margin: '0.2rem 0 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {[candidateName, candidateRole].filter(Boolean).join(' • ')}
              </p>
            ) : (
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  margin: '0.25rem 0 0',
                }}
              >
                {wordCount ? `${wordCount} words • ATS Parsed` : 'Staged candidate profile document'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer: Uploaded Date + Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 'auto',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <span>Uploaded {formatDate(resume.uploaded_at)}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Link
            to={`/resumes/${resume.resume_id}`}
            style={{
              padding: '0.3rem 0.65rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-container-low)',
              color: 'var(--text-primary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              textDecoration: 'none',
              border: '1px solid var(--border-subtle)',
              transition: 'all var(--transition-fast)',
            }}
          >
            Inspect
          </Link>

          <button
            type="button"
            onClick={() => onDeleteClick(resume)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.35rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            aria-label={`Delete resume ${resume.file_name}`}
            data-testid={`delete-resume-btn-${resume.resume_id}`}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '1.15rem' }}
            >
              delete_outline
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumeCard;
