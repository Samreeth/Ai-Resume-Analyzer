import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useTheme } from '../hooks/useTheme.js';

export const AuthLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-canvas)',
        }}
      >
        <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        backgroundColor: 'var(--bg-canvas)',
        position: 'relative',
        transition: 'background-color var(--transition-normal), color var(--transition-normal)',
      }}
    >
      {/* Top Floating Theme Toggle */}
      <div style={{ position: 'absolute', top: '1.25rem', right: '1.5rem' }}>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle light or dark theme"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-xs)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Unified Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <div
              style={{
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
                auto_awesome
              </span>
            </div>
            <span
              style={{
                fontWeight: 700,
                fontSize: '1.35rem',
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              ResumeAI
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                padding: '0.125rem 0.45rem',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--bg-container)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              v2.4
            </span>
          </div>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              margin: '0.25rem 0 0',
            }}
          >
            Intelligent ATS Resume Screening & Role Matching Platform
          </p>
        </div>

        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
