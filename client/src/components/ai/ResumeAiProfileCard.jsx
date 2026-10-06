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
 * Resume AI Profile Card Component
 * Integrates Stage 2 AI-Powered Resume Understanding on ResumeDetailPage.
 *
 * @param {object} props
 * @param {string} props.resumeId - UUID of the target resume
 * @param {string} props.extractionStatus - 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'FAILED'
 */
export const ResumeAiProfileCard = ({ resumeId, extractionStatus }) => {
  const toast = useToast();

  const [aiProfile, setAiProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [isUncached, setIsUncached] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (extractionStatus !== 'COMPLETED') {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setIsStale(false);
      setIsUncached(false);

      const data = await aiApi.getResumeAiProfile(resumeId);
      setAiProfile(data);
    } catch (err) {
      if (err.status === 404) {
        if (err.code === 'AI_PROFILE_NOT_FOUND') {
          setIsUncached(true);
          setAiProfile(null);
        } else if (err.code === 'AI_PROFILE_STALE') {
          setIsStale(true);
          setAiProfile(null);
        } else {
          setError(err);
        }
      } else {
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [resumeId, extractionStatus]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleGenerate = async ({ forceRefresh = false } = {}) => {
    try {
      setIsGenerating(true);
      setError(null);

      const result = await aiApi.generateResumeAiProfile(resumeId, {
        consent: true,
        forceRefresh,
      });

      setAiProfile(result);
      setIsUncached(false);
      setIsStale(false);
      toast.success(
        result.cached
          ? 'Cached AI profile loaded.'
          : 'AI resume profile generated successfully.'
      );
    } catch (err) {
      setError(err);
      toast.error(err.message || 'Failed to generate AI profile.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 1. Guard: Text extraction not yet completed
  if (extractionStatus !== 'COMPLETED') {
    return (
      <div
        className="card"
        style={{
          border: '1px dashed var(--border-default)',
          backgroundColor: 'var(--bg-card)',
          padding: '1.5rem',
        }}
        data-testid="ai-profile-pending-notice"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
          <Icon name="lock" size={18} />
          <span style={{ fontSize: 'var(--text-sm)' }}>
            Document text extraction must complete before AI Resume Understanding can be generated.
          </span>
        </div>
      </div>
    );
  }

  // 2. Loading Skeleton
  if (isLoading || isGenerating) {
    return (
      <AiLoadingSkeleton
        message="Extracting professional profile and verifying evidence..."
        subtext="Scrubbing PII and grounding claims with Gemini AI."
      />
    );
  }

  // 3. Uncached Initial State: Display Consent Card
  if (isUncached && !aiProfile) {
    return (
      <div data-testid="ai-profile-uncached-section">
        {error && <AiErrorAlert error={error} onRetry={() => handleGenerate({ forceRefresh: false })} />}
        <AiConsentCard
          type="resume-profile"
          onConsentSubmit={() => handleGenerate({ forceRefresh: false })}
          isLoading={isGenerating}
          buttonLabel="Generate AI Profile"
        />
      </div>
    );
  }

  // 4. Stale Cache State
  if (isStale && !aiProfile) {
    return (
      <div
        className="card"
        style={{
          border: '1px solid var(--warning-border)',
          backgroundColor: 'var(--warning-bg)',
          padding: '1.5rem',
        }}
        data-testid="ai-profile-stale-card"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}>
              AI Profile Needs Regeneration
            </h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
              The resume text has changed since the last AI understanding profile was generated.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={() => handleGenerate({ forceRefresh: true })}
            data-testid="ai-profile-regenerate-stale-btn"
          >
            <Icon name="refresh" size={14} />
            <span>Regenerate Profile</span>
          </Button>
        </div>
      </div>
    );
  }

  // 5. Error State without profile
  if (error && !aiProfile) {
    return (
      <AiErrorAlert
        error={error}
        onRetry={() => handleGenerate({ forceRefresh: false })}
      />
    );
  }

  // 6. Render Active AI Profile
  const profile = aiProfile?.profile;
  const summary = profile?.professional_summary;
  const technicalSkills = profile?.technical_skills || [];
  const softSkills = profile?.soft_skills || [];
  const ambiguousItems = profile?.ambiguous_or_unclear_items || [];

  const cacheBadgeText = aiProfile?.version ? `Cached • v${aiProfile.version}` : 'Cached';

  return (
    <div className="card" data-testid="resume-ai-profile-card">
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
              <span>AI Resume Understanding</span>
            </h3>

            {aiProfile?.cached ? (
              <span
                className="badge"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-xs)',
                  padding: '0.15rem 0.5rem',
                }}
                data-testid="ai-profile-cached-badge"
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
                data-testid="ai-profile-live-badge"
              >
                Live Profile
              </span>
            )}
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Structured profile synthesized with Google Gemini AI and verified against verbatim document evidence.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => handleGenerate({ forceRefresh: true })}
          style={{ fontSize: 'var(--text-xs)' }}
          data-testid="ai-profile-regenerate-btn"
        >
          <Icon name="refresh" size={13} />
          <span>Regenerate</span>
        </Button>
      </div>

      {error && <AiErrorAlert error={error} onRetry={() => handleGenerate({ forceRefresh: true })} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Professional Summary Section */}
        {summary && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
            data-testid="ai-summary-section"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Professional Summary
              </h4>
              <VerificationBadge status={summary.verification_status} reason={summary.unverified_reason} />
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {summary.text}
            </p>

            <EvidenceSnippet snippet={summary.evidence_snippet} />
          </div>
        )}

        {/* Technical Competencies Section */}
        {technicalSkills.length > 0 && (
          <div data-testid="ai-technical-skills-section">
            <h4
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.75rem',
              }}
            >
              Extracted Technical Competencies ({technicalSkills.length})
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {technicalSkills.map((skill, idx) => (
                <div
                  key={`${skill.name}-${idx}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.3rem 0.625rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    fontSize: 'var(--text-xs)',
                  }}
                  data-testid="ai-skill-chip"
                >
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{skill.name}</span>
                  <VerificationBadge status={skill.verification_status} reason={skill.unverified_reason} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ambiguous Items Banner */}
        {ambiguousItems.length > 0 && (
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--warning-bg)',
              border: '1px solid var(--warning-border)',
            }}
            data-testid="ai-ambiguous-items-banner"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Icon name="warning" size={16} style={{ color: 'var(--warning)' }} />
              <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--warning)' }}>
                Ambiguous or Unverified Document Claims ({ambiguousItems.length})
              </strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              {ambiguousItems.map((item, idx) => (
                <li key={idx} style={{ marginBottom: '0.25rem' }}>
                  <strong>{item.category}:</strong> {item.claim} — {item.reason_for_ambiguity}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeAiProfileCard;
