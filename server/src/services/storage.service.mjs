import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import config from '../config/env.mjs';
import { resolveSecurePath } from '../utils/file.util.mjs';

const getResumesDir = () => path.resolve(config.uploadDir, 'resumes');

/**
 * Ensure resumes storage directory exists
 */
export const ensureStorageDir = async () => {
  const dir = getResumesDir();
  await fs.promises.mkdir(dir, { recursive: true });
};

/**
 * Staged atomic file write:
 * Writes to a temporary staging file inside uploads/resumes/.tmp_<uuid>.tmp,
 * then atomically renames to uploads/resumes/<uuid>.<ext>.
 *
 * @param {Buffer} buffer
 * @param {string} extension (e.g. '.pdf' or '.docx')
 * @returns {Promise<{ relativePath: string, fileName: string }>}
 */
export const saveFileAtomic = async (buffer, extension) => {
  await ensureStorageDir();

  const resumesDir = getResumesDir();
  const fileId = crypto.randomUUID();
  const cleanExt = extension.startsWith('.') ? extension : `.${extension}`;
  const permanentFileName = `${fileId}${cleanExt}`;
  const stagingFileName = `.tmp_${fileId}.tmp`;

  const stagingPath = path.join(resumesDir, stagingFileName);
  const permanentPath = path.join(resumesDir, permanentFileName);

  try {
    // 1. Write buffer to temporary staging file
    await fs.promises.writeFile(stagingPath, buffer);

    // 2. Atomically rename to permanent target
    await fs.promises.rename(stagingPath, permanentPath);

    return {
      relativePath: `resumes/${permanentFileName}`,
      fileName: permanentFileName,
    };
  } catch (err) {
    // Ensure staging file is cleaned up on any failure
    try {
      await fs.promises.unlink(stagingPath);
    } catch (_) {
      // Ignore cleanup error of temporary file if it was never created
    }
    throw err;
  }
};

/**
 * Safely delete a file from storage with path jail verification
 *
 * @param {string} relativePath (e.g. "resumes/<uuid>.<ext>")
 * @param {string} [contextId] Optional identifier (e.g. resumeId) for error logging
 * @returns {Promise<boolean>} True if file was unlinked or already absent
 */
export const deleteFile = async (relativePath, contextId = 'unknown') => {
  const resolvedPath = resolveSecurePath(relativePath);

  try {
    await fs.promises.unlink(resolvedPath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File already missing from disk is treated as cleanly removed
      return true;
    }

    // Never silently ignore filesystem deletion failures
    console.error(
      `[CRITICAL STORAGE FAILURE] Failed to unlink physical resume file: ` +
        JSON.stringify({
          contextId,
          relativePath,
          resolvedPath,
          errorCode: err.code,
          errorMessage: err.message,
          timestamp: new Date().toISOString(),
        })
    );
    throw err;
  }
};

/**
 * Check if a stored relative file exists on disk
 * @param {string} relativePath
 * @returns {Promise<boolean>}
 */
export const fileExists = async (relativePath) => {
  try {
    const resolved = resolveSecurePath(relativePath);
    await fs.promises.access(resolved, fs.constants.F_OK);
    return true;
  } catch (_) {
    return false;
  }
};

export default {
  ensureStorageDir,
  saveFileAtomic,
  deleteFile,
  fileExists,
};
