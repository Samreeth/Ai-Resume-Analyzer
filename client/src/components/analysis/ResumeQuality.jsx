import React from 'react';
import Badge from '../common/Badge.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Resume Structural and Formatting Quality Diagnostics Component
 *
 * @param {object} props
 * @param {object} [props.resumeQuality]
 */
export const ResumeQuality = ({ resumeQuality }) => {
  if (!resumeQuality || resumeQuality.status === 'UNAVAILABLE') {
    return (
      <div className="card" data-testid="resume-quality-card">
        <h3 className="card-title" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Icon name="file" size={18} style={{ color: 'var(--accent-primary)' }} />
          <span>Resume Quality Diagnostics</span>
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
          {resumeQuality?.reason || 'Resume structural diagnostics are unavailable for this record.'}
        </p>
      </div>
    );
  }

  const sections = resumeQuality.sections_detected || {};
  const metrics = resumeQuality.formatting_metrics || {};
  const score = Number(resumeQuality.quality_score) || 0;

  const sectionItems = [
    { key: 'contact', name: 'Contact Information', data: sections.contact_info },
    { key: 'skills', name: 'Skills Section', data: sections.skills_section },
    { key: 'experience', name: 'Experience / History', data: sections.experience },
    { key: 'education', name: 'Education', data: sections.education },
    { key: 'projects', name: 'Projects', data: sections.projects },
  ];

  return (
    <div className="card" data-testid="resume-quality-card">
      <div
        className="card-header"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="sparkles" size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>Resume Structural Quality</span>
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Deterministic evaluation of section presence, formatting, and impact metrics
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.35rem',
              backgroundColor: 'var(--bg-surface)',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
            }}
            data-testid="resume-quality-score"
          >
            <span
              className="tabular-nums"
              style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}
            >
              {score.toFixed(0)}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>/ 100</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Section Presence Audit */}
        <div>
          <h4
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              marginBottom: '0.75rem',
            }}
          >
            Essential Sections Detected
          </h4>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {sectionItems.map((item) => {
              const detected = Boolean(item.data?.detected);
              return (
                <div
                  key={item.key}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  data-testid={`section-status-${item.key}`}
                >
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {item.name}
                  </span>
                  <Badge
                    variant={detected ? 'matched' : 'missing'}
                    icon={detected ? <Icon name="check" size={12} /> : <Icon name="close" size={12} />}
                  >
                    {detected ? 'Detected' : 'Missing'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Formatting & Impact Metrics */}
        <div>
          <h4
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              marginBottom: '0.75rem',
            }}
          >
            Formatting & Impact Metrics
          </h4>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem 1rem',
              }}
            >
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Word Count</div>
              <div
                className="tabular-nums"
                style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}
              >
                {metrics.word_count ?? '—'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Status: {metrics.word_count_status || 'OPTIMAL'}
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem 1rem',
              }}
            >
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Bullet Points</div>
              <div
                className="tabular-nums"
                style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}
              >
                {metrics.bullet_points_count ?? 0}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Concise scannability
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem 1rem',
              }}
            >
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Action Verbs</div>
              <div
                className="tabular-nums"
                style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}
              >
                {metrics.action_verbs_count ?? 0}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Strong engineering verbs
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem 1rem',
              }}
            >
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Quantifiable Metrics</div>
              <div
                className="tabular-nums"
                style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}
              >
                {metrics.quantifiable_metrics_count ?? 0}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Measurable business impact
              </div>
            </div>
          </div>
        </div>

        {/* Strengths & Deductions if present */}
        {((resumeQuality.strengths && resumeQuality.strengths.length > 0) ||
          (resumeQuality.deductions && resumeQuality.deductions.length > 0)) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {resumeQuality.strengths && resumeQuality.strengths.length > 0 && (
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <h5
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--success)',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Icon name="check" size={14} />
                  <span>Identified Strengths</span>
                </h5>
                <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {resumeQuality.strengths.map((str, idx) => (
                    <li key={idx} style={{ marginBottom: '0.35rem', lineHeight: 1.5 }}>
                      {str}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resumeQuality.deductions && resumeQuality.deductions.length > 0 && (
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <h5
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--warning)',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Icon name="warning" size={14} />
                  <span>Quality Deductions</span>
                </h5>
                <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {resumeQuality.deductions.map((ded, idx) => (
                    <li key={idx} style={{ marginBottom: '0.35rem', lineHeight: 1.5 }}>
                      <strong>-{ded.deduction} pts:</strong> {ded.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeQuality;
