import { z } from 'zod';

/**
 * Validation schema for creating a new job description.
 * Notice: .trim() is placed before .min() so that whitespace-only strings
 * are reduced to empty strings and rejected by minimum length checks.
 */
export const createJobSchema = z.object({
  title: z
    .string({ required_error: 'Job title is required' })
    .trim()
    .min(3, 'Job title must be at least 3 characters')
    .max(255, 'Job title cannot exceed 255 characters'),
  description: z
    .string({ required_error: 'Job description is required' })
    .trim()
    .min(20, 'Job description must be at least 20 characters')
    .max(50000, 'Job description cannot exceed 50,000 characters'),
});

/**
 * Validation schema for updating a job description.
 * Intentionally supports partial updates where either title, description, or both
 * can be provided. At least one field must be present.
 */
export const updateJobSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Job title must be at least 3 characters')
      .max(255, 'Job title cannot exceed 255 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .min(20, 'Job description must be at least 20 characters')
      .max(50000, 'Job description cannot exceed 50,000 characters')
      .optional(),
  })
  .refine(
    (data) => data.title !== undefined || data.description !== undefined,
    { message: 'At least one field (title or description) must be provided for update' }
  );

/**
 * Validation schema for route parameters containing a jobId UUID
 */
export const jobIdParamSchema = z.object({
  jobId: z.string().uuid({ message: 'Invalid job ID format' }),
});

/**
 * Validation schema for listing job descriptions with pagination
 */
export const listJobsQuerySchema = z.object({
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
  createJobSchema,
  updateJobSchema,
  jobIdParamSchema,
  listJobsQuerySchema,
};
