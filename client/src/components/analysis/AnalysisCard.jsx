import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Analysis Card item for history list display
 * Strictly adheres to the unified card design system of JobCard and ResumeCard.
 *
 * @param {object} props
 * @param {object} props.analysis
 * @param {function} props.onDeleteClick
 */
export const AnalysisCard = ({ analysis, onDeleteClick }) => {
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

  const score = Number(analysis.overall_score) || 0;

  // Determine score badge variant based on matching percentage
  const getScoreBadgeVariant = (sc) => {
    if (sc >= 80) return 'high';
    if (sc >= 60) return 'medium';
    return 'low';
  };

  const badgeVariant = getScoreBadgeVariant(score);

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
      data-testid={`analysis-card-${analysis.analysis_id}`}
    >
      <div>
        {/* Top Header: Icon + Job Title + Score Badge */}
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
              <Icon name="chart" size={17} />
            </div>

            <div style={{ minWidth: 0 }}>
              <Link
                to={`/analyses/${analysis.analysis_id}`}
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
                title={analysis.job_title}
                data-testid={`analysis-title-link-${analysis.analysis_id}`}
              >
                <span>{analysis.job_title}</span>
              </Link>

              {/* Resume File Pill */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.25rem',
                  backgroundColor: 'var(--bg-container)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-subtle)',
                  maxWidth: '100%',
                }}
              >
                <Icon name="file" size={12} style={{ color: 'var(--text-muted)' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {analysis.resume_file_name}
                </span>
              </div>
            </div>
          </div>

          {/* Overall Match Score Badge */}
          <span
            className="tabular-nums"
            style={{
              fontSize: 'var(--text-xs, 0.75rem)',
              fontWeight: 700,
              padding: '0.25rem 0.65rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor:
                score >= 80
                  ? 'var(--success-bg)'
                  : score >= 60
                  ? 'var(--warning-bg)'
                  : 'var(--danger-bg)',
              color:
                score >= 80
                  ? 'var(--success-text)'
                  : score >= 60
                  ? 'var(--warning-text)'
                  : 'var(--danger-text)',
              border: `1px solid ${
                score >= 80
                  ? 'var(--success-border)'
                  : score >= 60
                  ? 'var(--warning-border)'
                  : 'var(--danger-border)'
              }`,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            data-testid={`analysis-score-badge-${analysis.analysis_id}`}
          >
            {score.toFixed(1)}% Match
          </span>
        </div>

        {/* Skill Breakdown Badges */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <Badge variant="matched" size="sm">
            Matched: {analysis.matched_count ?? 0}
          </Badge>
          <Badge variant="missing" size="sm">
            Missing: {analysis.missing_count ?? 0}
          </Badge>
        </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} className="tabular-nums">
          <span className="material-symbols-outlined" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            calendar_today
          </span>
          <span>Analyzed {formatDate(analysis.created_at)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            to={`/analyses/${analysis.analysis_id}`}
            className="btn btn-secondary btn-sm"
            data-testid={`view-analysis-link-${analysis.analysis_id}`}
            style={{
              borderRadius: 'var(--radius-full)',
              padding: '0.3rem 0.75rem',
              gap: '0.25rem',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <span>View Report</span>
            <Icon name="arrow-right" size={13} />
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDeleteClick(analysis)}
            ariaLabel={`Delete analysis for ${analysis.job_title}`}
            data-testid={`delete-analysis-btn-${analysis.analysis_id}`}
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

export default AnalysisCard;
