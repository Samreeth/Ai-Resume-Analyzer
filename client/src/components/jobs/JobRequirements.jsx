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
    <div className="card" data-testid="job-requirements">
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
            <Icon name="briefcase" size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>Structured Requirements</span>
          </h3>
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginTop: '0.25rem',
            }}
          >
            {hasExtracted && metadata?.extractedAt
              ? `Extracted on ${new Date(metadata.extractedAt).toLocaleString()}`
              : 'Extracted competencies, required skills, and preferred qualifications.'}
          </p>
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
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
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
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-subtle)',
          }}
          data-testid="requirements-not-extracted"
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            <Icon name="search" size={28} />
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
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
          {/* Summary counts */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
              fontSize: 'var(--text-xs)',
            }}
          >
            <span
              style={{
                backgroundColor: 'var(--bg-surface)',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              Required Skills: <strong style={{ color: 'var(--text-primary)' }} className="tabular-nums">{requiredSkills.length}</strong>
            </span>
            <span
              style={{
                backgroundColor: 'var(--bg-surface)',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              Preferred Skills: <strong style={{ color: 'var(--text-primary)' }} className="tabular-nums">{preferredSkills.length}</strong>
            </span>
          </div>

          {/* Empty skills extraction */}
          {requiredSkills.length === 0 && preferredSkills.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '1.5rem 1rem',
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
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
              <h4
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--danger)',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>Required Skills</span>
                <Badge variant="required" size="sm">
                  {requiredSkills.length}
                </Badge>
              </h4>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
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
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      transition: 'border-color var(--transition-fast)',
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
                            backgroundColor: 'var(--bg-elevated)',
                            padding: '0.125rem 0.375rem',
                            borderRadius: 'var(--radius-sm)',
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
                          lineHeight: 1.4,
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
              <h4
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--info)',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>Preferred Skills</span>
                <Badge variant="preferred" size="sm">
                  {preferredSkills.length}
                </Badge>
              </h4>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
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
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      transition: 'border-color var(--transition-fast)',
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
                            backgroundColor: 'var(--bg-elevated)',
                            padding: '0.125rem 0.375rem',
                            borderRadius: 'var(--radius-sm)',
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
                          lineHeight: 1.4,
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
