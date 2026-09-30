import React, { useState, useEffect } from 'react';
import Input from '../common/Input.jsx';
import Button from '../common/Button.jsx';

/**
 * Reusable Job Description Form (for creation and editing)
 *
 * @param {object} props
 * @param {object} [props.initialValues={ title: '', description: '' }]
 * @param {function} props.onSubmit - ({ title, description }) => Promise
 * @param {function} [props.onCancel] - Cancel callback
 * @param {string} [props.submitLabel='Save Job Description']
 * @param {boolean} [props.isSubmitting=false]
 * @param {string} [props.error] - Optional server-level error message
 */
export const JobForm = ({
  initialValues = { title: '', description: '' },
  onSubmit,
  onCancel,
  submitLabel = 'Save Job Description',
  isSubmitting = false,
  error = '',
}) => {
  const [formData, setFormData] = useState({
    title: initialValues.title || '',
    description: initialValues.description || '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData({
      title: initialValues.title || '',
      description: initialValues.description || '',
    });
  }, [initialValues.title, initialValues.description]);

  const validate = () => {
    const nextErrors = {};
    const titleTrimmed = formData.title.trim();
    const descriptionTrimmed = formData.description.trim();

    if (!titleTrimmed) {
      nextErrors.title = 'Job title is required';
    } else if (titleTrimmed.length < 3) {
      nextErrors.title = 'Job title must be at least 3 characters';
    } else if (titleTrimmed.length > 255) {
      nextErrors.title = 'Job title cannot exceed 255 characters';
    }

    if (!descriptionTrimmed) {
      nextErrors.description = 'Job description is required';
    } else if (descriptionTrimmed.length < 20) {
      nextErrors.description = 'Job description must be at least 20 characters';
    } else if (descriptionTrimmed.length > 50000) {
      nextErrors.description = 'Job description cannot exceed 50,000 characters';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      title: formData.title.trim(),
      description: formData.description.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate data-testid="job-form">
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            marginBottom: '1.25rem',
          }}
          data-testid="job-form-server-error"
        >
          {error}
        </div>
      )}

      {/* Job Title Field */}
      <Input
        id="job-title"
        name="title"
        label="Job Title"
        value={formData.title}
        onChange={handleChange}
        error={errors.title}
        placeholder="e.g. Senior Full-Stack Engineer"
        required
        disabled={isSubmitting}
        helperText="Min 3, max 255 characters"
        data-testid="job-title-input"
      />

      {/* Job Description Field */}
      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="job-description" className="form-label">
          Job Description <span style={{ color: 'var(--danger)' }}>*</span>
        </label>
        <textarea
          id="job-description"
          name="description"
          rows={8}
          value={formData.description}
          onChange={handleChange}
          disabled={isSubmitting}
          placeholder="Paste or write the complete role overview, responsibilities, and required competencies..."
          className={`textarea-field ${errors.description ? 'error' : ''}`.trim()}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'job-desc-error' : 'job-desc-helper'}
          style={{
            resize: 'vertical',
            fontFamily: 'inherit',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.5,
          }}
          data-testid="job-description-input"
        />

        {errors.description && (
          <span id="job-desc-error" className="form-error" role="alert">
            {errors.description}
          </span>
        )}

        {!errors.description && (
          <div
            id="job-desc-helper"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginTop: '0.25rem',
            }}
          >
            <span>Min 20, max 50,000 characters</span>
            <span>{formData.description.trim().length} chars</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="job-form-cancel-btn"
          >
            Cancel
          </Button>
        )}

        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={isSubmitting}
          data-testid="job-form-submit-btn"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default JobForm;
