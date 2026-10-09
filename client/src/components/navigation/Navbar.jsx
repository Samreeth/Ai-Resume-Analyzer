import React from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useTheme } from '../../hooks/useTheme.js';

/**
 * Top Navbar component
 * Curved floating SaaS header matching the reference design.
 *
 * @param {object} props
 * @param {function} [props.onToggleSidebar] - Optional sidebar toggle for mobile
 */
export const Navbar = ({ onToggleSidebar }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const getInitials = (name) => {
    if (!name) return 'P';
    const clean = name.trim();
    if (!clean) return 'P';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return clean[0].toUpperCase();
  };

  return (
    <header
      className="navbar"
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: '1.125rem',
        backgroundColor: 'var(--bg-card, rgb(23, 24, 26))',
        height: '3.75rem',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        transition: 'background-color var(--transition-normal), border-color var(--transition-normal)',
      }}
    >
      {/* Left: Mobile Drawer Trigger & Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, maxWidth: '440px' }}>
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="navbar-mobile-toggle"
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.4rem',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.625rem',
              backgroundColor: 'var(--bg-container-low)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Toggle navigation menu"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
              menu
            </span>
          </button>
        )}

        {/* Global Quick Search Bar */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
          }}
          className="navbar-search"
        >
          <span
            className="material-symbols-outlined"
            style={{
              position: 'absolute',
              left: '0.75rem',
              color: 'var(--text-muted, #64748b)',
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
              width: '100%',
              height: '2.25rem',
              paddingLeft: '2.35rem',
              paddingRight: '2.5rem',
              backgroundColor: 'var(--bg-container-low, rgb(19, 19, 22))',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              borderRadius: '0.625rem',
              fontSize: '0.8125rem',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle, rgba(255, 255, 255, 0.08))';
            }}
          />

          <kbd
            className="navbar-search-kbd"
            style={{
              position: 'absolute',
              right: '0.625rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.125rem 0.375rem',
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--text-muted, #64748b)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '0.35rem',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              fontFamily: 'inherit',
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Notifications, Theme Switcher, and User Profile Details */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Notification Bell */}
        <button
          type="button"
          style={{
            width: '2.125rem',
            height: '2.125rem',
            borderRadius: '0.625rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-container-low)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary, #94a3b8)',
            cursor: 'pointer',
            transition: 'border-color var(--transition-fast), color var(--transition-fast)',
          }}
          aria-label="Notifications"
          title="Notifications"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>
            notifications
          </span>
        </button>

        {/* Theme Switcher Button (Sun in Dark Mode) */}
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            width: '2.125rem',
            height: '2.125rem',
            borderRadius: '0.625rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-container-low)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary, #94a3b8)',
            cursor: 'pointer',
            transition: 'border-color var(--transition-fast), color var(--transition-fast)',
          }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* User Identity: Avatar + Name & Email */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginLeft: '0.25rem' }}>
          {/* Avatar initial circle */}
          <div
            style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-primary, #6366f1)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8125rem',
              fontWeight: 700,
              flexShrink: 0,
              letterSpacing: '0.02em',
            }}
          >
            {getInitials(user?.name)}
          </div>

          <div className="navbar-user-text" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-primary, #ffffff)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              data-testid="navbar-user-name"
            >
              {user?.name || 'Pranav'}
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted, #64748b)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              data-testid="navbar-user-email"
            >
              {user?.email || 'p@gmail.com'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
