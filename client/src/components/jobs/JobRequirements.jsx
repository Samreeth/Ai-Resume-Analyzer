import React from 'react';
import Button from '../common/Button.jsx';
import Spinner from '../common/Spinner.jsx';
import Badge from '../common/Badge.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Renders structured job requirements extracted from a job description.
 *
 * @param {object} props
 * @param {object|null} props.extractedData
 * @param {function} [props.onExtract] - Callback to trigger/retry extraction
 * @param {boolean} [props.isExtracting=false]
 * @param {string} [props.error]
 */
export const JobRequirements = ({
  extractedData,
  onExtract,
  isExtracting = false,
  error = '',
}) => {
  const hasExtracted = Boolean(extractedData && (extractedData.required || extractedData.preferred));
  const requiredSkills = hasExtracted && Array.isArray(extractedData.required) ? extractedData.required : [];
  const preferredSkills = hasExtracted && Array.isArray(extractedData.preferred) ? extractedData.preferred : [];
  const metadata = extractedData?.metadata;

  return (
    <div
      className="card"
      data-testid="job-requirements"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl, 1rem)',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
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
          margin: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '2.5rem',
              height: '2.5rem',
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
            <Icon name="sparkles" size={18} />
          </div>

          <div>
            <h3
              className="card-title"
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              Structured Requirements
            </h3>
            <p
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                marginTop: '0.125rem',
                margin: 0,
              }}
            >
              {hasExtracted && metadata?.extractedAt
                ? `Extracted on ${new Date(metadata.extractedAt).toLocaleString()}`
                : 'Extracted competencies, required skills, and preferred qualifications.'}
            </p>
          </div>
        </div>

        {onExtract && (
          <Button
            type="button"
            variant={hasExtracted ? 'secondary' : 'primary'}
            size="sm"
            onClick={onExtract}
            loading={isExtracting}
            disabled={isExtracting}
            data-testid="extract-requirements-btn"
            style={{ borderRadius: 'var(--radius-full)', padding: '0.4rem 0.85rem' }}
          >
            <Icon name="refresh" size={14} />
            <span>{hasExtracted ? 'Re-extract Requirements' : 'Extract Requirements'}</span>
          </Button>
        )}
      </div>

      {/* Error state */}
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
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'fadeIn 0.2s ease-out',
          }}
          data-testid="requirements-error"
        >
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {isExtracting && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '2.5rem 1rem',
            color: 'var(--text-secondary)',
          }}
          data-testid="requirements-loading"
        >
          <Spinner size="md" />
          <span style={{ fontSize: 'var(--text-sm)' }}>Extracting structured requirements from description...</span>
        </div>
      )}

      {/* Not yet extracted state */}
      {!isExtracting && !hasExtracted && (
        <div
          style={{
            textAlign: 'center',
            padding: '2.5rem 1.5rem',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border-default)',
          }}
          data-testid="requirements-not-extracted"
        >
          <div
            style={{
              width: '3rem',
              height: '3rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-container-low)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
            }}
          >
            <Icon name="sparkles" size={20} />
          </div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)', margin: '0 0 0.25rem' }}>
            Structured requirements not extracted yet
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', margin: 0 }}>
            Structured requirements have not been extracted for this job description yet.
          </p>
          {onExtract && (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: '0.5rem' }}>
              Click <strong>Extract Requirements</strong> above to identify required and preferred skills.
            </p>
          )}
        </div>
      )}

      {/* Extracted content */}
      {!isExtracting && hasExtracted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary counts bar */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              fontSize: 'var(--text-xs)',
            }}
          >
            <span
              style={{
                backgroundColor: 'var(--bg-surface)',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--danger)',
                }}
              />
              Required Skills: <strong style={{ color: 'var(--text-primary)' }} className="tabular-nums">{requiredSkills.length}</strong>
            </span>
            <span
              style={{
                backgroundColor: 'var(--bg-surface)',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-primary)',
                }}
              />
              Preferred Skills: <strong style={{ color: 'var(--text-primary)' }} className="tabular-nums">{preferredSkills.length}</strong>
            </span>
          </div>

          {/* Empty skills extraction */}
          {requiredSkills.length === 0 && preferredSkills.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
              data-testid="requirements-empty"
            >
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
                No known required or preferred skills were detected in this job description text.
              </p>
            </div>
          )}

          {/* Required Skills Section */}
          {requiredSkills.length > 0 && (
            <div data-testid="required-skills-section">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.85rem',
                }}
              >
                <h4
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  Required Skills
                </h4>
                <Badge variant="required" size="sm">
                  {requiredSkills.length}
                </Badge>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '0.75rem',
                }}
                data-testid="required-skills-list"
              >
                {requiredSkills.map((skill, idx) => (
                  <div
                    key={skill.skillId || skill.skillName || idx}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg, 0.75rem)',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
                    }}
                    data-testid={`required-skill-${skill.skillName}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        {skill.skillName || skill.name}
                      </span>
                      {skill.category && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            backgroundColor: 'var(--bg-container-low)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border-subtle)',
                            fontWeight: 500,
                          }}
                        >
                          {skill.category}
                        </span>
                      )}
                    </div>
                    {skill.evidence && (
                      <p
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-secondary)',
                          margin: '0.25rem 0 0 0',
                          fontStyle: 'italic',
                          lineHeight: 1.45,
                        }}
                      >
                        "{skill.evidence}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preferred Skills Section */}
          {preferredSkills.length > 0 && (
            <div data-testid="preferred-skills-section">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.85rem',
                }}
              >
                <h4
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  Preferred Skills
                </h4>
                <Badge variant="preferred" size="sm">
                  {preferredSkills.length}
                </Badge>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '0.75rem',
                }}
                data-testid="preferred-skills-list"
              >
                {preferredSkills.map((skill, idx) => (
                  <div
                    key={skill.skillId || skill.skillName || idx}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg, 0.75rem)',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
                    }}
                    data-testid={`preferred-skill-${skill.skillName}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        {skill.skillName || skill.name}
                      </span>
                      {skill.category && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            backgroundColor: 'var(--bg-container-low)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border-subtle)',
                            fontWeight: 500,
                          }}
                        >
                          {skill.category}
                        </span>
                      )}
                    </div>
                    {skill.evidence && (
                      <p
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-secondary)',
                          margin: '0.25rem 0 0 0',
                          fontStyle: 'italic',
                          lineHeight: 1.45,
                        }}
                      >
                        "{skill.evidence}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobRequirements;
