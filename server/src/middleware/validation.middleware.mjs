import { sendError } from '../utils/response.mjs';

/**
 * Express middleware to validate request body against a Zod schema
 * @param {import('zod').ZodSchema} schema
 */
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err) => `${err.path.join('.') || 'body'}: ${err.message}`)
      .join(', ');

    return sendError(res, 'VALIDATION_ERROR', errorMessages, 400);
  }

  req.body = result.data;
  next();
};

export default {
  validateBody,
};
