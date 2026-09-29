import { query } from '../config/database.mjs';
import { sanitizeResumeText } from '../utils/text.util.mjs';
import { extractFromJobDescription } from '../utils/skill.matcher.mjs';

/**
 * Ingest and create a new job description with synchronous skill extraction.
 * Text sanitization and Stage 1 skill extraction occur in memory prior to
 * database insertion. If extraction throws, no record is persisted.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.title
 * @param {string} params.description
 * @returns {Promise<object>} Created job description record
 */
export const createJob = async ({ userId, title, description, extractorFn = extractFromJobDescription }) => {
  // 1. Text normalization & sanitization
  const cleanTitle = title.trim().replace(/\s+/g, ' ');
  const cleanDescription = sanitizeResumeText(description);

  // 2. Synchronous in-memory Stage 1 skill extraction
  // If this throws, execution halts before SQL write, preventing partial records
  const extractedData = extractorFn(cleanDescription);

  // 3. Database persistence
  const res = await query(
    `INSERT INTO job_descriptions (user_id, title, description, extracted_data)
     VALUES ($1, $2, $3, $4)
     RETURNING job_id, title, description, extracted_data, created_at, updated_at`,
    [userId, cleanTitle, cleanDescription, JSON.stringify(extractedData)]
  );

  return res.rows[0];
};

/**
 * List job descriptions owned by the authenticated user with pagination.
 * Returns lightweight summary metadata including categorized skill counts.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @returns {Promise<{ jobs: Array, pagination: object }>}
 */
export const listJobs = async ({ userId, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;

  // 1. Fetch total count for user
  const countRes = await query(
    'SELECT COUNT(*)::int as total FROM job_descriptions WHERE user_id = $1',
    [userId]
  );
  const total = countRes.rows[0]?.total || 0;

  // 2. Fetch paginated rows ordered by creation time descending
  const rowsRes = await query(
    `SELECT job_id, title, extracted_data, created_at, updated_at
     FROM job_descriptions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const jobs = rowsRes.rows.map((row) => {
    const reqCount = row.extracted_data?.required?.length || 0;
    const prefCount = row.extracted_data?.preferred?.length || 0;
    return {
      job_id: row.job_id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
      skill_counts: {
        required: reqCount,
        preferred: prefCount,
        total: reqCount + prefCount,
      },
    };
  });

  return {
    jobs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieve complete job description record for the authenticated owner.
 * Strictly scopes by user_id to prevent IDOR information leakage.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.jobId
 * @returns {Promise<object>}
 */
export const getJobById = async ({ userId, jobId }) => {
  const res = await query(
    `SELECT job_id, title, description, extracted_data, created_at, updated_at
     FROM job_descriptions
     WHERE job_id = $1 AND user_id = $2`,
    [jobId, userId]
  );

  if (res.rows.length === 0) {
    const error = new Error('Job description not found');
    error.code = 'RESOURCE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  return res.rows[0];
};

/**
 * Update a job description record with consistent partial update semantics under PUT.
 * Allows updating title and/or description.
 * If description is updated, sanitization and re-extraction occur in memory prior
 * to database update. If extraction fails, the existing record is untouched.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.jobId
 * @param {string} [params.title]
 * @param {string} [params.description]
 * @returns {Promise<object>} Updated job description record
 */
export const updateJob = async ({ userId, jobId, title, description, extractorFn = extractFromJobDescription }) => {
  // 1. Verify existence & ownership
  const findRes = await query(
    `SELECT job_id, title, description, extracted_data
     FROM job_descriptions
     WHERE job_id = $1 AND user_id = $2`,
    [jobId, userId]
  );

  if (findRes.rows.length === 0) {
    const error = new Error('Job description not found');
    error.code = 'RESOURCE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const existing = findRes.rows[0];

  let cleanTitle = existing.title;
  if (title !== undefined) {
    cleanTitle = title.trim().replace(/\s+/g, ' ');
  }

  let cleanDescription = existing.description;
  let newExtractedData = existing.extracted_data;

  if (description !== undefined) {
    cleanDescription = sanitizeResumeText(description);
    // In-memory extraction occurs before SQL update. If this throws, execution halts
    // immediately and the existing database row remains intact.
    newExtractedData = extractorFn(cleanDescription);
  }

  // 2. Atomic database update
  const updateRes = await query(
    `UPDATE job_descriptions
     SET title = $1, description = $2, extracted_data = $3
     WHERE job_id = $4 AND user_id = $5
     RETURNING job_id, title, description, extracted_data, created_at, updated_at`,
    [cleanTitle, cleanDescription, JSON.stringify(newExtractedData), jobId, userId]
  );

  return updateRes.rows[0];
};

/**
 * Delete a job description record.
 * Preserves historical analyses via foreign key `analyses.job_id ON DELETE SET NULL`.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.jobId
 * @returns {Promise<boolean>}
 */
export const deleteJobById = async ({ userId, jobId }) => {
  const res = await query(
    'DELETE FROM job_descriptions WHERE job_id = $1 AND user_id = $2 RETURNING job_id',
    [jobId, userId]
  );

  if (res.rowCount === 0) {
    const error = new Error('Job description not found');
    error.code = 'RESOURCE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  return true;
};

/**
 * Force skill re-extraction on an existing job description.
 * Executes extraction in memory before database mutation for fault-isolation.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.jobId
 * @returns {Promise<object>} Updated job description record with new extracted_data
 */
export const reExtractJobSkills = async ({ userId, jobId, extractorFn = extractFromJobDescription }) => {
  // 1. Ownership & current text retrieval
  const findRes = await query(
    `SELECT job_id, description
     FROM job_descriptions
     WHERE job_id = $1 AND user_id = $2`,
    [jobId, userId]
  );

  if (findRes.rows.length === 0) {
    const error = new Error('Job description not found');
    error.code = 'RESOURCE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  // 2. In-memory extraction prior to database write
  const extractedData = extractorFn(findRes.rows[0].description);

  // 3. Atomic database update
  const updateRes = await query(
    `UPDATE job_descriptions
     SET extracted_data = $1
     WHERE job_id = $2 AND user_id = $3
     RETURNING job_id, title, description, extracted_data, created_at, updated_at`,
    [JSON.stringify(extractedData), jobId, userId]
  );

  return updateRes.rows[0];
};

export default {
  createJob,
  listJobs,
  getJobById,
  updateJob,
  deleteJobById,
  reExtractJobSkills,
};
