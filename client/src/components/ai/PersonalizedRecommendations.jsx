import React, { useState, useEffect, useCallback } from 'react';
import aiApi from '../../api/ai.api.js';
import { useToast } from '../../hooks/useToast.js';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';
import ProvenanceBadge from './ProvenanceBadge.jsx';
import VerificationBadge from './VerificationBadge.jsx';
import EvidenceSnippet from './EvidenceSnippet.jsx';
import AiConsentCard from './AiConsentCard.jsx';
import AiLoadingSkeleton from './AiLoadingSkeleton.jsx';
import AiErrorAlert from './AiErrorAlert.jsx';

/**
 * Personalized Recommendations Component
 * Integrates Stage 4 Personalized AI Recommendations on AnalysisDetailPage.
 * Preserves independent loading/error/cache lifecycle and deterministic engine authority.
 *
 * @param {object} props
 * @param {string} props.resumeId - UUID of the candidate resume
 * @param {string} props.jobId - UUID of the target job description
 */
export const PersonalizedRecommendations = ({ resumeId, jobId }) => {
  const toast = useToast();

  const [recommendationsData, setRecommendationsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [isUncached, setIsUncached] = useState(false);
  const [filterCategory, setFilterCategory] = useState('ALL');

  const fetchRecommendations = useCallback(async () => {
    if (!resumeId || !jobId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setIsStale(false);
      setIsUncached(false);

      const data = await aiApi.getAiRecommendations(resumeId, jobId);
      setRecommendationsData(data);
    } catch (err) {
      if (err.status === 404) {
        if (err.code === 'AI_RECOMMENDATIONS_NOT_FOUND') {
          setIsUncached(true);
          setRecommendationsData(null);
        } else if (err.code === 'AI_RECOMMENDATIONS_STALE') {
          setIsStale(true);
          setRecommendationsData(null);
        } else {
          setError(err);
        }
      } else {
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [resumeId, jobId]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleGenerate = async ({ forceRefresh = false } = {}) => {
    try {
      setIsGenerating(true);
      setError(null);

      const result = await aiApi.generateAiRecommendations(resumeId, {
        jobId,
        consent: true,
        forceRefresh,
      });

      setRecommendationsData(result);
      setIsUncached(false);
      setIsStale(false);
      toast.success(
        result.cached
          ? 'Cached AI recommendations loaded.'
          : 'Personalized AI recommendations generated successfully.'
      );
    } catch (err) {
      setError(err);
      toast.error(err.message || 'Failed to generate AI recommendations.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 1. Loading Skeleton
  if (isLoading || isGenerating) {
    return (
      <AiLoadingSkeleton
        message="Synthesizing personalized resume positioning strategy..."
        subtext="Aligning strengths, addressing gaps, and grounding recommendations with Gemini AI."
      />
    );
  }

  // 2. Uncached Initial State: Display Consent Card
  if (isUncached && !recommendationsData) {
    return (
      <div data-testid="ai-recommendations-uncached-section">
        {error && <AiErrorAlert error={error} onRetry={() => handleGenerate({ forceRefresh: false })} />}
        <AiConsentCard
          type="job-analysis"
          onConsentSubmit={() => handleGenerate({ forceRefresh: false })}
          isLoading={isGenerating}
          buttonLabel="Generate AI Recommendations"
        />
      </div>
    );
  }

  // 3. Stale Cache State
  if (isStale && !recommendationsData) {
    return (
      <div
        className="card"
        style={{
          border: '1px solid var(--warning-border)',
          backgroundColor: 'var(--warning-bg)',
          padding: '1.5rem',
        }}
        data-testid="ai-recommendations-stale-card"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}>
              AI Recommendations Need Regeneration
            </h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
              The resume or job description has changed since these personalized recommendations were generated.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={() => handleGenerate({ forceRefresh: true })}
            data-testid="ai-recommendations-regenerate-stale-btn"
          >
            <Icon name="refresh" size={14} />
            <span>Regenerate Recommendations</span>
          </Button>
        </div>
      </div>
    );
  }

  // 4. Error State without recommendations data
  if (error && !recommendationsData) {
    return (
      <AiErrorAlert
        error={error}
        onRetry={() => handleGenerate({ forceRefresh: false })}
      />
    );
  }

  // 5. Render Active Recommendations
  const aiOutput = recommendationsData?.recommendations;
  const overallStrategy = aiOutput?.overall_strategy;
  const rawList = aiOutput?.recommendations || [];

  const filteredList = rawList.filter((item) => {
    if (filterCategory === 'ALL') return true;
    return item.category === filterCategory;
  });

  const cacheBadgeText = recommendationsData?.version
    ? `Cached • v${recommendationsData.version}`
    : 'Cached';

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'HIGH':
        return {
          backgroundColor: 'var(--danger-bg)',
          color: 'var(--danger)',
          border: '1px solid var(--danger-border)',
        };
      case 'MEDIUM':
        return {
          backgroundColor: 'var(--warning-bg)',
          color: 'var(--warning)',
          border: '1px solid var(--warning-border)',
        };
      case 'LOW':
      default:
        return {
          backgroundColor: 'var(--bg-elevated)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border-subtle)',
        };
    }
  };

  return (
    <div className="card" data-testid="personalized-recommendations-card">
      {/* Header and Actions */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="sparkles" size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>Personalized AI Strategic Recommendations</span>
            </h3>

            {recommendationsData?.cached ? (
              <span
                className="badge"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-xs)',
                  padding: '0.15rem 0.5rem',
                }}
                data-testid="ai-recommendations-cached-badge"
              >
                {cacheBadgeText}
              </span>
            ) : (
              <span
                className="badge"
                style={{
                  backgroundColor: 'var(--success-bg)',
                  color: 'var(--success)',
                  border: '1px solid var(--success-border)',
                  fontSize: 'var(--text-xs)',
                  padding: '0.15rem 0.5rem',
                }}
                data-testid="ai-recommendations-live-badge"
              >
                Live Recommendations
              </span>
            )}
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Personalized strategy synthesized by Gemini AI. Deterministic skill gaps maintain authoritative priority.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => handleGenerate({ forceRefresh: true })}
          style={{ fontSize: 'var(--text-xs)' }}
          data-testid="ai-recommendations-regenerate-btn"
        >
          <Icon name="refresh" size={13} />
          <span>Regenerate</span>
        </Button>
      </div>

      {error && <AiErrorAlert error={error} onRetry={() => handleGenerate({ forceRefresh: true })} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Overall Positioning Strategy */}
        {overallStrategy && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
            data-testid="ai-strategy-section"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.625rem' }}>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Overall Positioning Strategy
              </h4>
              <VerificationBadge
                status={overallStrategy.verification_status}
                reason={overallStrategy.unverified_reason}
              />
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {overallStrategy.summary}
            </p>
          </div>
        )}

        {/* Category Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginRight: '0.25rem' }}>
            Filter by:
          </span>
          {[
            { label: 'All Items', value: 'ALL' },
            { label: 'Skill Gaps', value: 'SKILL_GAP' },
            { label: 'Resume Strengths', value: 'RESUME_STRENGTH' },
            { label: 'Role Requirements', value: 'JOB_REQUIREMENT' },
          ].map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setFilterCategory(cat.value)}
              style={{
                background: filterCategory === cat.value ? 'var(--accent-muted)' : 'var(--bg-surface)',
                color: filterCategory === cat.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: filterCategory === cat.value ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-default)',
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              data-testid={`filter-${cat.value.toLowerCase()}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Actionable Recommendations List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} data-testid="ai-recommendations-list">
          {filteredList.length === 0 ? (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
              No recommendations found matching the selected category.
            </p>
          ) : (
            filteredList.map((item, idx) => {
              const isJobReq = item.category === 'JOB_REQUIREMENT';
              const isSkillGap = item.category === 'SKILL_GAP';

              return (
                <div
                  key={item.id || idx}
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                  data-testid="ai-recommendation-item"
                >
                  {/* Item Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '0.625rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-full)',
                          ...getPriorityStyle(item.priority),
                        }}
                        data-testid="recommendation-priority-badge"
                      >
                        {item.priority} PRIORITY
                      </span>

                      <h4
                        style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          margin: 0,
                        }}
                      >
                        {item.title}
                      </h4>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ProvenanceBadge sourceType={item.source_type} />
                      <VerificationBadge
                        status={item.verification_status}
                        reason={item.unverified_reason}
                      />
                    </div>
                  </div>

                  {/* Recommendation Core Text */}
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-primary)',
                      lineHeight: 1.5,
                      marginBottom: '0.5rem',
                    }}
                  >
                    {item.recommendation}
                  </p>

                  {/* Rationale */}
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ color: 'var(--text-muted)' }}>Rationale: </strong>
                    {item.rationale}
                  </div>

                  {/* Job Requirement Employer Expectation Disclaimer */}
                  {isJobReq && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--info-bg)',
                        border: '1px solid var(--info-border)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--info)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                      data-testid="job-requirement-disclaimer"
                    >
                      <Icon name="briefcase" size={13} />
                      <span>
                        Identified from employer job description — does not indicate that the candidate possesses this skill.
                      </span>
                    </div>
                  )}

                  {/* Skill Gap Deterministic Lock Notice */}
                  {isSkillGap && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                      data-testid="skill-gap-authority-note"
                    >
                      <Icon name="lock" size={12} style={{ color: 'var(--accent-primary)' }} />
                      <span>Priority and gap severity authoritatively derived from deterministic skill engine.</span>
                    </div>
                  )}

                  {/* Evidence Snippet */}
                  <EvidenceSnippet snippet={item.evidence_snippet} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalizedRecommendations;
