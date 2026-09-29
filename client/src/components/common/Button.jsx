import React from 'react';
import Spinner from './Spinner.jsx';

/**
 * Reusable Button component adhering to design tokens and accessibility guidelines
 *
 * @param {object} props
 * @param {'primary'|'secondary'|'danger'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.loading=false]
 * @param {boolean} [props.disabled=false]
 * @param {'button'|'submit'|'reset'} [props.type='button']
 * @param {React.ReactNode} props.children
 * @param {function} [props.onClick]
 * @param {string} [props.className='']
 * @param {string} [props.ariaLabel]
 */
export const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  children,
  onClick,
  className = '',
  ariaLabel,
  ...rest
}) => {
  const sizeClass = size === 'sm' ? 'btn-sm' : '';
  const variantClass = `btn-${variant}`;
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      disabled={isDisabled}
      onClick={onClick}
      aria-disabled={isDisabled}
      aria-busy={loading}
      aria-label={ariaLabel}
      {...rest}
    >
      {loading && <Spinner size="sm" ariaLabel="Processing..." />}
      {children}
    </button>
  );
};

export default Button;
