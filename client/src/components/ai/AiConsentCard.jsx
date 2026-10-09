import React, { useState } from 'react';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';
import { BorderBeam } from '@/components/ui/border-beam';
import { useTheme } from '../../hooks/useTheme.js';

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
 * @param {string} [props.secondaryButtonLabel]
 * @param {function} [props.onSecondarySubmit]
 */
export const AiConsentCard = ({
  type = 'resume-profile',
  onConsentSubmit,
  isLoading = false,
  buttonLabel,
  title,
  description,
  secondaryButtonLabel,
  onSecondarySubmit,
}) => {
  let currentTheme = 'light';
  try {
    const themeContext = useTheme();
    if (themeContext?.theme) {
      currentTheme = themeContext.theme;
    }
  } catch {
    // Gracefully fallback if rendered outside ThemeProvider
  }

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

  const defaultButtonLabel =
    buttonLabel || (isResumeOnly ? 'Generate AI Profile' : 'Generate AI Comparison');

  const defaultSecondaryLabel =
    secondaryButtonLabel !== undefined
      ? secondaryButtonLabel
      : (!isResumeOnly && defaultButtonLabel !== 'Generate AI Recommendations'
          ? 'Generate AI Recommendations'
          : null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hasConsented || isLoading) return;
    onConsentSubmit({ consent: true });
  };

  const handleSecondaryClick = (e) => {
    e.preventDefault();
    if (!hasConsented || isLoading) return;
    if (onSecondarySubmit) {
      onSecondarySubmit({ consent: true });
    } else {
      window.dispatchEvent(
        new CustomEvent('trigger-ai-recommendations', { detail: { consent: true } })
      );
    }
  };

  const cardElement = (
    <div
      className="card"
      style={{
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        backgroundColor: 'var(--bg-card, rgb(23, 24, 26))',
        borderRadius: 'var(--radius-xl, 1.25rem)',
        padding: !isResumeOnly ? '2.5rem 2.75rem' : '1.25rem 1.5rem',
        boxShadow: !isResumeOnly ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: !isResumeOnly ? '1.35rem' : '0.95rem',
      }}
      data-testid="ai-consent-card"
    >
      {/* Header with Sparkles Icon Box */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
        <div
          style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: '0.65rem',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            color: 'var(--accent-primary, #818cf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.15rem', color: '#818cf8' }}>
            auto_awesome
          </span>
        </div>
        <div>
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 0.25rem 0',
              letterSpacing: '-0.01em',
            }}
            data-testid="ai-consent-title"
          >
            {title || defaultTitle}
          </h3>
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary, #94a3b8)',
              margin: 0,
              lineHeight: 1.5,
            }}
            data-testid="ai-consent-description"
          >
            {description || defaultDescription}
          </p>
        </div>
      </div>

      {/* Data Privacy Protection Pill Box */}
      <div
        style={{
          padding: '0.5rem 0.85rem',
          borderRadius: '0.5rem',
          backgroundColor: 'var(--bg-container-low, rgb(19, 19, 22))',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
          fontSize: '0.775rem',
          color: 'var(--text-secondary, #94a3b8)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          lineHeight: 1.4,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '1rem', color: '#818cf8', flexShrink: 0 }}
        >
          lock
        </span>
        <span>
          <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Data Privacy Protection:</strong>{' '}
          PII is redacted prior to external AI transmission. The authoritative deterministic scoring and matching engine operates independently.
        </span>
      </div>

      {/* Opt-in Checkbox & Action Buttons Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            cursor: 'pointer',
            fontSize: '0.825rem',
            color: 'var(--text-primary)',
            userSelect: 'none',
            fontWeight: 500,
          }}
          data-testid="ai-consent-label"
        >
          <input
            type="checkbox"
            checked={hasConsented}
            onChange={(e) => setHasConsented(e.target.checked)}
            disabled={isLoading}
            style={{
              width: '1.05rem',
              height: '1.05rem',
              cursor: 'pointer',
              accentColor: 'var(--accent-primary, #6366f1)',
              borderRadius: '4px',
            }}
            data-testid="ai-consent-checkbox"
          />
          <span>{checkboxLabel}</span>
        </label>

        {/* Buttons Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Primary Submit Button */}
          <Button
            type="submit"
            variant="primary"
            disabled={!hasConsented || isLoading}
            loading={isLoading}
            data-testid="ai-consent-submit-btn"
            style={{
              borderRadius: 'var(--radius-lg, 0.75rem)',
              padding: '0.45rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: (!hasConsented || isLoading) ? 'rgba(99, 102, 241, 0.4)' : 'var(--accent-primary, #6366f1)',
              border: 'none',
              color: '#ffffff',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
              auto_awesome
            </span>
            <span>{defaultButtonLabel}</span>
          </Button>

          {/* Secondary Action Button (when applicable) */}
          {defaultSecondaryLabel && (
            <button
              type="button"
              onClick={handleSecondaryClick}
              disabled={!hasConsented || isLoading}
              data-testid="ai-consent-secondary-btn"
              style={{
                borderRadius: 'var(--radius-lg, 0.75rem)',
                padding: '0.45rem 1rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: (!hasConsented || isLoading) ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: (!hasConsented || isLoading) ? 'not-allowed' : 'pointer',
                opacity: (!hasConsented || isLoading) ? 0.6 : 1,
                transition: 'all var(--transition-fast)',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '1rem', color: (!hasConsented || isLoading) ? 'var(--text-muted)' : '#818cf8' }}
              >
                lightbulb
              </span>
              <span>{defaultSecondaryLabel}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );

  if (!isResumeOnly) {
    return (
      <div style={{ padding: '6px', width: '100%', boxSizing: 'border-box' }}>
        <BorderBeam
          size="md"
          colorVariant="colorful"
          theme={currentTheme === 'dark' ? 'dark' : 'light'}
          borderRadius={20}
          style={{ width: '100%' }}
        >
          {cardElement}
        </BorderBeam>
      </div>
    );
  }

  return cardElement;
};

export default AiConsentCard;
