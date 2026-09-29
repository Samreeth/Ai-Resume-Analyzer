import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../pages/auth/LoginPage.jsx';
import RegisterPage from '../pages/auth/RegisterPage.jsx';
import { AuthProvider, AuthContext } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import ProtectedRoute from '../layouts/ProtectedRoute.jsx';
import authApi from '../api/auth.api.js';
import * as apiClientModule from '../api/apiClient.js';

// Mock authApi
vi.mock('../api/auth.api.js', () => ({
  default: {
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
    logout: vi.fn(),
  },
}));

const renderWithProviders = (ui, { route = '/' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <ToastProvider>{ui}</ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('Authentication & Route Protection Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // 1. Login form rendering and validation
  it('1. Login form rendering and validation: detects missing and malformed inputs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login' });

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByTestId('login-submit-btn')).toBeInTheDocument();

    // Submit empty form
    await user.click(screen.getByTestId('login-submit-btn'));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();

    // Type invalid email
    await user.type(screen.getByLabelText(/email address/i), 'invalid-email');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByTestId('login-submit-btn'));

    expect(await screen.findByText(/invalid email address format/i)).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  // 2. Successful login
  it('2. Successful login: authenticates user and sets token', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValueOnce({
      token: 'mock-jwt-token-123',
      user: { user_id: 'u1', name: 'Samreeth', email: 'samreeth@example.com' },
    });

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard Destination</div>} />
      </Routes>,
      { route: '/login' }
    );

    await user.type(screen.getByLabelText(/email address/i), 'samreeth@example.com');
    await user.type(screen.getByLabelText(/password/i), 'SecretPass123!');
    await user.click(screen.getByTestId('login-submit-btn'));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'samreeth@example.com',
        password: 'SecretPass123!',
      });
      expect(screen.getByText('Dashboard Destination')).toBeInTheDocument();
    });

    expect(localStorage.getItem('ai_resume_analyzer_token')).toBe('mock-jwt-token-123');
  });

  // 3. Failed login
  it('3. Failed login: displays server error alert gracefully', async () => {
    const user = userEvent.setup();
    authApi.login.mockRejectedValueOnce(new Error('Invalid email or password'));

    renderWithProviders(<LoginPage />, { route: '/login' });

    await user.type(screen.getByLabelText(/email address/i), 'wrong@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByTestId('login-submit-btn'));

    const alert = await screen.findByTestId('login-error-alert');
    expect(alert).toHaveTextContent(/invalid email or password/i);
    expect(localStorage.getItem('ai_resume_analyzer_token')).toBeNull();
  });

  // 4. Register form validation
  it('4. Register form validation: enforces schema constraints on name, email, and password', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: '/register' });

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

    // Submit empty
    await user.click(screen.getByTestId('register-submit-btn'));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();

    // Test name < 2 chars, invalid email, password < 8 chars
    await user.type(screen.getByLabelText(/full name/i), 'A');
    await user.type(screen.getByLabelText(/email address/i), 'bad-email');
    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(screen.getByTestId('register-submit-btn'));

    expect(await screen.findByText(/name must be at least 2 characters/i)).toBeInTheDocument();
    expect(await screen.findByText(/invalid email address format/i)).toBeInTheDocument();
    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  // 5. Successful registration
  it('5. Successful registration: calls register API and redirects to /login', async () => {
    const user = userEvent.setup();
    authApi.register.mockResolvedValueOnce({
      user: { user_id: 'new-u1', name: 'John Doe', email: 'john@example.com' },
    });

    renderWithProviders(
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<div>Login View</div>} />
      </Routes>,
      { route: '/register' }
    );

    await user.type(screen.getByLabelText(/full name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
    await user.type(screen.getByLabelText(/password/i), 'securePassword123');
    await user.click(screen.getByTestId('register-submit-btn'));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securePassword123',
      });
      expect(screen.getByText('Login View')).toBeInTheDocument();
    });
  });

  // 6. Authentication context initialization
  it('6. Authentication context initialization: bootstraps user profile when token is present', async () => {
    localStorage.setItem('ai_resume_analyzer_token', 'valid-stored-token');
    authApi.getMe.mockResolvedValueOnce({
      user: { user_id: 'u1', name: 'Samreeth', email: 'samreeth@example.com' },
    });

    const TestConsumer = () => {
      const { user, isAuthenticated, isLoading } = React.useContext(AuthContext);
      if (isLoading) return <div>Auth Loading...</div>;
      return (
        <div>
          <div>Auth Status: {isAuthenticated ? 'AUTHENTICATED' : 'ANONYMOUS'}</div>
          <div>User: {user?.name}</div>
        </div>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Auth Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(authApi.getMe).toHaveBeenCalled();
      expect(screen.getByText('Auth Status: AUTHENTICATED')).toBeInTheDocument();
      expect(screen.getByText('User: Samreeth')).toBeInTheDocument();
    });
  });

  // 7. Invalid token/session eviction
  it('7. Invalid token/session eviction: evicts stale token and resets user state when getMe fails', async () => {
    localStorage.setItem('ai_resume_analyzer_token', 'expired-token');
    authApi.getMe.mockRejectedValueOnce(new Error('Invalid token'));

    const TestConsumer = () => {
      const { user, isAuthenticated, isLoading } = React.useContext(AuthContext);
      if (isLoading) return <div>Auth Loading...</div>;
      return <div>Auth Status: {isAuthenticated ? 'AUTHENTICATED' : 'ANONYMOUS'}</div>;
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Auth Status: ANONYMOUS')).toBeInTheDocument();
      expect(localStorage.getItem('ai_resume_analyzer_token')).toBeNull();
    });
  });

  // 8. Protected route redirect
  it('8. Protected route redirect: unauthenticated user visiting /dashboard is redirected to /login', async () => {
    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Protected Dashboard Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page Target</div>} />
      </Routes>,
      { route: '/dashboard' }
    );

    await waitFor(() => {
      expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument();
      expect(screen.getByText('Login Page Target')).toBeInTheDocument();
    });
  });

  // 9. Authenticated route access
  it('9. Authenticated route access: renders protected content when authenticated', async () => {
    localStorage.setItem('ai_resume_analyzer_token', 'valid-token');
    authApi.getMe.mockResolvedValueOnce({
      user: { user_id: 'u1', name: 'Samreeth', email: 'samreeth@example.com' },
    });

    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Protected Dashboard Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page Target</div>} />
      </Routes>,
      { route: '/dashboard' }
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Dashboard Content')).toBeInTheDocument();
      expect(screen.queryByText('Login Page Target')).not.toBeInTheDocument();
    });
  });

  // 10. Logout
  it('10. Logout: clears authentication state and localStorage', async () => {
    localStorage.setItem('ai_resume_analyzer_token', 'valid-token');
    authApi.getMe.mockResolvedValueOnce({
      user: { user_id: 'u1', name: 'Samreeth', email: 'samreeth@example.com' },
    });
    authApi.logout.mockResolvedValueOnce({});

    const LogoutTest = () => {
      const { user, isAuthenticated, logout } = React.useContext(AuthContext);
      return (
        <div>
          <div>Auth: {isAuthenticated ? 'LOGGED_IN' : 'LOGGED_OUT'}</div>
          {user && <button onClick={logout}>Sign Out Test</button>}
        </div>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <LogoutTest />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Auth: LOGGED_IN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Sign Out Test'));

    await waitFor(() => {
      expect(screen.getByText('Auth: LOGGED_OUT')).toBeInTheDocument();
      expect(localStorage.getItem('ai_resume_analyzer_token')).toBeNull();
    });
  });
});
