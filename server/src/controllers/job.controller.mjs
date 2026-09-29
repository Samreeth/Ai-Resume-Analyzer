import jobService from '../services/job.service.mjs';
import { sendSuccess } from '../utils/response.mjs';
import {
  createJobSchema,
  updateJobSchema,
  jobIdParamSchema,
  listJobsQuerySchema,
} from '../validators/job.validator.mjs';

/**
 * Handle job description creation
 */
export const create = async (req, res, next) => {
  try {
    const { title, description } = createJobSchema.parse(req.body);

    const job = await jobService.createJob({
      userId: req.user.userId,
      title,
      description,
    });

    return sendSuccess(res, { job }, 'Job description created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle listing job descriptions for the authenticated user
 */
export const list = async (req, res, next) => {
  try {
    const { page, limit } = listJobsQuerySchema.parse(req.query);

    const { jobs, pagination } = await jobService.listJobs({
      userId: req.user.userId,
      page,
      limit,
    });

    return sendSuccess(
      res,
      { jobs, pagination },
      'Job descriptions retrieved successfully',
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Handle retrieving details of a single job description
 */
export const getById = async (req, res, next) => {
  try {
    const { jobId } = jobIdParamSchema.parse(req.params);

    const job = await jobService.getJobById({
      userId: req.user.userId,
      jobId,
    });

    return sendSuccess(
      res,
      { job },
      'Job description details retrieved successfully',
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Handle updating a job description with PUT partial-update semantics
 */
export const update = async (req, res, next) => {
  try {
    const { jobId } = jobIdParamSchema.parse(req.params);
    const { title, description } = updateJobSchema.parse(req.body);

    const job = await jobService.updateJob({
      userId: req.user.userId,
      jobId,
      title,
      description,
    });

    return sendSuccess(res, { job }, 'Job description updated successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle deleting a job description
 */
export const deleteById = async (req, res, next) => {
  try {
    const { jobId } = jobIdParamSchema.parse(req.params);

    await jobService.deleteJobById({
      userId: req.user.userId,
      jobId,
    });

    return sendSuccess(res, {}, 'Job description deleted successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle skill re-extraction on an existing job description
 */
export const extract = async (req, res, next) => {
  try {
    const { jobId } = jobIdParamSchema.parse(req.params);

    const job = await jobService.reExtractJobSkills({
      userId: req.user.userId,
      jobId,
    });

    return sendSuccess(res, { job }, 'Skills re-extracted successfully', 200);
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  list,
  getById,
  update,
  deleteById,
  extract,
};
