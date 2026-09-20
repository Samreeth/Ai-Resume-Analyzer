import { registerUser, loginUser, getUserById } from '../services/auth.service.mjs';
import { sendSuccess } from '../utils/response.mjs';

/**
 * Handle user registration
 */
export const register = async (req, res, next) => {
  try {
    const user = await registerUser(req.body);
    return sendSuccess(res, { user }, 'User registered successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle user login
 */
export const login = async (req, res, next) => {
  try {
    const { token, user } = await loginUser(req.body);
    return sendSuccess(res, { token, user }, 'Login successful', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user profile
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await getUserById(req.user.userId);
    return sendSuccess(res, { user }, 'User profile retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle user logout
 */
export const logout = async (req, res) => {
  return sendSuccess(res, {}, 'Logged out successfully', 200);
};

export default {
  register,
  login,
  getMe,
  logout,
};
