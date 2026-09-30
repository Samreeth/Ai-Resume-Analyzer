import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../common/Button.jsx';

/**
 * Job Card item for list display
 *
 * @param {object} props
 * @param {object} props.job
 * @param {function} props.onDeleteClick
 */
export const JobCard = ({ job, onDeleteClick }) => {
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

  const requiredCount =
    job.skill_counts?.required ??
    (Array.isArray(job.extracted_data?.required) ? job.extracted_data.required.length : null);

  const preferredCount =
    job.skill_counts?.preferred ??
    (Array.isArray(job.extracted_data?.preferred) ? job.extracted_data.preferred.length : null);

  const hasSkills = requiredCount !== null || preferredCount !== null;

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '1rem',
      }}
      data-testid={`job-card-${job.job_id}`}
    >
      {/* Header with Title and Skills Pill */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.75rem',
            marginBottom: '0.5rem',
          }}
        >
          <Link
            to={`/jobs/${job.job_id}`}
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              wordBreak: 'break-word',
            }}
            title={job.title}
            data-testid={`job-title-link-${job.job_id}`}
          >
            {job.title}
          </Link>
        </div>

        {/* Description snippet if available */}
        {job.description && (
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              marginBottom: '0.75rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            data-testid={`job-snippet-${job.job_id}`}
          >
            {job.description}
          </p>
        )}

        {/* Skill counts summary */}
        {hasSkills ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {requiredCount !== null && (
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  backgroundColor: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  border: '1px solid var(--danger-border)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 500,
                }}
              >
                Required: {requiredCount}
              </span>
            )}
            {preferredCount !== null && (
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  backgroundColor: 'var(--info-bg)',
                  color: 'var(--info)',
                  border: '1px solid var(--info-border)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 500,
                }}
              >
                Preferred: {preferredCount}
              </span>
            )}
          </div>
        ) : (
          <div style={{ marginTop: '0.5rem' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
              }}
            >
              Extraction pending
            </span>
          </div>
        )}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          <span>Created {formatDate(job.created_at)}</span>
          {job.updated_at && job.updated_at !== job.created_at && (
            <span style={{ fontSize: '10px' }}>Updated {formatDate(job.updated_at)}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            to={`/jobs/${job.job_id}`}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 'var(--text-xs)' }}
            data-testid={`view-job-link-${job.job_id}`}
          >
            View
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDeleteClick(job)}
            ariaLabel={`Delete job description ${job.title}`}
            style={{ fontSize: 'var(--text-xs)' }}
            data-testid={`delete-job-btn-${job.job_id}`}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
