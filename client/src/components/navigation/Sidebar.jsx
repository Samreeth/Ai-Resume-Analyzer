import React from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '../common/Icon.jsx';

/**
 * Sidebar navigation component
 * 240px elevated sidebar with active pill states and native SVG icons.
 *
 * @param {object} props
 * @param {boolean} [props.isOpen=false] - For mobile drawer visibility
 * @param {function} [props.onClose] - Close mobile drawer callback
 */
export const Sidebar = ({ isOpen = false, onClose }) => {
  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      iconName: 'dashboard',
    },
    {
      to: '/resumes',
      label: 'Resumes',
      iconName: 'resume',
    },
    {
      to: '/jobs',
      label: 'Job Descriptions',
      iconName: 'jobs',
    },
    {
      to: '/analyses',
      label: 'Match Analyses',
      iconName: 'analyses',
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

      {/* Navigation Container */}
      <aside
        className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
        style={{
          width: '240px',
          flexShrink: 0,
          borderRight: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem 0.875rem',
          minHeight: 'calc(100vh - 4rem)',
        }}
        aria-label="Sidebar navigation"
      >
        <div style={{ marginBottom: '1.25rem', paddingLeft: '0.75rem' }}>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
            }}
          >
            Navigation
          </span>
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
                gap: '0.75rem',
                padding: '0.625rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-card-hover)' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: 'var(--text-sm)',
                textDecoration: 'none',
                transition: 'all var(--transition-fast)',
                borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
              })}
            >
              {({ isActive }) => (
                <>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                    }}
                  >
                    <Icon name={item.iconName} size={18} />
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
