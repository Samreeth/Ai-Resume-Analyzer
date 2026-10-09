import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';

/**
 * Login Page
 * Validates credentials client-side and authenticates via AuthContext / POST /api/auth/login.
 */
export const LoginPage = () => {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const nextErrors = {};
    const emailTrimmed = formData.email.trim();

    if (!emailTrimmed) {
      nextErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      nextErrors.email = 'Invalid email address format';
    }

    if (!formData.password) {
      nextErrors.password = 'Password is required';
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
      await login(formData.email.trim().toLowerCase(), formData.password);
      toast.success('Welcome back!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="card auth-card"
      style={{
        padding: '2rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Sign In
        </h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Access your resumes, job descriptions, and matching reports
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
          data-testid="login-error-alert"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
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
          placeholder="••••••••"
          autoComplete="current-password"
          required
          disabled={submitting}
        />

        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          disabled={submitting}
          style={{
            width: '100%',
            marginTop: '0.75rem',
            borderRadius: 'var(--radius-full)',
            padding: '0.625rem 1.25rem',
            fontWeight: 600,
          }}
          data-testid="login-submit-btn"
        >
          Sign In
        </Button>
      </form>

      <div
        style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
        }}
      >
        Don't have an account?{' '}
        <Link to="/register" style={{ fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }}>
          Create an account
        </Link>
      </div>
    </div>
  );
};

export default LoginPage;
