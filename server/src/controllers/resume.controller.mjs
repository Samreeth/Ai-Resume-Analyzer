import resumeService from '../services/resume.service.mjs';
import { sendSuccess } from '../utils/response.mjs';
import {
  resumeIdParamSchema,
  listResumesQuerySchema,
} from '../validators/resume.validator.mjs';

/**
 * Handle multipart resume upload
 */
export const upload = async (req, res, next) => {
  try {
    const resume = await resumeService.createResume({
      userId: req.user.userId,
      originalName: req.file.originalname,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype.toLowerCase(),
    });

    return sendSuccess(res, { resume }, 'Resume uploaded successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle listing resumes for the authenticated user
 */
export const list = async (req, res, next) => {
  try {
    const { page, limit } = listResumesQuerySchema.parse(req.query);

    const { resumes, pagination } = await resumeService.listResumes({
      userId: req.user.userId,
      page,
      limit,
    });

    return sendSuccess(
      res,
      { resumes, pagination },
      'Resumes retrieved successfully',
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Handle retrieving details of a single resume
 */
export const getById = async (req, res, next) => {
  try {
    const { resumeId } = resumeIdParamSchema.parse(req.params);

    const resume = await resumeService.getResumeById({
      userId: req.user.userId,
      resumeId,
    });

    return sendSuccess(
      res,
      { resume },
      'Resume details retrieved successfully',
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Handle deleting a resume
 */
export const deleteById = async (req, res, next) => {
  try {
    const { resumeId } = resumeIdParamSchema.parse(req.params);

    await resumeService.deleteResumeById({
      userId: req.user.userId,
      resumeId,
    });

    return sendSuccess(res, {}, 'Resume deleted successfully', 200);
  } catch (error) {
    next(error);
  }
};

export default {
  upload,
  list,
  getById,
  deleteById,
};
