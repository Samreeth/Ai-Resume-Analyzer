import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/navigation/Navbar.jsx';
import Sidebar from '../components/navigation/Sidebar.jsx';

/**
 * Main application layout enclosing authenticated views with curved left Sidebar and curved top Navbar
 */
export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        transition: 'background-color var(--transition-normal), color var(--transition-normal)',
      }}
    >
      {/* Full-Height Left Sidebar in Curved Layout */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Right Column: Top Curved Navbar + Scrollable Main Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* Top Header Navbar Wrapper with Curved Margin */}
        <div className="app-navbar-wrapper">
          <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        </div>

        {/* Scrollable Main Content */}
        <main className="app-main-content">
          <div className="app-main-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
