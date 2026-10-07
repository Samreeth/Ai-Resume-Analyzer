import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { useTheme } from '../../hooks/useTheme.js';
import Button from '../common/Button.jsx';

/**
 * Top Navbar component
 * 56px header with breadcrumbs, quick search, notifications, theme toggle, and user session menu.
 *
 * @param {object} props
 * @param {function} [props.onToggleSidebar] - Optional sidebar toggle for mobile
 */
export const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
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

  // Determine page title for breadcrumb
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'Dashboard';
    if (path.includes('/resumes')) return 'Resumes';
    if (path.includes('/jobs')) return 'Jobs';
    if (path.includes('/analyses')) return 'Analyses';
    return 'Dashboard';
  };

  return (
    <header
      className="navbar"
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-surface)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: '3.75rem',
        transition: 'background-color var(--transition-normal), border-color var(--transition-normal)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '100%',
          padding: '0 1.5rem',
          maxWidth: '100%',
        }}
      >
        {/* Left: Mobile Toggle & Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.35rem',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              aria-label="Toggle navigation menu"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
                menu
              </span>
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Overview</span>
            <span style={{ color: 'var(--border-default)' }}>/</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{getPageTitle()}</span>
          </div>
        </div>

        {/* Right: Search, Notifications, User Details, Sign Out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Quick Search Bar */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
            className="navbar-search"
          >
            <span
              className="material-symbols-outlined"
              style={{
                position: 'absolute',
                left: '0.625rem',
                color: 'var(--text-muted)',
                fontSize: '1.125rem',
                pointerEvents: 'none',
              }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Search anything..."
              style={{
                height: '2rem',
                paddingLeft: '2rem',
                paddingRight: '2.5rem',
                width: '13rem',
                backgroundColor: 'var(--bg-container-low)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
            <kbd
              style={{
                position: 'absolute',
                right: '0.5rem',
                padding: '0.1rem 0.35rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-container)',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              ⌘K
            </kbd>
          </div>

          {/* Notification Bell */}
          <button
            type="button"
            style={{
              width: '2rem',
              height: '2rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              position: 'relative',
            }}
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
              notifications
            </span>
            <span
              style={{
                position: 'absolute',
                top: '0.35rem',
                right: '0.35rem',
                width: '0.375rem',
                height: '0.375rem',
                backgroundColor: 'var(--accent-primary)',
                borderRadius: 'var(--radius-full)',
              }}
            />
          </button>

          {/* Quick Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              width: '2rem',
              height: '2rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-container)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          <div
            style={{
              height: '1rem',
              width: '1px',
              backgroundColor: 'var(--border-subtle)',
            }}
          />

          {/* User Profile Info */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
                aria-hidden="true"
              >
                {getInitials(user.name)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                  data-testid="navbar-user-name"
                >
                  {user.name}
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                  }}
                  data-testid="navbar-user-email"
                >
                  {user.email}
                </span>
              </div>
            </div>
          )}

          {/* Sign Out Button */}
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
