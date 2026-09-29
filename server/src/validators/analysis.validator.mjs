import { z } from 'zod';

/**
 * Validation schema for creating a new analysis
 */
export const createAnalysisSchema = z.object({
  resumeId: z
    .string({ required_error: 'Resume ID is required' })
    .uuid({ message: 'Invalid resume ID format' }),
  jobId: z
    .string({ required_error: 'Job ID is required' })
    .uuid({ message: 'Invalid job ID format' }),
});

/**
 * Validation schema for route parameters containing an analysisId UUID
 */
export const analysisIdParamSchema = z.object({
  analysisId: z
    .string({ required_error: 'Analysis ID is required' })
    .uuid({ message: 'Invalid analysis ID format' }),
});

/**
 * Validation schema for listing historical analyses with pagination
 */
export const listAnalysesQuerySchema = z.object({
  page: z.coerce
    .number({ invalid_type_error: 'Page must be a valid number' })
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: 'Limit must be a valid number' })
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(50, 'Limit cannot exceed 50')
    .default(10),
});

export default {
  createAnalysisSchema,
  analysisIdParamSchema,
  listAnalysesQuerySchema,
};
