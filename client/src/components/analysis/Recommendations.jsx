import React, { useState } from 'react';
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
  isLoading = false,
  error = '',
  onRetry,
}) => {
  const highCount = recommendations.filter((r) => r.priority === 'HIGH').length;
  const mediumCount = recommendations.filter((r) => r.priority === 'MEDIUM').length;
  const lowCount = recommendations.filter((r) => r.priority === 'LOW').length;

  const [userSelected, setUserSelected] = useState(false);

  // Active priority filter: default to HIGH if available, else first non-zero priority, else HIGH
  const [activePriority, setActivePriority] = useState(() => {
    if (selectedPriority && selectedPriority !== 'ALL') return selectedPriority;
    if (highCount > 0) return 'HIGH';
    if (mediumCount > 0) return 'MEDIUM';
    if (lowCount > 0) return 'LOW';
    return 'HIGH';
  });

  // Keep active priority updated when data loads unless user explicitly picked a tab
  React.useEffect(() => {
    if (!userSelected && recommendations.length > 0) {
      if (highCount > 0) {
        setActivePriority('HIGH');
      } else if (mediumCount > 0) {
        setActivePriority('MEDIUM');
      } else if (lowCount > 0) {
        setActivePriority('LOW');
      }
    }
  }, [recommendations.length, highCount, mediumCount, lowCount, userSelected]);

  const handlePrioritySelect = (priority) => {
    setUserSelected(true);
    setActivePriority(priority);
    if (onPriorityChange) {
      onPriorityChange(priority);
    }
  };

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
        return '#f87171';
      case 'MEDIUM':
        return '#fbbf24';
      case 'LOW':
        return '#60a5fa';
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

  const visibleCount = recommendations.filter((r) => r.priority === activePriority).length;

  return (
    <div
      className="card"
      data-testid="recommendations-section"
      style={{
        backgroundColor: 'var(--bg-card, rgb(23, 24, 26))',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        borderRadius: 'var(--radius-xl, 1.25rem)',
        padding: '1.25rem 1.5rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.15rem',
      }}
    >
      {/* Header and 3-Button Pill Filter Strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '-0.01em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#818cf8' }}>
              auto_awesome
            </span>
            <span>Actionable Recommendations</span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', margin: '0.25rem 0 0 0' }}>
            Prioritized heuristics for addressing skill gaps, strengthening impact, and enhancing resume structure
          </p>
        </div>

        {/* 3-Button Segmented Priority Pill Bar */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '9999px',
            padding: '2px 3px',
            gap: '0.2rem',
          }}
        >
          <button
            type="button"
            onClick={() => handlePrioritySelect('HIGH')}
            data-testid="filter-priority-high"
            style={{
              backgroundColor: activePriority === 'HIGH' ? '#5865f2' : 'transparent',
              color: activePriority === 'HIGH' ? '#ffffff' : '#8594ab',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.35rem 0.95rem',
              fontSize: '0.78rem',
              fontWeight: activePriority === 'HIGH' ? 700 : 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            High ({highCount})
          </button>
          <button
            type="button"
            onClick={() => handlePrioritySelect('MEDIUM')}
            data-testid="filter-priority-medium"
            style={{
              backgroundColor: activePriority === 'MEDIUM' ? '#5865f2' : 'transparent',
              color: activePriority === 'MEDIUM' ? '#ffffff' : '#8594ab',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.35rem 0.95rem',
              fontSize: '0.78rem',
              fontWeight: activePriority === 'MEDIUM' ? 700 : 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Medium ({mediumCount})
          </button>
          <button
            type="button"
            onClick={() => handlePrioritySelect('LOW')}
            data-testid="filter-priority-low"
            style={{
              backgroundColor: activePriority === 'LOW' ? '#5865f2' : 'transparent',
              color: activePriority === 'LOW' ? '#ffffff' : '#8594ab',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.35rem 0.95rem',
              fontSize: '0.78rem',
              fontWeight: activePriority === 'LOW' ? 700 : 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Low ({lowCount})
          </button>
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
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
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
              {/* Empty state message if active priority has 0 items */}
              {visibleCount === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '2.5rem 1rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  No {activePriority.toLowerCase()} priority recommendations detected for this role.
                </div>
              )}

              {recommendations.map((rec, index) => {
                const priorityVariant = getPriorityVariant(rec.priority);
                const isCurrentPriority = rec.priority === activePriority;

                return (
                  <div
                    key={rec.id || `rec-${index}`}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                      borderRadius: 'var(--radius-lg, 0.75rem)',
                      padding: '0.85rem 1.15rem',
                      display: isCurrentPriority ? 'flex' : 'none',
                      flexDirection: 'column',
                      gap: '0.55rem',
                      transition: 'border-color var(--transition-fast)',
                    }}
                    data-testid={`recommendation-item-${rec.id}`}
                  >
                    {/* Header Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <Badge variant={priorityVariant}>
                        {rec.priority} PRIORITY
                      </Badge>

                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '0.12rem 0.45rem',
                          borderRadius: 'var(--radius-sm, 0.25rem)',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--text-secondary, #cbd5e1)',
                          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                        }}
                      >
                        {getCategoryLabel(rec.category)}
                      </span>
                    </div>

                    {/* Title */}
                    <h4
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        margin: 0,
                      }}
                    >
                      {rec.title}
                    </h4>

                    {/* Message Context */}
                    <p
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary, #94a3b8)',
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {rec.message}
                    </p>

                    {/* Action Step */}
                    <div
                      style={{
                        padding: '0.55rem 0.85rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'var(--bg-container-low, rgb(19, 19, 22))',
                        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary, #94a3b8)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.6rem',
                        lineHeight: 1.45,
                        marginTop: '0.35rem',
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: '1rem',
                          color: '#818cf8',
                          flexShrink: 0,
                          marginTop: '0.1rem',
                        }}
                      >
                        lightbulb
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ color: 'var(--text-primary)', fontWeight: 600, marginRight: '0.35rem' }}>
                          Recommended Action:
                        </strong>
                        <span>{rec.action}</span>
                      </div>
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
                marginTop: '0.5rem',
                paddingTop: '0.875rem',
                borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                fontSize: '0.8rem',
                color: 'var(--text-muted, #94a3b8)',
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
