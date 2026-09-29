import apiClient from './apiClient.js';

export const authApi = {
  /**
   * Register a new user account
   * POST /api/auth/register
   *
   * @param {object} payload
   * @param {string} payload.name
   * @param {string} payload.email
   * @param {string} payload.password
   * @returns {Promise<{ user: { user_id, name, email, created_at } }>}
   */
  register: async ({ name, email, password }) => {
    const res = await apiClient.post('/auth/register', { name, email, password });
    return res.data;
  },

  /**
   * Authenticate with email and password
   * POST /api/auth/login
   *
   * @param {object} payload
   * @param {string} payload.email
   * @param {string} payload.password
   * @returns {Promise<{ token: string, user: { user_id, name, email } }>}
   */
  login: async ({ email, password }) => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data;
  },

  /**
   * Get current authenticated user profile
   * GET /api/auth/me
   *
   * @returns {Promise<{ user: { user_id, name, email, created_at, updated_at } }>}
   */
  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  /**
   * Log out (stateless server acknowledgment)
   * POST /api/auth/logout
   */
  logout: async () => {
    const res = await apiClient.post('/auth/logout');
    return res.data;
  },
};

export default authApi;
