import { sendError } from '../utils/response.mjs';
import config from '../config/env.mjs';

/**
 * 404 Not Found Middleware
 */
export const notFoundHandler = (req, res, next) => {
  return sendError(
    res,
    'RESOURCE_NOT_FOUND',
    `Cannot ${req.method} ${req.originalUrl}`,
    404
  );
};

/**
 * Centralized Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Handle JSON parsing errors (HTTP 400 client error)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, 'VALIDATION_ERROR', 'Malformed JSON payload', 400);
  }

  // Handle Zod validation errors (HTTP 400 client error)
  if (err.name === 'ZodError') {
    const messages = err.errors.map((e) => `${e.path.join('.') || 'body'}: ${e.message}`).join(', ');
    return sendError(res, 'VALIDATION_ERROR', messages, 400);
  }

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

  // Log only unexpected 5xx server errors; avoid logging expected 4xx client errors
  // Never log passwords, tokens, or sensitive request bodies
  if (statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}: ${err.message}`);
    if (config.env !== 'production') {
      console.error(err.stack);
    }
  }

  const errorMessage =
    config.env === 'production' && statusCode === 500
      ? 'An internal server error occurred'
      : err.message || 'An unexpected error occurred';

  return sendError(res, errorCode, errorMessage, statusCode);
};

export default {
  notFoundHandler,
  errorHandler,
};
