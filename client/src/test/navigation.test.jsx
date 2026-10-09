import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Navbar from '../components/navigation/Navbar.jsx';
import Sidebar from '../components/navigation/Sidebar.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';

const mockUser = {
  user_id: 'u-123',
  name: 'Samreeth',
  email: 'samreeth@example.com',
};

describe('Navigation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 15. Navigation user/logout behavior
  it('15. Navbar user/logout behavior: renders current user information and triggers logout handler', async () => {
    const logoutMock = vi.fn().mockResolvedValue({});

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthContext.Provider
          value={{
            user: mockUser,
            isAuthenticated: true,
            logout: logoutMock,
          }}
        >
          <ToastProvider>
            <Navbar />
            <Sidebar isOpen={true} onClose={() => {}} />
          </ToastProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    // Verify User Identity rendered
    expect(screen.getByTestId('navbar-user-name')).toHaveTextContent('Samreeth');
    expect(screen.getByTestId('navbar-user-email')).toHaveTextContent('samreeth@example.com');
    expect(screen.getByTestId('sidebar-workspace-title')).toHaveTextContent("Samreeth's Workspace");

    // Click Sign Out in Sidebar under My Workspace
    const logoutBtn = screen.getByTestId('sidebar-logout-btn');
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
    });
  });

  it('16. Sidebar navigation: provides active routes to Dashboard, Resumes, Jobs, and Analyses', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ToastProvider>
          <Sidebar isOpen={true} onClose={() => {}} />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Resumes')).toBeInTheDocument();
    expect(screen.getByText('Job Descriptions')).toBeInTheDocument();
    expect(screen.getByText('Match Analyses')).toBeInTheDocument();

    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/resumes');
    expect(hrefs).toContain('/jobs');
    expect(hrefs).toContain('/analyses');
  });
});
