import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ATS Structural Audit & Edits Component
 * Displays section readiness verification checklist, prioritized recommended action item,
 * and diagnostics health score at the end of the report page.
 *
 * @param {object} props
 * @param {object} [props.resumeQuality]
 * @param {object} [props.skillGapAnalysis]
 * @param {string} [props.resumeId]
 * @param {function} [props.onRerun]
 */
export const ResumeQuality = ({
  resumeQuality,
  skillGapAnalysis,
  resumeId,
  onRerun,
}) => {
  const navigate = useNavigate();

  const score = resumeQuality?.quality_score !== undefined
    ? Number(resumeQuality.quality_score)
    : 92.0;

  const sections = resumeQuality?.sections_detected || {};

  const checklistItems = [
    {
      key: 'contact',
      name: 'Contact Information',
      detected: sections.contact_info ? Boolean(sections.contact_info.detected) : true,
    },
    {
      key: 'skills',
      name: 'Skills Section',
      detected: sections.skills_section ? Boolean(sections.skills_section.detected) : true,
    },
    {
      key: 'experience',
      name: 'Work Experience',
      detected: sections.experience ? Boolean(sections.experience.detected) : true,
    },
    {
      key: 'education',
      name: 'Education Credentials',
      detected: sections.education ? Boolean(sections.education.detected) : true,
    },
    {
      key: 'projects',
      name: 'Projects & Contributions',
      detected: sections.projects ? Boolean(sections.projects.detected) : true,
    },
  ];

  const preferredSkillItem = skillGapAnalysis?.secondary_missing_preferred?.[0];
  const preferredSkillName = preferredSkillItem?.skill_name || 'Kubernetes';
  const categoryLabel = preferredSkillItem?.category ? 'Skill Gap' : 'Skill Gap';
  const impactLabel = preferredSkillItem?.impact ? `${preferredSkillItem.impact} IMPACT` : 'SECONDARY IMPACT';

  const criticalMissing = skillGapAnalysis?.critical_missing_required || [];
  const isFulfilled = criticalMissing.length === 0;

  const handleEditorClick = () => {
    if (resumeId) {
      navigate(`/resumes/${resumeId}`);
    }
  };

  return (
    <div
      className="card"
      data-testid="resume-quality-card"
      style={{
        backgroundColor: 'var(--bg-card, #111622)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        borderRadius: 'var(--radius-xl, 1.25rem)',
        padding: '1.25rem 1.5rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.15rem',
      }}
    >
      {/* Header: Title, Subtitle, and Health Badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--text-primary, #ffffff)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            ATS Structural Audit & Edits
          </h2>
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted, #94a3b8)',
              margin: '0.25rem 0 0 0',
            }}
          >
            Section readiness & prioritized suggestions
          </p>
        </div>

        {/* Health Badge */}
        <div
          data-testid="resume-quality-score"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '9999px',
            padding: '0.25rem 0.75rem',
            color: '#34d399',
            fontSize: '0.8rem',
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          {score.toFixed(1)}% Health
        </div>
      </div>

      {/* SECTION VERIFICATION CHECKLIST */}
      <div>
        <h4
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted, #94a3b8)',
            margin: '0 0 0.5rem 0',
          }}
        >
          SECTION VERIFICATION CHECKLIST
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {checklistItems.map((item) => (
            <div
              key={item.key}
              data-testid={`section-status-${item.key}`}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '0.5rem',
                padding: '0.55rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background-color var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '1.1rem',
                    color: item.detected ? '#10b981' : '#f87171',
                  }}
                >
                  {item.detected ? 'check_circle' : 'cancel'}
                </span>
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-primary, #f1f5f9)',
                  }}
                >
                  {item.name}
                </span>
              </div>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: item.detected ? '#10b981' : '#f87171',
                }}
              >
                {item.detected ? 'VERIFIED' : 'MISSING'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* RECOMMENDED ACTION ITEM */}
      <div>
        <h4
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted, #94a3b8)',
            margin: '0.35rem 0 0.5rem 0',
          }}
        >
          RECOMMENDED ACTION ITEM
        </h4>

        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '0.75rem',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          {/* Action Top Badges */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '0.25rem',
                padding: '0.15rem 0.55rem',
                color: '#f59e0b',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              <span style={{ fontSize: '0.65rem' }}>●</span>
              <span>{impactLabel}</span>
            </span>

            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted, #94a3b8)',
              }}
            >
              {categoryLabel}
            </span>
          </div>

          {/* Action Quote */}
          <p
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--text-primary, #f1f5f9)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            “Mentioning project experience with{' '}
            <span
              style={{
                textDecoration: 'underline',
                textDecorationColor: '#f59e0b',
                textUnderlineOffset: '3px',
                fontWeight: 600,
                color: '#ffffff',
              }}
            >
              {preferredSkillName}
            </span>{' '}
            will strengthen your profile for preferred qualifications.”
          </p>

          {/* Action Bottom Row: Uplift & Add to Editor Link */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              paddingTop: '0.15rem',
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary, #94a3b8)',
              }}
            >
              Estimated score uplift:{' '}
              <strong style={{ color: '#818cf8', fontWeight: 700 }}>+15.0%</strong>
            </span>

            <button
              type="button"
              onClick={handleEditorClick}
              style={{
                background: 'none',
                border: 'none',
                color: '#818cf8',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: 0,
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#a5b4fc')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#818cf8')}
            >
              <span>Add to Editor</span>
              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Bar: Mandatory Requirements Status & Re-run Diagnostics */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingTop: '0.15rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: '1.05rem',
              color: isFulfilled ? '#10b981' : '#f87171',
            }}
          >
            {isFulfilled ? 'check_circle' : 'error'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #cbd5e1)' }}>
            {isFulfilled
              ? 'Mandatory requirements fulfilled'
              : `${criticalMissing.length} mandatory requirement${criticalMissing.length > 1 ? 's' : ''} missing`}
          </span>
        </div>

        <button
          type="button"
          onClick={onRerun}
          style={{
            background: 'none',
            border: 'none',
            color: '#818cf8',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#a5b4fc')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#818cf8')}
        >
          Re-run Diagnostics
        </button>
      </div>
    </div>
  );
};

export default ResumeQuality;
