import React from 'react';

/**
 * Reusable accessible Form Input component
 *
 * @param {object} props
 * @param {string} props.id - Input ID for label association
 * @param {string} props.label - Visible label text
 * @param {string} [props.name]
 * @param {string} [props.type='text']
 * @param {string|number} props.value
 * @param {function} props.onChange
 * @param {string} [props.placeholder]
 * @param {string} [props.error] - Validation error message
 * @param {string} [props.helperText] - Subordinate guidance text
 * @param {boolean} [props.required=false]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.autoComplete]
 * @param {string} [props.className='']
 */
export const Input = ({
  id,
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  error,
  helperText,
  required = false,
  disabled = false,
  autoComplete,
  className = '',
  ...rest
}) => {
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helperText ? `${id}-helper` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`form-group ${className}`.trim()}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
          {required && <span style={{ color: 'var(--danger)', marginLeft: '0.25rem' }}>*</span>}
        </label>
      )}

      <input
        id={id}
        name={name || id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`input-field ${error ? 'error' : ''}`.trim()}
        {...rest}
      />

      {error && (
        <span id={errorId} className="form-error" role="alert">
          {error}
        </span>
      )}

      {!error && helperText && (
        <span id={helperId} className="form-helper">
          {helperText}
        </span>
      )}
    </div>
  );
};

export default Input;
