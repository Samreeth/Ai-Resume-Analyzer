import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Analysis Card item for history list display
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

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '1rem',
      }}
      data-testid={`analysis-card-${analysis.analysis_id}`}
    >
      <div>
        {/* Header: Title and Overall Score */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.75rem',
            marginBottom: '0.5rem',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <Link
              to={`/analyses/${analysis.analysis_id}`}
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                wordBreak: 'break-word',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
              title={analysis.job_title}
              data-testid={`analysis-title-link-${analysis.analysis_id}`}
            >
              <Icon name="chart" size={16} style={{ color: 'var(--accent-primary)' }} />
              <span>{analysis.job_title}</span>
            </Link>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginTop: '0.35rem',
              }}
            >
              <Icon name="file" size={12} style={{ color: 'var(--text-muted)' }} />
              <span>Resume:</span>
              <strong style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                {analysis.resume_file_name}
              </strong>
            </div>
          </div>

          {/* Score Badge */}
          <span
            className="tabular-nums"
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              padding: '0.25rem 0.625rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-default)',
              borderWidth: '1px',
              borderStyle: 'solid',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
            data-testid={`analysis-score-badge-${analysis.analysis_id}`}
          >
            {score.toFixed(1)}% Match
          </span>
        </div>

        {/* Skill Counts Breakdown */}
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
        <span className="tabular-nums">Analyzed {formatDate(analysis.created_at)}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            to={`/analyses/${analysis.analysis_id}`}
            className="btn btn-secondary btn-sm"
            data-testid={`view-analysis-link-${analysis.analysis_id}`}
          >
            View Report
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDeleteClick(analysis)}
            ariaLabel={`Delete analysis for ${analysis.job_title}`}
            data-testid={`delete-analysis-btn-${analysis.analysis_id}`}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisCard;
