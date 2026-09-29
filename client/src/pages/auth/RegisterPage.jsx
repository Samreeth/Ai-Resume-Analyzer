import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';

/**
 * Register Page
 * Validates candidate details client-side matching backend schemas and invokes POST /api/auth/register.
 */
export const RegisterPage = () => {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const nextErrors = {};
    const nameTrimmed = formData.name.trim();
    const emailTrimmed = formData.email.trim();

    if (!nameTrimmed) {
      nextErrors.name = 'Name is required';
    } else if (nameTrimmed.length < 2) {
      nextErrors.name = 'Name must be at least 2 characters';
    } else if (nameTrimmed.length > 100) {
      nextErrors.name = 'Name must be at most 100 characters';
    }

    if (!emailTrimmed) {
      nextErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      nextErrors.email = 'Invalid email address format';
    } else if (emailTrimmed.length > 255) {
      nextErrors.email = 'Email must be at most 255 characters';
    }

    if (!formData.password) {
      nextErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    } else if (formData.password.length > 128) {
      nextErrors.password = 'Password must be at most 128 characters';
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
    if (serverError) {
      setServerError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) {
      return;
    }

    try {
      setSubmitting(true);
      await register(formData.name.trim(), formData.email.trim().toLowerCase(), formData.password);
      toast.success('Registration successful! Please sign in with your new account.');
      navigate('/login', { replace: true });
    } catch (err) {
      const msg = err.message || 'Registration failed. Please try again.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Create an Account
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Get started with automated resume analysis and job matching
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            marginBottom: '1.25rem',
          }}
          data-testid="register-error-alert"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Input
          id="name"
          name="name"
          type="text"
          label="Full Name"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          placeholder="e.g. John Doe"
          autoComplete="name"
          required
          disabled={submitting}
        />

        <Input
          id="email"
          name="email"
          type="email"
          label="Email Address"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          placeholder="name@example.com"
          autoComplete="email"
          required
          disabled={submitting}
        />

        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          helperText="Must be at least 8 characters"
          placeholder="••••••••"
          autoComplete="new-password"
          required
          disabled={submitting}
        />

        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          disabled={submitting}
          style={{ width: '100%', marginTop: '0.5rem' }}
          data-testid="register-submit-btn"
        >
          Create Account
        </Button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
          Sign In
        </Link>
      </div>
    </div>
  );
};

export default RegisterPage;
