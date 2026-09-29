import React from 'react';

/**
 * Accessible inline loading spinner
 *
 * @param {object} props
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {string} [props.className='']
 * @param {string} [props.ariaLabel='Loading...']
 */
export const Spinner = ({ size = 'md', className = '', ariaLabel = 'Loading...' }) => {
  const sizeMap = {
    sm: { width: '0.875rem', height: '0.875rem', borderWidth: '1.5px' },
    md: { width: '1.25rem', height: '1.25rem', borderWidth: '2px' },
    lg: { width: '2rem', height: '2rem', borderWidth: '3px' },
  };

  const style = sizeMap[size] || sizeMap.md;

  return (
    <span
      className={`spinner ${className}`}
      style={style}
      role="status"
      aria-label={ariaLabel}
    />
  );
};

export default Spinner;
