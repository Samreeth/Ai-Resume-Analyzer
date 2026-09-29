import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import Button from '../common/Button.jsx';

/**
 * Top Navbar component
 * Displays application identity, current user identity, and logout trigger.
 *
 * @param {object} props
 * @param {function} [props.onToggleSidebar] - Optional sidebar toggle for mobile
 */
export const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      toast.info('You have been logged out.');
      navigate('/login');
    } catch (_) {
      // Non-blocking logout error
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header
      className="navbar"
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-secondary)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '4rem',
        }}
      >
        {/* Brand Identity & Sidebar Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="btn btn-secondary btn-sm"
              aria-label="Toggle navigation menu"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.375rem 0.5rem' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          )}

          <NavLink
            to="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              color: 'var(--text-primary)',
              textDecoration: 'none',
            }}
          >
            <span
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--gradient-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 'var(--text-sm)',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
              }}
              aria-hidden="true"
            >
              AI
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: 'var(--text-base)',
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              Resume Analyzer
            </span>
          </NavLink>
        </div>

        {/* Authenticated User Identity & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user && (
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                }}
                data-testid="navbar-user-name"
              >
                {user.name}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  lineHeight: 1.2,
                }}
                data-testid="navbar-user-email"
              >
                {user.email}
              </div>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleLogout}
            loading={loggingOut}
            ariaLabel="Log out of application"
            data-testid="navbar-logout-btn"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
