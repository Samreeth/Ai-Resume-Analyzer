import React, { useState } from 'react';
import Button from '../common/Button.jsx';

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
    const statusBg = isMatched ? 'var(--success-bg)' : 'var(--danger-bg)';
    const statusBorder = isMatched ? 'var(--success-border)' : 'var(--danger-border)';
    const statusColor = isMatched ? 'var(--success)' : 'var(--danger)';

    return (
      <div
        key={skill.skill_id || skill.skill_name}
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
        data-testid={`skill-item-${skill.skill_id || skill.skill_name}`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {skill.skill_name}
            </span>
            {skill.category && (
              <span
                style={{
                  marginLeft: '0.5rem',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {skill.category}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isMatched && skill.similarity_score !== undefined && (
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                }}
              >
                Score: {Number(skill.similarity_score).toFixed(0)}%
              </span>
            )}
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: statusBg,
                borderColor: statusBorder,
                borderWidth: '1px',
                borderStyle: 'solid',
                color: statusColor,
              }}
            >
              {skill.status}
            </span>
          </div>
        </div>

        {/* Evidence quotation if available */}
        {skill.evidence && (
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
              margin: '0.25rem 0 0 0',
              fontStyle: 'italic',
              lineHeight: 1.4,
              backgroundColor: 'var(--bg-tertiary)',
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${isMatched ? 'var(--success)' : 'var(--border-muted)'}`,
            }}
          >
            "{skill.evidence}"
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="card" data-testid="skill-match-list">
      {/* Header and Filter Buttons */}
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
          <h3 className="card-title" style={{ margin: 0 }}>
            Skill Matching & Verification
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Deterministic pattern matches and evidence extracted from candidate resume against job requirements
          </p>
        </div>

        {/* Filter Toolbar */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            type="button"
            variant={statusFilter === 'ALL' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setStatusFilter('ALL')}
            data-testid="filter-all-skills"
          >
            All ({skills.length})
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'MATCHED' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setStatusFilter('MATCHED')}
            data-testid="filter-matched-skills"
          >
            Matched ({matchedSkills.length})
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'MISSING' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setStatusFilter('MISSING')}
            data-testid="filter-missing-skills"
          >
            Missing ({missingSkills.length})
          </Button>
        </div>
      </div>

      {skills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
          No skills were evaluated for this analysis.
        </div>
      ) : filteredSkills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
          No skills match the selected filter ({statusFilter.toLowerCase()}).
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Required Skills Section */}
          {requiredSkills.length > 0 && (
            <div data-testid="required-skills-group">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                <h4
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--danger)',
                    margin: 0,
                  }}
                >
                  Required Skills
                </h4>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    backgroundColor: 'var(--danger-bg)',
                    color: 'var(--danger)',
                    padding: '0.125rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                  }}
                >
                  {requiredSkills.length}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '0.875rem',
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                <h4
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--info)',
                    margin: 0,
                  }}
                >
                  Preferred Skills
                </h4>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    backgroundColor: 'var(--info-bg)',
                    color: 'var(--info)',
                    padding: '0.125rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                  }}
                >
                  {preferredSkills.length}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '0.875rem',
                }}
                data-testid="preferred-skills-container"
              >
                {preferredSkills.map(renderSkillItem)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SkillMatchList;
