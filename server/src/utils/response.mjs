/**
 * Standardized API response helpers matching README.md Section 9 specifications (ES Modules)
 */

export const sendSuccess = (res, data = {}, message = 'Request completed successfully', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
};

export const sendError = (res, code = 'INTERNAL_SERVER_ERROR', message = 'An unexpected error occurred', statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
};

export default {
  sendSuccess,
  sendError,
};
