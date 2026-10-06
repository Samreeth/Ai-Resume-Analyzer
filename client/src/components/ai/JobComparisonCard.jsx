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
 * Job Comparison Card Component
 * Integrates Stage 3/3.1 AI-Powered Job-to-Resume Comparison on AnalysisDetailPage.
 * Preserves independent loading/error/cache lifecycle.
 *
 * @param {object} props
 * @param {string} props.resumeId - UUID of the candidate resume
 * @param {string} props.jobId - UUID of the target job description
 */
export const JobComparisonCard = ({ resumeId, jobId }) => {
  const toast = useToast();

  const [comparisonData, setComparisonData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [isUncached, setIsUncached] = useState(false);

  const fetchComparison = useCallback(async () => {
    if (!resumeId || !jobId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setIsStale(false);
      setIsUncached(false);

      const data = await aiApi.getJobComparison(resumeId, jobId);
      setComparisonData(data);
    } catch (err) {
      if (err.status === 404) {
        if (err.code === 'AI_COMPARISON_NOT_FOUND') {
          setIsUncached(true);
          setComparisonData(null);
        } else if (err.code === 'AI_COMPARISON_STALE') {
          setIsStale(true);
          setComparisonData(null);
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
    fetchComparison();
  }, [fetchComparison]);

  const handleGenerate = async ({ forceRefresh = false } = {}) => {
    try {
      setIsGenerating(true);
      setError(null);

      const result = await aiApi.generateJobComparison(resumeId, {
        jobId,
        consent: true,
        forceRefresh,
      });

      setComparisonData(result);
      setIsUncached(false);
      setIsStale(false);
      toast.success(
        result.cached
          ? 'Cached AI job comparison loaded.'
          : 'AI contextual job comparison generated successfully.'
      );
    } catch (err) {
      setError(err);
      toast.error(err.message || 'Failed to generate AI job comparison.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 1. Loading Skeleton
  if (isLoading || isGenerating) {
    return (
      <AiLoadingSkeleton
        message="Comparing resume qualifications against job requirements..."
        subtext="Evaluating contextual fit, grounding claims, and matching evidence with Gemini AI."
      />
    );
  }

  // 2. Uncached Initial State: Display Consent Card
  if (isUncached && !comparisonData) {
    return (
      <div data-testid="job-comparison-uncached-section">
        {error && <AiErrorAlert error={error} onRetry={() => handleGenerate({ forceRefresh: false })} />}
        <AiConsentCard
          type="job-analysis"
          onConsentSubmit={() => handleGenerate({ forceRefresh: false })}
          isLoading={isGenerating}
          buttonLabel="Generate AI Comparison"
        />
      </div>
    );
  }

  // 3. Stale Cache State
  if (isStale && !comparisonData) {
    return (
      <div
        className="card"
        style={{
          border: '1px solid var(--warning-border)',
          backgroundColor: 'var(--warning-bg)',
          padding: '1.5rem',
        }}
        data-testid="job-comparison-stale-card"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}>
              AI Job Comparison Needs Regeneration
            </h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
              The resume or job description has changed since this contextual comparison was generated.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={() => handleGenerate({ forceRefresh: true })}
            data-testid="job-comparison-regenerate-stale-btn"
          >
            <Icon name="refresh" size={14} />
            <span>Regenerate Comparison</span>
          </Button>
        </div>
      </div>
    );
  }

  // 4. Error State without comparison data
  if (error && !comparisonData) {
    return (
      <AiErrorAlert
        error={error}
        onRetry={() => handleGenerate({ forceRefresh: false })}
      />
    );
  }

  // 5. Render Active Job Comparison
  const comparison = comparisonData?.comparison;
  const overallContext = comparison?.overall_context;
  const strengths = comparison?.strengths || [];
  const gaps = comparison?.gaps || [];
  const requirementAnalysis = comparison?.requirement_analysis || [];
  const transferable = comparison?.transferable_experience || [];
  const recommendations = comparison?.recommendations || [];

  const cacheBadgeText = comparisonData?.version ? `Cached • v${comparisonData.version}` : 'Cached';

  return (
    <div className="card" data-testid="job-comparison-card">
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
              <span>AI Contextual Fit Analysis</span>
            </h3>

            {comparisonData?.cached ? (
              <span
                className="badge"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-xs)',
                  padding: '0.15rem 0.5rem',
                }}
                data-testid="ai-comparison-cached-badge"
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
                data-testid="ai-comparison-live-badge"
              >
                Live Analysis
              </span>
            )}
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Qualitative contextual fit evaluated with Gemini AI. Deterministic scores remain authoritative.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => handleGenerate({ forceRefresh: true })}
          style={{ fontSize: 'var(--text-xs)' }}
          data-testid="ai-comparison-regenerate-btn"
        >
          <Icon name="refresh" size={13} />
          <span>Regenerate</span>
        </Button>
      </div>

      {error && <AiErrorAlert error={error} onRetry={() => handleGenerate({ forceRefresh: true })} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Overall Contextual Summary */}
        {overallContext && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
            data-testid="ai-comparison-context"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.625rem' }}>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Contextual Evaluation Summary
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ProvenanceBadge sourceType={overallContext.source_type} />
                <VerificationBadge status={overallContext.verification_status} reason={overallContext.unverified_reason} />
              </div>
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {overallContext.summary}
            </p>

            <EvidenceSnippet snippet={overallContext.evidence_snippet} />
          </div>
        )}

        {/* Strengths & Gaps 2-Column Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {/* Candidate Strengths */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
            data-testid="ai-comparison-strengths"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
              <Icon name="check-circle" size={16} style={{ color: 'var(--success)' }} />
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Candidate Strengths ({strengths.length})
              </h4>
            </div>

            {strengths.length === 0 ? (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                No specific contextual strengths noted.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {strengths.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                    data-testid="ai-strength-item"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {item.claim}
                      </span>
                      <VerificationBadge status={item.verification_status} reason={item.unverified_reason} />
                    </div>
                    <div style={{ marginTop: '0.35rem' }}>
                      <ProvenanceBadge sourceType={item.source_type} />
                    </div>
                    <EvidenceSnippet snippet={item.evidence_snippet} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Candidate Gaps */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
            data-testid="ai-comparison-gaps"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
              <Icon name="alert" size={16} style={{ color: 'var(--warning)' }} />
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Contextual Gaps ({gaps.length})
              </h4>
            </div>

            {gaps.length === 0 ? (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                No significant gaps identified against requirements.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {gaps.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                    data-testid="ai-gap-item"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {item.claim}
                      </span>
                      <VerificationBadge status={item.verification_status} reason={item.unverified_reason} />
                    </div>
                    <div style={{ marginTop: '0.35rem' }}>
                      <ProvenanceBadge sourceType={item.source_type} />
                    </div>
                    <EvidenceSnippet snippet={item.evidence_snippet} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detailed Requirement Analysis */}
        {requirementAnalysis.length > 0 && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
            data-testid="ai-comparison-requirements"
          >
            <h4
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '1rem',
              }}
            >
              Role Requirement Analysis ({requirementAnalysis.length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {requirementAnalysis.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.875rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                  }}
                  data-testid="ai-requirement-item"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        {item.requirement}
                      </strong>
                      <span
                        className="badge"
                        style={{
                          fontSize: 'var(--text-xs)',
                          backgroundColor:
                            item.match_type === 'EXACT_MATCH'
                              ? 'var(--success-bg)'
                              : item.match_type === 'ADJACENT'
                                ? 'var(--info-bg)'
                                : 'var(--bg-elevated)',
                          color:
                            item.match_type === 'EXACT_MATCH'
                              ? 'var(--success)'
                              : item.match_type === 'ADJACENT'
                                ? 'var(--info)'
                                : 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {item.match_type || 'NO_EVIDENCE'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ProvenanceBadge sourceType={item.source_type} />
                      <VerificationBadge status={item.verification_status} reason={item.unverified_reason} />
                    </div>
                  </div>

                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    {item.context}
                  </p>

                  <EvidenceSnippet snippet={item.evidence_snippet} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transferable Experience */}
        {transferable.length > 0 && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
            data-testid="ai-comparison-transferable"
          >
            <h4
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.75rem',
              }}
            >
              Transferable Experience ({transferable.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {transferable.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                  data-testid="ai-transferable-item"
                >
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                    {item.claim}
                  </span>
                  <VerificationBadge status={item.verification_status} reason={item.unverified_reason} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comparison Qualitative Recommendations */}
        {recommendations.length > 0 && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
            data-testid="ai-comparison-recommendations"
          >
            <h4
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.75rem',
              }}
            >
              Contextual Action Items ({recommendations.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recommendations.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                  }}
                  data-testid="ai-comparison-recommendation-item"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                      {item.recommendation}
                    </strong>
                    <VerificationBadge status={item.verification_status} reason={item.unverified_reason} />
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                    {item.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobComparisonCard;
