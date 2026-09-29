/**
 * Resume Processing Controller
 * Handles HTTP requests for explicit resume processing and processing status retrieval.
 */

import processingService from '../services/processing.service.mjs';
import { resumeIdParamSchema } from '../validators/resume.validator.mjs';
import { ExtractionError } from '../utils/text.util.mjs';

/**
 * Handle explicit resume processing request
 * POST /api/resumes/:resumeId/process
 */
export const processResume = async (req, res, next) => {
  try {
    const { resumeId } = resumeIdParamSchema.parse(req.params);

    const result = await processingService.processResume({
      userId: req.user.userId,
      resumeId,
      options: req.body?.options || {},
    });

    return res.status(200).json({
      status: 'success',
      data: {
        resumeId: result.resumeId,
        extractionStatus: result.extractionStatus,
        extractedText: result.extractedText,
        characterCount: result.characterCount,
        wordCount: result.wordCount,
        processingAttempts: result.processingAttempts,
        processingCompletedAt: result.processingCompletedAt,
      },
      message: 'Resume text processed successfully.',
    });
  } catch (err) {
    if (err instanceof ExtractionError) {
      const statusCode = err.statusCode || 422;

      // Set Retry-After header for cooldown and concurrency rejections
      if (err.details?.retryAfterSeconds) {
        res.set('Retry-After', String(err.details.retryAfterSeconds));
      }

      return res.status(statusCode).json({
        status: 'error',
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      });
    }

    if (err.name === 'ZodError') {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Invalid resume identifier format.',
      });
    }

    console.error(`[PROCESSOR CONTROLLER] Unexpected error: ${err.message}`);
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred while processing the resume.',
    });
  }
};

/**
 * Handle retrieving processing status for a resume
 * GET /api/resumes/:resumeId/status
 */
export const getStatus = async (req, res, next) => {
  try {
    const { resumeId } = resumeIdParamSchema.parse(req.params);

    const status = await processingService.getResumeProcessingStatus({
      userId: req.user.userId,
      resumeId,
    });

    return res.status(200).json({
      status: 'success',
      data: status,
      message: 'Resume processing status retrieved successfully.',
    });
  } catch (err) {
    if (err instanceof ExtractionError) {
      return res.status(err.statusCode || 422).json({
        status: 'error',
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      });
    }

    if (err.name === 'ZodError') {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Invalid resume identifier format.',
      });
    }

    next(err);
  }
};

export default {
  processResume,
  getStatus,
};
