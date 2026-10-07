import React from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import { useTheme } from '../../hooks/useTheme.js';

/**
 * Sidebar navigation component
 * 240px fixed minimalist SaaS sidebar matching Stitch design with Light/Dark toggle.
 *
 * @param {object} props
 * @param {boolean} [props.isOpen=false] - For mobile drawer visibility
 * @param {function} [props.onClose] - Close mobile drawer callback
 */
export const Sidebar = ({ isOpen = false, onClose }) => {
  const { theme, setTheme } = useTheme();

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      iconSymbol: 'grid_view',
      iconFallback: 'dashboard',
    },
    {
      to: '/resumes',
      label: 'Resumes',
      iconSymbol: 'description',
      iconFallback: 'resume',
    },
    {
      to: '/jobs',
      label: 'Job Descriptions',
      iconSymbol: 'work_outline',
      iconFallback: 'jobs',
    },
    {
      to: '/analyses',
      label: 'Match Analyses',
      iconSymbol: 'insights',
      iconFallback: 'analyses',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--bg-overlay)',
            zIndex: 40,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Navigation Aside Container */}
      <aside
        className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
        style={{
          width: '240px',
          flexShrink: 0,
          position: 'sticky',
          top: '3.75rem',
          height: 'calc(100vh - 3.75rem)',
          alignSelf: 'flex-start',
          borderRight: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          userSelect: 'none',
          transition: 'background-color var(--transition-normal), border-color var(--transition-normal)',
          overflowY: 'auto',
        }}
        aria-label="Sidebar navigation"
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Logo / Brand Header */}
          <div
            style={{
              height: '3.75rem',
              padding: '0 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div
                style={{
                  width: '1.625rem',
                  height: '1.625rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                R
              </div>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '1rem',
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                }}
              >
                ResumeAI
              </span>
            </div>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                padding: '0.125rem 0.4rem',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--bg-container)',
                color: 'var(--text-secondary)',
              }}
            >
              v2.4
            </span>
          </div>

          {/* Navigation Links Group */}
          <div style={{ padding: '1rem 0.75rem' }}>
            <div
              style={{
                padding: '0 0.5rem 0.5rem',
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
              }}
            >
              Workspace
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--bg-container)' : 'transparent',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: 'var(--text-sm)',
                    textDecoration: 'none',
                    transition: 'all var(--transition-fast)',
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: '1.125rem',
                          color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                        }}
                      >
                        {item.iconSymbol}
                      </span>
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer: Theme Toggle & Workspace Switcher */}
        <div
          style={{
            padding: '0.875rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {/* Light / Dark Mode Toggle Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.25rem',
              backgroundColor: 'var(--bg-container)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <button
              type="button"
              onClick={() => setTheme('light')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'all var(--transition-fast)',
                backgroundColor: theme === 'light' ? 'var(--bg-surface)' : 'transparent',
                color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: theme === 'light' ? 'var(--shadow-xs)' : 'none',
              }}
              aria-label="Switch to light mode"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
                light_mode
              </span>
              <span>Light</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'all var(--transition-fast)',
                backgroundColor: theme === 'dark' ? 'var(--bg-surface)' : 'transparent',
                color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: theme === 'dark' ? 'var(--shadow-xs)' : 'none',
              }}
              aria-label="Switch to dark mode"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
                dark_mode
              </span>
              <span>Dark</span>
            </button>
          </div>

          {/* Workspace Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.375rem 0.625rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-container-low)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
              <div
                style={{
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--success)',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                My Workspace
              </span>
            </div>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '1rem', color: 'var(--text-muted)' }}
            >
              unfold_more
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
