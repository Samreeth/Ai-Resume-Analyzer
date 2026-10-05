/**
 * Lightweight In-Memory Sliding-Window Rate Limiter Middleware
 * Protects expensive AI endpoints from excessive requests or quota exhaustion.
 */

import { sendError } from '../utils/response.mjs';

/**
 * Factory for route-level sliding-window rate limiters.
 *
 * @param {object} options
 * @param {number} [options.windowMs=60000] - Window size in ms (default 1 minute)
 * @param {number} [options.maxRequests=10] - Max allowed requests per window
 * @param {string} [options.message='Rate limit exceeded. Please wait before retrying.']
 * @returns {Function} Express middleware handler
 */
export const createRateLimiter = ({
  windowMs = 60000,
  maxRequests = 10,
  message = 'Rate limit exceeded. Please wait before retrying.',
} = {}) => {
  const requestHistory = new Map();

  // Periodic cleanup every 2 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of requestHistory.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        requestHistory.delete(key);
      } else {
        requestHistory.set(key, valid);
      }
    }
  }, 120000);

  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }

  const limiterMiddleware = (req, res, next) => {
    const key = req.user?.userId || req.ip || 'anonymous';
    const now = Date.now();

    const timestamps = requestHistory.get(key) || [];
    const recent = timestamps.filter((t) => now - t < windowMs);

    if (recent.length >= maxRequests) {
      const oldest = recent[0];
      const resetInSeconds = Math.ceil((oldest + windowMs - now) / 1000);

      res.setHeader('Retry-After', String(Math.max(1, resetInSeconds)));
      return sendError(res, 'RATE_LIMIT_EXCEEDED', message, 429);
    }

    recent.push(now);
    requestHistory.set(key, recent);
    next();
  };

  limiterMiddleware.reset = () => {
    requestHistory.clear();
  };

  return limiterMiddleware;
};

// Default rate limiter for AI generation (10 requests per minute per user)
export const aiGenerationRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  message: 'Too many AI generation requests. Please wait a moment before trying again.',
});

export default {
  createRateLimiter,
  aiGenerationRateLimiter,
};
