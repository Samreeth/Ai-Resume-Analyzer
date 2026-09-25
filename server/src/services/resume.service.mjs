import path from 'path';
import { pool, query } from '../config/database.mjs';
import storageService from './storage.service.mjs';
import {
  computeFileHash,
  sanitizeDisplayName,
  resolveSecurePath,
} from '../utils/file.util.mjs';

/**
 * Persist an uploaded resume with atomic staged write and DB transaction rollback
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.originalName
 * @param {Buffer} params.buffer
 * @param {string} params.mimeType
 * @returns {Promise<object>} Created resume record
 */
export const createResume = async ({ userId, originalName, buffer, mimeType }) => {
  const extension = path.extname(originalName).toLowerCase();
  const displayName = sanitizeDisplayName(originalName, extension);
  const fileSize = buffer.length;
  const fileHash = computeFileHash(buffer);

  // 1. Staged atomic file write to storage
  const { relativePath } = await storageService.saveFileAtomic(buffer, extension);

  // 2. Database persistence with rollback coordination
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertSql = `
      INSERT INTO resumes (
        user_id, file_name, file_path, file_size, mime_type, file_hash, extraction_status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
      RETURNING resume_id, file_name, file_size, mime_type, file_hash, extraction_status, uploaded_at, updated_at
    `;

    const res = await client.query(insertSql, [
      userId,
      displayName,
      relativePath,
      fileSize,
      mimeType,
      fileHash,
    ]);

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');

    // Clean up stored file if database insertion failed
    try {
      await storageService.deleteFile(relativePath, 'upload-rollback');
    } catch (cleanupErr) {
      console.error(
        `[CRITICAL STORAGE ERROR] Failed to clean up stored file during upload rollback: ${cleanupErr.message}`
      );
    }

    throw err;
  } finally {
    client.release();
  }
};

/**
 * List resumes for an authenticated user with pagination and upload-time ordering
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {number} params.page
 * @param {number} params.limit
 * @returns {Promise<{ resumes: Array, pagination: object }>}
 */
export const listResumes = async ({ userId, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;

  // 1. Fetch total count
  const countRes = await query(
    'SELECT COUNT(*)::int as total FROM resumes WHERE user_id = $1',
    [userId]
  );
  const total = countRes.rows[0]?.total || 0;

  // 2. Fetch paginated rows (never exposing raw file_path)
  const rowsRes = await query(
    `SELECT resume_id, file_name, file_size, mime_type, file_hash, extraction_status, uploaded_at, updated_at
     FROM resumes
     WHERE user_id = $1
     ORDER BY uploaded_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return {
    resumes: rowsRes.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieve detailed resume record for the authenticated owner
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.resumeId
 * @returns {Promise<object>}
 */
export const getResumeById = async ({ userId, resumeId }) => {
  const res = await query(
    `SELECT resume_id, file_name, file_size, mime_type, file_hash, extraction_status, extracted_data, uploaded_at, updated_at
     FROM resumes
     WHERE resume_id = $1 AND user_id = $2`,
    [resumeId, userId]
  );

  if (res.rows.length === 0) {
    const error = new Error('Resume not found');
    error.code = 'RESOURCE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  return res.rows[0];
};

/**
 * Delete a resume record, cascading DB relationships and unlinking the physical file
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.resumeId
 * @returns {Promise<boolean>}
 */
export const deleteResumeById = async ({ userId, resumeId }) => {
  // 1. Ownership & path retrieval
  const findRes = await query(
    'SELECT resume_id, file_path FROM resumes WHERE resume_id = $1 AND user_id = $2',
    [resumeId, userId]
  );

  if (findRes.rows.length === 0) {
    const error = new Error('Resume not found');
    error.code = 'RESOURCE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const relativePath = findRes.rows[0].file_path;

  // 2. Pre-validate stored path security before database removal
  resolveSecurePath(relativePath);

  // 3. Delete database record
  // (PostgreSQL automatically cascades resume_skills and sets analyses.resume_id = NULL)
  await query('DELETE FROM resumes WHERE resume_id = $1 AND user_id = $2', [
    resumeId,
    userId,
  ]);

  // 4. Filesystem unlink
  // If unlink fails, error is logged at CRITICAL level by storageService.deleteFile
  try {
    await storageService.deleteFile(relativePath, resumeId);
  } catch (unlinkErr) {
    // We do not rethrow to user because database ownership is severed, but error is logged for admin sweeper
    console.error(
      `[CRITICAL STORAGE FAILURE] Database row deleted but file cleanup failed for resumeId ${resumeId}: ${unlinkErr.message}`
    );
  }

  return true;
};

export default {
  createResume,
  listResumes,
  getResumeById,
  deleteResumeById,
};
