/**
 * Controller for AI-Powered Resume Understanding & Job Comparison Endpoints (Stages 2 & 3)
 */

import { sendSuccess } from '../utils/response.mjs';
import resumeAiService from '../services/resume.ai.service.mjs';
import {
  aiProfileRequestSchema,
  aiJobComparisonRequestSchema,
  aiJobComparisonQuerySchema,
  aiRecommendationsRequestSchema,
  aiRecommendationsQuerySchema,
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

/**
 * Handle AI contextual job-to-resume comparison generation request (Stage 3)
 * POST /api/resumes/:resumeId/ai-job-comparison
 */
export const generateAiJobComparison = async (req, res, next) => {
  try {
    const { resumeId } = resumeIdParamSchema.parse(req.params);
    const { jobId, consent, force_refresh } = aiJobComparisonRequestSchema.parse(req.body);

    const result = await resumeAiService.generateResumeJobComparison({
      userId: req.user.userId,
      resumeId,
      jobId,
      consent,
      forceRefresh: force_refresh,
    });

    const statusCode = result.cached ? 200 : 201;
    const message = result.cached
      ? 'Cached AI job comparison retrieved successfully'
      : 'AI job comparison generated successfully';

    return sendSuccess(res, result, message, statusCode);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle retrieving cached AI contextual job-to-resume comparison (Stage 3)
 * GET /api/resumes/:resumeId/ai-job-comparison
 */
export const getAiJobComparison = async (req, res, next) => {
  try {
    const { resumeId } = resumeIdParamSchema.parse(req.params);
    const { jobId } = aiJobComparisonQuerySchema.parse(req.query);

    const result = await resumeAiService.getResumeJobComparison({
      userId: req.user.userId,
      resumeId,
      jobId,
    });

    return sendSuccess(res, result, 'Cached AI job comparison retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle AI personalized recommendations generation request (Stage 4)
 * POST /api/resumes/:resumeId/ai-recommendations
 */
export const generateAiRecommendations = async (req, res, next) => {
  try {
    const { resumeId } = resumeIdParamSchema.parse(req.params);
    const { jobId, consent, force_refresh } = aiRecommendationsRequestSchema.parse(req.body);

    const result = await resumeAiService.generateResumeAiRecommendations({
      userId: req.user.userId,
      resumeId,
      jobId,
      consent,
      forceRefresh: force_refresh,
    });

    const statusCode = result.cached ? 200 : 201;
    const message = result.cached
      ? 'Cached AI recommendations retrieved successfully'
      : 'AI recommendations generated successfully';

    return sendSuccess(res, result, message, statusCode);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle retrieving cached AI personalized recommendations (Stage 4)
 * GET /api/resumes/:resumeId/ai-recommendations
 */
export const getAiRecommendations = async (req, res, next) => {
  try {
    const { resumeId } = resumeIdParamSchema.parse(req.params);
    const { jobId } = aiRecommendationsQuerySchema.parse(req.query);

    const result = await resumeAiService.getResumeAiRecommendations({
      userId: req.user.userId,
      resumeId,
      jobId,
    });

    return sendSuccess(res, result, 'Cached AI recommendations retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
};

export default {
  generateAiProfile,
  getAiProfile,
  generateAiJobComparison,
  getAiJobComparison,
  generateAiRecommendations,
  getAiRecommendations,
};
