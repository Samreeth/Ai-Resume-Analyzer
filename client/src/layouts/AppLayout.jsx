import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/navigation/Navbar.jsx';
import Sidebar from '../components/navigation/Sidebar.jsx';

/**
 * Main application layout enclosing authenticated views with top Navbar and navigation Sidebar
 */
export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        transition: 'background-color var(--transition-normal), color var(--transition-normal)',
      }}
    >
      {/* Top Header Navbar */}
      <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

      {/* Body: Sidebar + Main Content */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main
          style={{
            flex: 1,
            padding: '1.75rem 2rem',
            minWidth: 0,
            overflowX: 'hidden',
          }}
        >
          <div style={{ maxWidth: '1360px', margin: '0 auto', width: '100%' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
