import React from 'react';
import Button from '../common/Button.jsx';
import Spinner from '../common/Spinner.jsx';
import Badge from '../common/Badge.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Prioritized Actionable Recommendations Component
 *
 * @param {object} props
 * @param {Array} props.recommendations
 * @param {string} [props.disclaimer]
 * @param {string} [props.selectedPriority='ALL']
 * @param {function} [props.onPriorityChange]
 * @param {string} [props.selectedCategory='ALL']
 * @param {function} [props.onCategoryChange]
 * @param {boolean} [props.isLoading=false]
 * @param {string} [props.error]
 * @param {function} [props.onRetry]
 */
export const Recommendations = ({
  recommendations = [],
  disclaimer,
  selectedPriority = 'ALL',
  onPriorityChange,
  selectedCategory = 'ALL',
  onCategoryChange,
  isLoading = false,
  error = '',
  onRetry,
}) => {
  const getPriorityVariant = (priority) => {
    switch (priority) {
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'medium';
      case 'LOW':
        return 'low';
      default:
        return 'neutral';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH':
        return 'var(--danger)';
      case 'MEDIUM':
        return 'var(--warning)';
      case 'LOW':
        return 'var(--info)';
      default:
        return 'var(--accent-primary)';
    }
  };

  const getCategoryLabel = (cat) => {
    switch (cat) {
      case 'SKILL_GAP':
        return 'Skill Gap';
      case 'RESUME_QUALITY':
        return 'Resume Quality';
      case 'IMPACT_METRICS':
        return 'Impact Metrics';
      case 'FORMATTING':
        return 'Formatting';
      default:
        return cat;
    }
  };

  return (
    <div className="card" data-testid="recommendations-section">
      {/* Header and Filter Controls */}
      <div
        className="card-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon name="sparkles" size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>Actionable Recommendations</span>
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Prioritized heuristics for addressing skill gaps, strengthening impact, and enhancing resume structure
          </p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Priority Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <label
              htmlFor="priority-filter"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500 }}
            >
              Priority:
            </label>
            <select
              id="priority-filter"
              value={selectedPriority}
              onChange={(e) => onPriorityChange && onPriorityChange(e.target.value)}
              className="input-field"
              style={{ padding: '0.35rem 0.65rem', fontSize: 'var(--text-xs)', width: 'auto' }}
              data-testid="filter-priority-select"
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <label
              htmlFor="category-filter"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500 }}
            >
              Category:
            </label>
            <select
              id="category-filter"
              value={selectedCategory}
              onChange={(e) => onCategoryChange && onCategoryChange(e.target.value)}
              className="input-field"
              style={{ padding: '0.35rem 0.65rem', fontSize: 'var(--text-xs)', width: 'auto' }}
              data-testid="filter-category-select"
            >
              <option value="ALL">All Categories</option>
              <option value="SKILL_GAP">Skill Gap</option>
              <option value="RESUME_QUALITY">Resume Quality</option>
              <option value="IMPACT_METRICS">Impact Metrics</option>
              <option value="FORMATTING">Formatting</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '2.5rem 1rem',
            color: 'var(--text-secondary)',
          }}
          data-testid="recommendations-loading"
        >
          <Spinner size="md" />
          <span style={{ fontSize: 'var(--text-sm)' }}>Loading recommendations and diagnostics...</span>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}
          data-testid="recommendations-error"
        >
          <p style={{ fontSize: 'var(--text-sm)', margin: '0 0 1rem 0' }}>{error}</p>
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry} data-testid="recommendations-retry-btn">
              Retry Recommendations
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {recommendations.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-sm)',
              }}
              data-testid="recommendations-empty"
            >
              No recommendations match the selected filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {recommendations.map((rec) => {
                const priorityVariant = getPriorityVariant(rec.priority);
                const accentColor = getPriorityColor(rec.priority);

                return (
                  <div
                    key={rec.id}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      transition: 'border-color var(--transition-fast)',
                    }}
                    data-testid={`recommendation-item-${rec.id}`}
                  >
                    {/* Header Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Badge variant={priorityVariant}>
                        {rec.priority} PRIORITY
                      </Badge>

                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-elevated)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {getCategoryLabel(rec.category)}
                      </span>
                    </div>

                    {/* Title */}
                    <h4
                      style={{
                        fontSize: 'var(--text-base)',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: 0,
                      }}
                    >
                      {rec.title}
                    </h4>

                    {/* Message Context */}
                    <p
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-secondary)',
                        margin: 0,
                        lineHeight: 1.6,
                      }}
                    >
                      {rec.message}
                    </p>

                    {/* Action Step */}
                    <div
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderLeft: `3px solid ${accentColor}`,
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        marginTop: '0.25rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--text-primary)',
                          display: 'block',
                          marginBottom: '0.25rem',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Recommended Action:
                      </span>
                      <p
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-secondary)',
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        {rec.action}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Disclaimer */}
          {disclaimer && (
            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.875rem',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                fontStyle: 'italic',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
              data-testid="recommendations-disclaimer"
            >
              <Icon name="sparkles" size={14} style={{ color: 'var(--text-muted)' }} />
              <span>{disclaimer}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Recommendations;
