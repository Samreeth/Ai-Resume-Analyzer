import React, { createContext, useState, useEffect, useCallback } from 'react';
import authApi from '../api/auth.api.js';
import { getToken, setToken, clearToken } from '../api/apiClient.js';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [tokenState, setTokenState] = useState(getToken());
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Re-verify profile on mount or token change
  const verifyAuth = useCallback(async () => {
    const existingToken = getToken();
    if (!existingToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await authApi.getMe();
      setUser(data.user);
      setTokenState(existingToken);
    } catch (_) {
      // Token is expired or invalid
      clearToken();
      setTokenState(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyAuth();

    // Listen for 401 unauthorized eviction events from apiClient
    const handleUnauthorized = () => {
      setTokenState(null);
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [verifyAuth]);

  /**
   * Log in user
   *
   * @param {string} email
   * @param {string} password
   */
  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    return data;
  };

  /**
   * Register user account
   *
   * @param {string} name
   * @param {string} email
   * @param {string} password
   */
  const register = async (name, email, password) => {
    const data = await authApi.register({ name, email, password });
    return data;
  };

  /**
   * Log out user
   */
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (_) {
      // Non-blocking logout error
    } finally {
      clearToken();
      setTokenState(null);
      setUser(null);
    }
  };

  const value = {
    user,
    token: tokenState,
    isAuthenticated: Boolean(user && tokenState),
    isLoading,
    login,
    register,
    logout,
    refreshUser: verifyAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
