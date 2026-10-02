import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Reusable Metric / Statistic Card for Dashboards and Overviews
 *
 * @param {object} props
 * @param {string} props.title - Metric title
 * @param {string|number} props.value - Primary numeric or string value
 * @param {React.ReactNode} [props.icon] - Visual icon or graphic
 * @param {string} [props.subtitle] - Supporting context
 * @param {string} [props.linkTo] - Navigation route
 * @param {string} [props.linkText] - Navigation link text
 * @param {string} [props.valueTestId] - data-testid for value element
 * @param {string} [props.dataTestId] - data-testid for card container
 * @param {string} [props.className='']
 */
export const StatCard = ({
  title,
  value,
  icon,
  subtitle,
  linkTo,
  linkText,
  valueTestId,
  dataTestId,
  className = '',
}) => {
  return (
    <div
      className={`card stat-card ${className}`.trim()}
      data-testid={dataTestId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '0.75rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </span>
        {icon && (
          <div
            style={{
              color: 'var(--accent-primary)',
              backgroundColor: 'var(--accent-muted)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div>
        <div
          style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
          data-testid={valueTestId}
        >
          {value}
        </div>

        {subtitle && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>
            {subtitle}
          </p>
        )}
      </div>

      {linkTo && linkText && (
        <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
          <Link
            to={linkTo}
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--accent-primary)',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'gap var(--transition-fast)',
            }}
          >
            <span>{linkText}</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      )}
    </div>
  );
};

export default StatCard;
