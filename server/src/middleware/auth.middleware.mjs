import { verifyToken } from '../services/auth.service.mjs';
import { sendError } from '../utils/response.mjs';

/**
 * Authentication Middleware: Validates Bearer JWT Token on protected routes
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'AUTHENTICATION_ERROR', 'Authentication token is required', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'AUTHENTICATION_ERROR', 'Token has expired, please log in again', 401);
    }
    return sendError(res, 'AUTHENTICATION_ERROR', 'Invalid authentication token', 401);
  }
};

export default {
  requireAuth,
};
