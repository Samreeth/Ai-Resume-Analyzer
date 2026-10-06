import React, { useState } from 'react';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Context-Aware AI Consent Card Component
 * Requires explicit user opt-in before dispatching AI generation requests.
 *
 * @param {object} props
 * @param {'resume-profile'|'job-analysis'} [props.type='resume-profile'] - Context type
 * @param {function} props.onConsentSubmit - Callback invoked with { consent: true }
 * @param {boolean} [props.isLoading=false]
 * @param {string} [props.buttonLabel]
 * @param {string} [props.title]
 * @param {string} [props.description]
 */
export const AiConsentCard = ({
  type = 'resume-profile',
  onConsentSubmit,
  isLoading = false,
  buttonLabel,
  title,
  description,
}) => {
  const [hasConsented, setHasConsented] = useState(false);

  const isResumeOnly = type === 'resume-profile';

  const defaultTitle = isResumeOnly
    ? 'AI-Powered Resume Understanding'
    : 'Contextual AI Analysis & Recommendations';

  const defaultDescription = isResumeOnly
    ? 'Extract structured professional summaries, core technical competencies, and verified domain skills from your document using Google Gemini AI. Personal contact details (emails, phone numbers, postal codes, and addresses) are automatically scrubbed and redacted before processing.'
    : 'Analyze qualitative alignment between your resume and the job description using Google Gemini AI. Personal contact details are automatically redacted before transmission.';

  const checkboxLabel = isResumeOnly
    ? 'I consent to processing my resume text with Gemini AI for structured profile extraction.'
    : 'I consent to analyzing this resume and job description with Gemini AI for contextual evaluation.';

  const defaultButtonLabel = buttonLabel || (isResumeOnly ? 'Generate AI Profile' : 'Generate AI Analysis');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hasConsented || isLoading) return;
    onConsentSubmit({ consent: true });
  };

  return (
    <div
      className="card"
      style={{
        border: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-card)',
        padding: '1.5rem',
      }}
      data-testid="ai-consent-card"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', marginBottom: '1rem' }}>
        <div
          style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--accent-muted)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <Icon name="sparkles" size={20} />
        </div>
        <div>
          <h3
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 0.35rem 0',
            }}
            data-testid="ai-consent-title"
          >
            {title || defaultTitle}
          </h3>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1.5,
            }}
            data-testid="ai-consent-description"
          >
            {description || defaultDescription}
          </p>
        </div>
      </div>

      <div
        style={{
          padding: '0.875rem 1rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.25rem',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
        }}
      >
        <Icon name="lock" size={16} style={{ color: 'var(--accent-primary)' }} />
        <span>
          <strong>Data Privacy Protection:</strong> PII is redacted prior to external AI transmission. The authoritative deterministic scoring and matching engine operates independently.
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.625rem',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            userSelect: 'none',
          }}
          data-testid="ai-consent-label"
        >
          <input
            type="checkbox"
            checked={hasConsented}
            onChange={(e) => setHasConsented(e.target.checked)}
            disabled={isLoading}
            style={{
              marginTop: '0.15rem',
              cursor: 'pointer',
              accentColor: 'var(--accent-primary)',
            }}
            data-testid="ai-consent-checkbox"
          />
          <span style={{ lineHeight: 1.4 }}>{checkboxLabel}</span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Button
            type="submit"
            variant="primary"
            disabled={!hasConsented || isLoading}
            loading={isLoading}
            data-testid="ai-consent-submit-btn"
          >
            <Icon name="sparkles" size={15} />
            <span>{defaultButtonLabel}</span>
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AiConsentCard;
