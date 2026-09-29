import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';

export const AppLayout = () => {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.info('You have been logged out.');
      navigate('/login');
    } catch (_) {
      // Non-blocking logout error
    }
  };

  const navLinkStyle = ({ isActive }) => ({
    padding: '0.5rem 0.875rem',
    borderRadius: 'var(--radius-md)',
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
    fontWeight: isActive ? 600 : 500,
    fontSize: 'var(--text-sm)',
    transition: 'all var(--transition-fast)',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top Header Navigation */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
          {/* Logo & Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <NavLink to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
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
                }}
              >
                AI
              </span>
              <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', letterSpacing: '-0.02em' }}>
                Resume Analyzer
              </span>
            </NavLink>

            {/* Nav Links */}
            <nav style={{ display: 'flex', gap: '0.5rem' }}>
              <NavLink to="/dashboard" style={navLinkStyle}>
                Dashboard
              </NavLink>
              <NavLink to="/resumes" style={navLinkStyle}>
                Resumes
              </NavLink>
              <NavLink to="/jobs" style={navLinkStyle}>
                Job Descriptions
              </NavLink>
              <NavLink to="/analyses" style={navLinkStyle}>
                Analyses
              </NavLink>
            </nav>
          </div>

          {/* User Profile & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.name || 'User'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {user?.email || ''}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 'var(--text-xs)' }}
              title="Log out of application"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Content Body */}
      <main style={{ flex: 1, padding: '2rem 0' }}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '1.25rem 0', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        <div className="container">
          AI-Powered Resume Analyzer & Job Matching Platform &bull; Deterministic Local Intelligence &bull; Stage 1 Foundation
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
