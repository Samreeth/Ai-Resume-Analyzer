import { z } from 'zod';

/**
 * Validate analysisId parameter in request path.
 * Enforces generic UUID format.
 */
export const analysisIdParamSchema = z.object({
  analysisId: z.string().uuid({ message: 'Invalid analysis ID format. Must be a valid UUID.' }),
});

/**
 * Validate optional priority and category query parameters for recommendation filtering.
 */
export const recommendationsQuerySchema = z.object({
  priority: z
    .enum(['HIGH', 'MEDIUM', 'LOW'], {
      errorMap: () => ({ message: "Priority filter must be one of: 'HIGH', 'MEDIUM', 'LOW'." }),
    })
    .optional(),
  category: z
    .enum(['SKILL_GAP', 'RESUME_QUALITY', 'IMPACT_METRICS', 'FORMATTING'], {
      errorMap: () => ({
        message:
          "Category filter must be one of: 'SKILL_GAP', 'RESUME_QUALITY', 'IMPACT_METRICS', 'FORMATTING'.",
      }),
    })
    .optional(),
});

export default {
  analysisIdParamSchema,
  recommendationsQuerySchema,
};
