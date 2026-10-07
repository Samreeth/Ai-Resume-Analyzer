import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import Icon from '../common/Icon.jsx';

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
  const totalSkills = (requiredCount || 0) + (preferredCount || 0);

  // Sample skill pills if available in extracted_data
  const sampleRequiredSkills = Array.isArray(job.extracted_data?.required)
    ? job.extracted_data.required.slice(0, 3)
    : [];

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '1.25rem 1.35rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl, 1rem)',
        boxShadow: 'var(--shadow-xs)',
        transition: 'transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast)',
      }}
      data-testid={`job-card-${job.job_id}`}
    >
      {/* Top Header */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.75rem',
            marginBottom: '0.625rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
            <div
              style={{
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-container-low, rgba(99, 102, 241, 0.08))',
                border: '1px solid var(--border-subtle)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <Icon name="briefcase" size={17} />
            </div>

            <div style={{ minWidth: 0 }}>
              <Link
                to={`/jobs/${job.job_id}`}
                style={{
                  fontSize: 'var(--text-md, 0.9375rem)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  wordBreak: 'break-word',
                  display: 'block',
                  textDecoration: 'none',
                  lineHeight: 1.3,
                  transition: 'color var(--transition-fast)',
                }}
                title={job.title}
                data-testid={`job-title-link-${job.job_id}`}
              >
                <span>{job.title}</span>
              </Link>
            </div>
          </div>

          {/* Status Badge */}
          {hasSkills ? (
            <Badge variant="brand" size="sm" style={{ flexShrink: 0 }}>
              <Icon name="sparkles" size={11} />
              <span>{totalSkills} Skills</span>
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm" style={{ flexShrink: 0 }}>
              <span>Draft</span>
            </Badge>
          )}
        </div>

        {/* Description snippet if available */}
        {job.description && (
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
              marginBottom: '0.85rem',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {requiredCount !== null && (
                <Badge variant="required" size="sm">
                  Required: {requiredCount}
                </Badge>
              )}
              {preferredCount !== null && (
                <Badge variant="preferred" size="sm">
                  Preferred: {preferredCount}
                </Badge>
              )}
            </div>

            {/* Optional preview chips for top required skills */}
            {sampleRequiredSkills.length > 0 && (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', paddingTop: '0.125rem' }}>
                {sampleRequiredSkills.map((s, idx) => (
                  <span
                    key={s.skillId || idx}
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.125rem 0.45rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {s.skillName}
                  </span>
                ))}
                {job.extracted_data.required.length > 3 && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    +{job.extracted_data.required.length - 3} more
                  </span>
                )}
              </div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }} className="tabular-nums">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              calendar_today
            </span>
            <span>Created {formatDate(job.created_at)}</span>
          </span>
          {job.updated_at && job.updated_at !== job.created_at && (
            <span style={{ fontSize: '10px', paddingLeft: '1.125rem' }}>
              Updated {formatDate(job.updated_at)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            to={`/jobs/${job.job_id}`}
            className="btn btn-secondary btn-sm"
            data-testid={`view-job-link-${job.job_id}`}
            style={{
              borderRadius: 'var(--radius-full)',
              padding: '0.3rem 0.75rem',
              gap: '0.25rem',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <span>Inspect</span>
            <Icon name="arrow-right" size={13} />
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDeleteClick(job)}
            ariaLabel={`Delete job description ${job.title}`}
            data-testid={`delete-job-btn-${job.job_id}`}
            style={{
              borderRadius: 'var(--radius-full)',
              padding: '0.3rem 0.65rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <Icon name="trash" size={13} />
            <span>Delete</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
