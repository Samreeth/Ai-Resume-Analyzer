import { z } from 'zod';

export const resumeIdParamSchema = z.object({
  resumeId: z.string().uuid({ message: 'Invalid resume ID format' }),
});

export const listResumesQuerySchema = z.object({
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
  resumeIdParamSchema,
  listResumesQuerySchema,
};
