import analysisService from '../services/analysis.service.mjs';
import { sendSuccess } from '../utils/response.mjs';
import {
  createAnalysisSchema,
  analysisIdParamSchema,
  listAnalysesQuerySchema,
} from '../validators/analysis.validator.mjs';

/**
 * Handle new analysis execution
 */
export const create = async (req, res, next) => {
  try {
    const { resumeId, jobId } = createAnalysisSchema.parse(req.body);

    const analysis = await analysisService.createAnalysis({
      userId: req.user.userId,
      resumeId,
      jobId,
    });

    return sendSuccess(res, { analysis }, 'Analysis completed successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle retrieving details of a single analysis
 */
export const getById = async (req, res, next) => {
  try {
    const { analysisId } = analysisIdParamSchema.parse(req.params);

    const analysis = await analysisService.getAnalysisById({
      userId: req.user.userId,
      analysisId,
    });

    return sendSuccess(res, { analysis }, 'Analysis retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle listing historical analyses for authenticated user
 */
export const list = async (req, res, next) => {
  try {
    const { page, limit } = listAnalysesQuerySchema.parse(req.query);

    const { analyses, pagination } = await analysisService.listAnalyses({
      userId: req.user.userId,
      page,
      limit,
    });

    return sendSuccess(
      res,
      { analyses, pagination },
      'Analyses retrieved successfully',
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Handle deleting an analysis record
 */
export const deleteById = async (req, res, next) => {
  try {
    const { analysisId } = analysisIdParamSchema.parse(req.params);

    await analysisService.deleteAnalysisById({
      userId: req.user.userId,
      analysisId,
    });

    return sendSuccess(res, {}, 'Analysis deleted successfully', 200);
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getById,
  list,
  deleteById,
};
