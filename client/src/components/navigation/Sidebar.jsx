import React, { useState, useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import { ToastContext } from '../../context/ToastContext.jsx';
import { useTheme } from '../../hooks/useTheme.js';
import logoImg from '../../assets/logo.png';

/**
 * Sidebar navigation component
 * Minimalist curved SaaS sidebar matching ResumeAI reference design.
 *
 * @param {object} props
 * @param {boolean} [props.isOpen=false] - For mobile drawer visibility
 * @param {function} [props.onClose] - Close mobile drawer callback
 */
export const Sidebar = ({ isOpen = false, onClose }) => {
  const { theme } = useTheme();
  const auth = useContext(AuthContext);
  const toastCtx = useContext(ToastContext);
  const user = auth?.user;
  const username = user?.name || user?.username || (user?.email ? user.email.split('@')[0] : '');
  const workspaceTitle = username ? `${username}'s Workspace` : "Pranav's Workspace";
  const userInitials = user?.name
    ? (user.name.trim().includes(' ')
        ? user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
        : user.name[0].toUpperCase())
    : (username ? username[0].toUpperCase() : 'P');
  const logout = auth?.logout;
  const toast = toastCtx?.toast;
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      if (logout) {
        await logout();
      }
      toast?.info?.('You have been logged out.');
      navigate('/login');
    } catch (_) {
      // Non-blocking logout error
    } finally {
      setLoggingOut(false);
    }
  };

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      iconSymbol: 'grid_view',
    },
    {
      to: '/resumes',
      label: 'Resumes',
      iconSymbol: 'description',
    },
    {
      to: '/jobs',
      label: 'Job Descriptions',
      iconSymbol: 'work_outline',
    },
    {
      to: '/analyses',
      label: 'Match Analyses',
      iconSymbol: 'insights',
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
            zIndex: 90,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Navigation Aside Container - Curved Layout */}
      <aside
        className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
        style={{
          width: '240px',
          flexShrink: 0,
          height: 'calc(100vh - 1.5rem)',
          margin: '0.75rem 0 0.75rem 0.75rem',
          borderRadius: '1.125rem',
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-card, rgb(23, 24, 26))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          userSelect: 'none',
          position: 'relative',
          zIndex: 40,
          transition: 'background-color var(--transition-normal), border-color var(--transition-normal)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        aria-label="Sidebar navigation"
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* 1. Brand Logo Header: R ResumeAI v2.4 */}
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
              {/* Brand Logo Image */}
              <img
                src={logoImg}
                alt="ResumeAI Logo"
                style={{
                  width: '1.875rem',
                  height: '1.875rem',
                  objectFit: 'contain',
                  flexShrink: 0,
                  filter: 'drop-shadow(0 2px 6px rgba(99, 102, 241, 0.35))',
                }}
              />

              <span
                style={{
                  fontWeight: 700,
                  fontSize: '1.0625rem',
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary, #ffffff)',
                  whiteSpace: 'nowrap',
                }}
              >
                ResumeAI
              </span>
            </div>

            {/* Version Badge in curved pill */}
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--text-muted, #94a3b8)',
                padding: '0.125rem 0.45rem',
                borderRadius: '9999px',
                backgroundColor: 'var(--bg-container-low)',
              }}
            >
              v2.4
            </span>
          </div>

          {/* 2. Section Heading: WORKSPACE */}
          <div
            style={{
              padding: '1.25rem 1.25rem 0.5rem',
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted, #64748b)',
            }}
          >
            WORKSPACE
          </div>

          {/* 3. Navigation Links List */}
          <div style={{ padding: '0 0.75rem' }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  style={({ isActive }) => {
                    const activeColor = theme === 'light' ? '#000000' : '#ffffff';
                    return {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.625rem',
                      color: isActive ? activeColor : 'var(--text-secondary, #94a3b8)',
                      backgroundColor: isActive
                        ? 'var(--bg-container-high, rgba(255, 255, 255, 0.08))'
                        : 'transparent',
                      border: isActive
                        ? '1px solid var(--border-default, rgba(255, 255, 255, 0.12))'
                        : '1px solid transparent',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: 'var(--text-sm, 0.875rem)',
                      textDecoration: 'none',
                      transition: 'all var(--transition-fast)',
                    };
                  }}
                >
                  {({ isActive }) => {
                    const activeColor = theme === 'light' ? '#000000' : '#ffffff';
                    return (
                      <>
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: '1.2rem',
                            color: isActive ? activeColor : 'var(--text-muted, #64748b)',
                            flexShrink: 0,
                          }}
                        >
                          {item.iconSymbol}
                        </span>
                        <span>{item.label}</span>
                      </>
                    );
                  }}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {/* 4. Footer: Workspace Profile Card & Sign Out Button */}
        <div
          style={{
            padding: '1rem 0.875rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {/* User Workspace Info in curved container */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.4rem 0.5rem',
              borderRadius: '0.625rem',
              backgroundColor: 'var(--bg-container-low)',
            }}
          >
            {/* Avatar circle with initial */}
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
              {userInitials}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.25 }}>
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary, #ffffff)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                data-testid="sidebar-workspace-title"
              >
                {workspaceTitle}
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted, #64748b)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.email || 'p@gmail.com'}
              </span>
            </div>
          </div>

          {/* Sign Out Button in curved container */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Sign out of application"
            data-testid="sidebar-logout-btn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '0.625rem',
              border: '1px solid rgba(239, 68, 68, 0.22)',
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
              color: 'var(--danger, #ef4444)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: loggingOut ? 'not-allowed' : 'pointer',
              opacity: loggingOut ? 0.7 : 1,
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.06)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.22)';
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '1rem', color: 'inherit' }}
            >
              logout
            </span>
            <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
