import recommendationService from '../services/recommendation.service.mjs';
import { sendSuccess } from '../utils/response.mjs';
import {
  analysisIdParamSchema,
  recommendationsQuerySchema,
} from '../validators/recommendation.validator.mjs';

/**
 * Handle retrieving recommendations, skill gap analysis, and resume quality diagnostics
 */
export const getRecommendations = async (req, res, next) => {
  try {
    const { analysisId } = analysisIdParamSchema.parse(req.params);
    const { priority, category } = recommendationsQuerySchema.parse(req.query);

    const data = await recommendationService.getRecommendations({
      userId: req.user.userId,
      analysisId,
      priority,
      category,
    });

    return sendSuccess(res, data, 'Analysis recommendations retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
};

export default {
  getRecommendations,
};
