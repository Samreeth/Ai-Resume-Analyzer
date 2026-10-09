import React, { useState } from 'react';

/**
 * Itemized breakdown of evaluated skills grouped by requirement type and match status
 *
 * @param {object} props
 * @param {Array} props.skills
 */
export const SkillMatchList = ({ skills = [] }) => {
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'MATCHED' | 'MISSING'

  const matchedSkills = skills.filter((s) => s.status === 'MATCHED');
  const missingSkills = skills.filter((s) => s.status === 'MISSING');

  const filteredSkills = skills.filter((s) => {
    if (statusFilter === 'MATCHED') return s.status === 'MATCHED';
    if (statusFilter === 'MISSING') return s.status === 'MISSING';
    return true;
  });

  const requiredSkills = filteredSkills.filter(
    (s) => s.requirement_type === 'REQUIRED' || s.evidence?.startsWith('[REQUIRED]')
  );
  const preferredSkills = filteredSkills.filter(
    (s) => s.requirement_type === 'PREFERRED' || s.evidence?.startsWith('[PREFERRED]')
  );

  const renderSkillItem = (skill) => {
    const isMatched = skill.status === 'MATCHED';
    const similarity = skill.similarity_score !== undefined ? Number(skill.similarity_score) : (isMatched ? 100 : 0);

    return (
      <div
        key={skill.skill_id || skill.skill_name}
        style={{
          backgroundColor: 'var(--bg-container-low, rgb(19, 19, 22))',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.07))',
          borderLeft: `3px solid ${isMatched ? '#10b981' : '#ef4444'}`,
          borderRadius: 'var(--radius-lg, 0.75rem)',
          padding: '0.85rem 1.15rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '0.65rem',
          height: '100%',
          transition: 'border-color var(--transition-fast)',
        }}
        data-testid={`skill-item-${skill.skill_id || skill.skill_name}`}
      >
        {/* Top Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {skill.skill_name}
            </span>

            {skill.category && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary, #cbd5e1)',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  padding: '0.15rem 0.55rem',
                  borderRadius: 'var(--radius-sm, 0.25rem)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {skill.category}
              </span>
            )}

            <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Score:{' '}
              <strong
                className="tabular-nums"
                style={{
                  fontWeight: 700,
                  color: isMatched ? '#10b981' : '#f87171',
                }}
              >
                {similarity.toFixed(0)}%
              </strong>
            </span>
          </div>

          {/* Status Badge */}
          <div>
            {isMatched ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#34d399',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    display: 'inline-block',
                  }}
                  aria-hidden="true"
                />
                MATCHED
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#f87171',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    display: 'inline-block',
                  }}
                  aria-hidden="true"
                />
                MISSING
              </span>
            )}
          </div>
        </div>

        {/* Evidence quotation block */}
        {skill.evidence && (
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              borderLeft: `2.5px solid ${isMatched ? '#10b981' : '#ef4444'}`,
              borderRadius: '0.375rem',
              padding: '0.5rem 0.8rem',
              fontSize: '0.8rem',
              color: 'var(--text-secondary, #94a3b8)',
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            "{skill.evidence}"
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="card"
      data-testid="skill-match-list"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        borderRadius: 'var(--radius-xl, 1.25rem)',
        padding: '1.25rem 1.5rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.15rem',
      }}
    >
      {/* Header and Filter Buttons */}
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
            }}
          >
            Itemized Skill Verifications & Text Evidence
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', margin: '0.3rem 0 0 0' }}>
            Evidence extracted directly from parsed document records
          </p>
        </div>

        {/* Filter Pills Toolbar */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-container-low, rgb(19, 19, 22))',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            borderRadius: 'var(--radius-full)',
            padding: '0.2rem',
            gap: '0.25rem',
          }}
        >
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            data-testid="filter-all-skills"
            style={{
              backgroundColor: statusFilter === 'ALL' ? 'var(--accent-primary, #6366f1)' : 'transparent',
              color: statusFilter === 'ALL' ? '#ffffff' : 'var(--text-muted, #94a3b8)',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '0.35rem 0.85rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            All ({skills.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('MATCHED')}
            data-testid="filter-matched-skills"
            style={{
              backgroundColor: statusFilter === 'MATCHED' ? 'var(--accent-primary, #6366f1)' : 'transparent',
              color: statusFilter === 'MATCHED' ? '#ffffff' : 'var(--text-muted, #94a3b8)',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '0.35rem 0.85rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            Matched ({matchedSkills.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('MISSING')}
            data-testid="filter-missing-skills"
            style={{
              backgroundColor: statusFilter === 'MISSING' ? 'var(--accent-primary, #6366f1)' : 'transparent',
              color: statusFilter === 'MISSING' ? '#ffffff' : 'var(--text-muted, #94a3b8)',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '0.35rem 0.85rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            Missing ({missingSkills.length})
          </button>
        </div>
      </div>

      {skills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)' }}>
          No skills were evaluated for this analysis.
        </div>
      ) : filteredSkills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)' }}>
          No skills match the selected filter ({statusFilter.toLowerCase()}).
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Required Skills Section */}
          {requiredSkills.length > 0 && (
            <div data-testid="required-skills-group">
              {/* Category Divider Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  marginBottom: '0.65rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--accent-secondary, #818cf8)',
                    backgroundColor: 'rgba(99, 102, 241, 0.16)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    padding: '0.15rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  REQUIRED SKILLS (MANDATORY)
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle, rgba(255, 255, 255, 0.06))' }} />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
                  gap: '0.75rem',
                }}
                data-testid="required-skills-container"
              >
                {requiredSkills.map(renderSkillItem)}
              </div>
            </div>
          )}

          {/* Preferred Skills Section */}
          {preferredSkills.length > 0 && (
            <div data-testid="preferred-skills-group">
              {/* Category Divider Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  marginBottom: '0.65rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#fbbf24',
                    backgroundColor: 'rgba(245, 158, 11, 0.14)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    padding: '0.15rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  PREFERRED SKILLS (WEIGHTED BONUS)
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle, rgba(255, 255, 255, 0.06))' }} />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
                  gap: '0.75rem',
                }}
                data-testid="preferred-skills-container"
              >
                {preferredSkills.map(renderSkillItem)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card Footer */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
          paddingTop: '0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-muted, #94a3b8)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#10b981' }}>
            check_circle
          </span>
          <span>Strictly objective keyword pattern matching</span>
        </div>

        <div className="tabular-nums">
          {skills.length} of {skills.length} tags processed
        </div>
      </div>
    </div>
  );
};

export default SkillMatchList;
