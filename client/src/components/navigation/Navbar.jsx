import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';

/**
 * Top Navbar component
 * Sticky 64px frosted glass header with brand mark, user avatar, and logout trigger.
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

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  return (
    <header
      className="navbar"
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
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
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.4rem 0.5rem',
              }}
            >
              <Icon name="menu" size={18} ariaLabel="Menu" />
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
                background: 'var(--gradient-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
              }}
              aria-hidden="true"
            >
              <Icon name="sparkles" size={16} />
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 'var(--text-base)',
                  letterSpacing: '-0.025em',
                  color: 'var(--text-primary)',
                }}
              >
                Resume Analyzer
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.1rem 0.35rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--accent-muted)',
                  color: 'var(--border-focus)',
                  letterSpacing: '0.05em',
                }}
              >
                AI
              </span>
            </div>
          </NavLink>
        </div>

        {/* Authenticated User Identity & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* User Avatar Circle */}
              <div
                style={{
                  width: '2.125rem',
                  height: '2.125rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  color: 'var(--border-focus)',
                  boxShadow: 'var(--shadow-sm)',
                }}
                aria-hidden="true"
              >
                {getInitials(user.name)}
              </div>

              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    lineHeight: 1.2,
                  }}
                  data-testid="navbar-user-name"
                >
                  {user.name}
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    lineHeight: 1.2,
                    marginTop: '0.1rem',
                  }}
                  data-testid="navbar-user-email"
                >
                  {user.email}
                </span>
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
