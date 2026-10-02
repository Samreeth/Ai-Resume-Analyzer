import React from 'react';

/**
 * Reusable Semantic Badge / Tag Component
 *
 * @param {object} props
 * @param {'pending'|'processing'|'completed'|'failed'|'high'|'medium'|'low'|'required'|'preferred'|'matched'|'missing'|'brand'|'neutral'} [props.variant='neutral']
 * @param {'sm'|'md'} [props.size='md']
 * @param {React.ReactNode} [props.icon]
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 * @param {object} [props.style]
 */
export const Badge = ({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  className = '',
  style = {},
  ...rest
}) => {
  const variantClass = `badge-${variant}`;
  const sizeClass = size === 'sm' ? 'badge-sm' : '';

  return (
    <span
      className={`badge ${variantClass} ${sizeClass} ${className}`.trim()}
      style={style}
      {...rest}
    >
      {icon && <span className="badge-icon" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export default Badge;
