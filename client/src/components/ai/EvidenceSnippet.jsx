import React from 'react';
import Icon from '../common/Icon.jsx';

/**
 * Evidence Snippet Component
 * Renders verbatim text quoted from the resume document with distinct grounded styling.
 * Never fabricates or renders empty snippets.
 *
 * @param {object} props
 * @param {string|null} props.snippet - Verbatim excerpt from resume text
 * @param {string} [props.label='Resume Evidence']
 * @param {string} [props.className='']
 */
export const EvidenceSnippet = ({ snippet, label = 'Resume Evidence', className = '' }) => {
  if (!snippet || typeof snippet !== 'string' || snippet.trim().length === 0) {
    return null;
  }

  return (
    <div
      className={`evidence-snippet-box ${className}`.trim()}
      style={{
        marginTop: '0.5rem',
        padding: '0.625rem 0.875rem',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderLeft: '3px solid var(--accent-primary)',
        fontSize: 'var(--text-xs)',
        lineHeight: 1.5,
      }}
      data-testid="evidence-snippet"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          color: 'var(--text-muted)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '10px',
          marginBottom: '0.25rem',
        }}
      >
        <Icon name="file" size={11} style={{ color: 'var(--accent-primary)' }} />
        <span>{label}</span>
      </div>
      <blockquote
        style={{
          margin: 0,
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
          fontFamily: 'var(--font-mono)',
          wordBreak: 'break-word',
        }}
      >
        &ldquo;{snippet.trim()}&rdquo;
      </blockquote>
    </div>
  );
};

export default EvidenceSnippet;
