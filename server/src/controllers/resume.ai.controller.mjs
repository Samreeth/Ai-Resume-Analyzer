/**
 * Controller for AI-Powered Resume Understanding Endpoints (Stage 2)
 */

import { sendSuccess } from '../utils/response.mjs';
import resumeAiService from '../services/resume.ai.service.mjs';
import {
  aiProfileRequestSchema,
  resumeIdParamSchema,
} from '../validators/resume.ai.validator.mjs';

/**
 * Handle AI resume profile generation request
 * POST /api/resumes/:resumeId/ai-profile
 */
export const generateAiProfile = async (req, res, next) => {
  try {
    const { resumeId } = resumeIdParamSchema.parse(req.params);
    const { consent, force_refresh } = aiProfileRequestSchema.parse(req.body);

    const result = await resumeAiService.generateResumeAiProfile({
      userId: req.user.userId,
      resumeId,
      consent,
      forceRefresh: force_refresh,
    });

    const statusCode = result.cached ? 200 : 201;
    const message = result.cached
      ? 'Cached AI resume profile retrieved successfully'
      : 'AI resume profile generated successfully';

    return sendSuccess(res, result, message, statusCode);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle retrieving cached AI resume profile
 * GET /api/resumes/:resumeId/ai-profile
 */
export const getAiProfile = async (req, res, next) => {
  try {
    const { resumeId } = resumeIdParamSchema.parse(req.params);

    const result = await resumeAiService.getResumeAiProfile({
      userId: req.user.userId,
      resumeId,
    });

    return sendSuccess(res, result, 'AI resume profile retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
};

export default {
  generateAiProfile,
  getAiProfile,
};
