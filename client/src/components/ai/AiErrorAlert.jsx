import React from 'react';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Sanitized AI Error Alert Component
 * Maps backend HTTP and business error codes to user-friendly notifications.
 * Never leaks raw Gemini stack traces, credentials, or internal provider details.
 *
 * @param {object} props
 * @param {Error|object|string} props.error - Caught error object or message string
 * @param {function} [props.onRetry] - Optional retry handler
 * @param {string} [props.className='']
 */
export const AiErrorAlert = ({ error, onRetry, className = '' }) => {
  if (!error) return null;

  const status = error.status || (typeof error === 'object' ? error.status : null);
  const code = error.code || (typeof error === 'object' ? error.code : null);
  const rawMessage = typeof error === 'string' ? error : error.message || 'An unexpected error occurred.';

  let title = 'AI Operation Notice';
  let message = rawMessage;
  let isWarning = false;
  let canRetry = Boolean(onRetry);

  if (code === 'AI_CONSENT_REQUIRED' || status === 400) {
    title = 'Explicit Consent Required';
    message = 'Please check the consent box to authorize processing of this document with Gemini AI.';
    isWarning = true;
    canRetry = false;
  } else if (code === 'AI_RATE_LIMITED' || status === 429) {
    title = 'AI Rate Limit Exceeded';
    message = 'The AI provider rate limit has been temporarily reached. Please wait a moment before retrying.';
    isWarning = true;
  } else if (code === 'AI_SERVICE_UNAVAILABLE' || status === 503) {
    title = 'AI Service Unavailable';
    message = 'AI features are currently unavailable or disabled on this server. All deterministic scoring, skill matches, and core features remain fully operational.';
    isWarning = true;
    canRetry = false;
  } else if (code === 'GEMINI_TIMEOUT' || status === 504) {
    title = 'AI Operation Timed Out';
    message = 'The AI analysis took longer than expected and timed out. You may safely retry the request.';
  } else if (code === 'AI_MALFORMED_OUTPUT' || code === 'AI_SCHEMA_VALIDATION_FAILED' || status === 502) {
    title = 'AI Response Format Issue';
    message = 'The AI service returned an unparseable response. Your resume and deterministic scores remain safe. Please retry.';
  } else if (code === 'RESUME_NOT_READY' || status === 409) {
    title = 'Extraction In Progress';
    message = 'Resume text extraction is still in progress. Please wait until extraction completes, then try AI analysis again.';
    isWarning = true;
  } else if (code === 'RESUME_TEXT_TOO_SHORT' || status === 422) {
    title = 'Insufficient Document Text';
    message = 'Resume text contains fewer than 50 readable characters, which is insufficient for AI analysis.';
    canRetry = false;
  } else if (code === 'RESOURCE_NOT_FOUND' || (status === 404 && code === 'RESOURCE_NOT_FOUND')) {
    title = 'Resource Not Found';
    message = 'The requested resume or job description was not found, or you do not have permission to access it.';
    canRetry = false;
  }

  const borderColor = isWarning ? 'var(--warning-border)' : 'var(--danger-border)';
  const bgColor = isWarning ? 'var(--warning-bg)' : 'var(--danger-bg)';
  const iconColor = isWarning ? 'var(--warning)' : 'var(--danger)';

  return (
    <div
      className={`ai-error-alert ${className}`.trim()}
      style={{
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        marginBottom: '1rem',
      }}
      role="alert"
      data-testid="ai-error-alert"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ color: iconColor, marginTop: '0.1rem', flexShrink: 0 }}>
            <Icon name={isWarning ? 'warning' : 'alert'} size={18} />
          </div>
          <div>
            <h5
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: '0 0 0.25rem 0',
              }}
              data-testid="ai-error-title"
            >
              {title}
            </h5>
            <p
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: 1.45,
              }}
              data-testid="ai-error-message"
            >
              {message}
            </p>
          </div>
        </div>

        {canRetry && (
          <Button
            type="button"
            variant="secondary"
            onClick={onRetry}
            style={{ fontSize: 'var(--text-xs)', padding: '0.35rem 0.75rem', flexShrink: 0 }}
            data-testid="ai-error-retry-btn"
          >
            <Icon name="refresh" size={13} />
            <span>Retry</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default AiErrorAlert;
