/**
 * Resume Text Processing and Extraction Service
 * Manages atomic claims, timeout deadlines, token fencing, retries, and recovery.
 */

import { query, ensureSchema } from '../config/database.mjs';
import storageService from './storage.service.mjs';
import { extractTextFromPdf } from './extractors/pdf.extractor.mjs';
import { extractTextFromDocx } from './extractors/docx.extractor.mjs';
import { ExtractionError, EXTRACTION_LIMITS } from '../utils/text.util.mjs';
import { extractionSemaphore } from '../utils/semaphore.util.mjs';

/**
 * Calculate remaining cooldown seconds from a completion timestamp.
 *
 * @param {string|Date|null} completedAt
 * @param {number} [currentTimeMs=Date.now()]
 * @param {number} [cooldownDurationSeconds=10]
 * @returns {number} Integer seconds remaining (0 if expired or invalid)
 */
export const calculateCooldownSeconds = (
  completedAt,
  currentTimeMs = Date.now(),
  cooldownDurationSeconds = 10
) => {
  if (!completedAt) return 0;
  const completedAtMs = new Date(completedAt).getTime();
  if (isNaN(completedAtMs)) return 0;

  const elapsedMs = Math.max(0, currentTimeMs - completedAtMs);
  const remainingMs = Math.max(0, cooldownDurationSeconds * 1000 - elapsedMs);
  return Math.ceil(remainingMs / 1000);
};

/**
 * Retrieve status and extraction metadata for a resume owned by the user.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.resumeId
 * @returns {Promise<object>}
 */
export const getResumeProcessingStatus = async ({ userId, resumeId }) => {
  const selectQuery = `
    SELECT
      resume_id,
      user_id,
      extraction_status,
      processing_attempts,
      processing_started_at,
      processing_completed_at,
      processing_error_code,
      processing_error_message,
      (extracted_text IS NOT NULL AND LENGTH(extracted_text) > 0) AS has_extracted_text
    FROM resumes
    WHERE resume_id = $1 AND user_id = $2;
  `;

  const result = await query(selectQuery, [resumeId, userId]);
  if (result.rowCount === 0) {
    throw new ExtractionError('RESUME_NOT_FOUND', 'Resume not found.', 404);
  }

  const row = result.rows[0];
  const canRetry =
    row.processing_attempts < 3 && row.extraction_status !== 'COMPLETED';

  return {
    resumeId: row.resume_id,
    extractionStatus: row.extraction_status,
    processingAttempts: row.processing_attempts,
    processingStartedAt: row.processing_started_at,
    processingCompletedAt: row.processing_completed_at,
    processingErrorCode: row.processing_error_code,
    processingErrorMessage: row.processing_error_message,
    hasExtractedText: Boolean(row.has_extracted_text),
    canRetry,
  };
};

/**
 * Perform a token-fenced finalization query with safe retry and verification.
 *
 * @param {object} params
 * @param {string} params.resumeId
 * @param {string} params.token
 * @param {string} params.status - 'COMPLETED' or 'FAILED'
 * @param {string|null} [params.text=null]
 * @param {string|null} [params.errorCode=null]
 * @param {string|null} [params.errorMessage=null]
 * @returns {Promise<{ success: boolean, rowCount: number, reason?: string }>}
 */
export const finalizeAttempt = async ({
  resumeId,
  token,
  status,
  text = null,
  errorCode = null,
  errorMessage = null,
  queryFn = query,
}) => {
  const updateQuery = `
    UPDATE resumes
    SET extraction_status = $1,
        extracted_text = $2,
        processing_error_code = $3,
        processing_error_message = $4,
        processing_completed_at = CURRENT_TIMESTAMP,
        processing_token = NULL
    WHERE resume_id = $5
      AND processing_token = $6
      AND extraction_status = 'PROCESSING';
  `;
  const params = [status, text, errorCode, errorMessage, resumeId, token];

  try {
    const result = await queryFn(updateQuery, params);
    if (result.rowCount === 1) {
      return { success: true, rowCount: 1 };
    }

    // rowCount === 0: Token mismatch, already finalized, or superseded
    console.warn(
      `[PROCESSOR] Finalization token mismatch for resume ${resumeId}. Update affected 0 rows.`
    );
    return { success: false, rowCount: 0, reason: 'TOKEN_MISMATCH' };
  } catch (dbErr) {
    console.error(
      `[PROCESSOR] Database error during finalization for resume ${resumeId}: ${dbErr.message}`
    );

    // Retry once using the exact same token-fenced query
    try {
      console.info(`[PROCESSOR] Retrying finalization once for resume ${resumeId}...`);
      const retryResult = await queryFn(updateQuery, params);
      if (retryResult.rowCount === 1) {
        return { success: true, rowCount: 1 };
      }

      // Retry returned rowCount = 0. Perform token-safe verification check.
      // Did Query 1 commit before the socket error, or was the row superseded?
      // NOTE: Single-instance heuristic inference. Does not claim distributed proof.
      const verifyResult = await queryFn(
        `SELECT extraction_status, processing_token, processing_completed_at FROM resumes WHERE resume_id = $1;`,
        [resumeId]
      );

      if (verifyResult.rowCount > 0) {
        const vRow = verifyResult.rows[0];
        const isRecent =
          vRow.processing_completed_at &&
          Math.abs(Date.now() - new Date(vRow.processing_completed_at).getTime()) < 60000;

        // Only infer commit if token is NULL, status matches intended target status, and completion was recent
        if (vRow.processing_token === null && vRow.extraction_status === status && isRecent) {
          console.info(
            `[PROCESSOR] Verification inferred Query 1 committed before network disruption for resume ${resumeId}.`
          );
          return { success: true, rowCount: 1, verifiedIndirectly: true };
        }
      }

      return { success: false, rowCount: 0, reason: 'TOKEN_MISMATCH_ON_RETRY' };
    } catch (retryErr) {
      console.error(
        `[PROCESSOR] [CRITICAL] Persistent database failure during finalization for resume ${resumeId}: ${retryErr.message}`
      );
      throw new ExtractionError(
        'INTERNAL_SERVER_ERROR',
        'Database finalization failed due to a persistent server error.',
        500
      );
    }
  }
};

/**
 * Synchronously process text extraction for a resume.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.resumeId
 * @param {object} [params.options={}]
 * @param {number} [params.options.currentTimeMs] - Injected timestamp for deterministic testing
 * @param {number} [params.options.timeoutMs] - Extraction timeout deadline (default 10s)
 * @param {object} [params.options.semaphore=extractionSemaphore] - Semaphore instance
 * @returns {Promise<object>} Extracted text data
 */
export const processResume = async ({ userId, resumeId, options = {} }) => {
  const activeSemaphore = options.semaphore || extractionSemaphore;
  const currentTimeMs = options.currentTimeMs || Date.now();
  const timeoutMs = options.timeoutMs ?? EXTRACTION_LIMITS.DEFAULT_TIMEOUT_MS;

  // ==========================================================================
  // Step 1: Pre-checks (Ownership, Completed, Processing, Max Attempts, Cooldown)
  // These checks execute BEFORE touching the semaphore to prevent permit starvation.
  // ==========================================================================
  await ensureSchema();
  const preCheckQuery = `
    SELECT
      resume_id,
      user_id,
      file_path,
      file_data,
      mime_type,
      extraction_status,
      processing_attempts,
      processing_error_code,
      processing_completed_at
    FROM resumes
    WHERE resume_id = $1;
  `;

  const preCheckResult = await query(preCheckQuery, [resumeId]);

  // IDOR & Privacy check: return 404 uniformly if missing or not owned by user
  if (preCheckResult.rowCount === 0 || preCheckResult.rows[0].user_id !== userId) {
    throw new ExtractionError('RESUME_NOT_FOUND', 'Resume not found.', 404);
  }

  const resume = preCheckResult.rows[0];

  // Already completed check
  if (resume.extraction_status === 'COMPLETED') {
    throw new ExtractionError(
      'RESUME_ALREADY_COMPLETED',
      'Resume text has already been successfully extracted.',
      400,
      { resumeId, extractionStatus: 'COMPLETED', canRetry: false }
    );
  }

  // Already processing check
  if (resume.extraction_status === 'PROCESSING') {
    throw new ExtractionError(
      'RESUME_ALREADY_PROCESSING',
      'Resume is currently being processed by another request.',
      409,
      {
        resumeId,
        extractionStatus: 'PROCESSING',
        processingAttempts: resume.processing_attempts,
      }
    );
  }

  // Maximum attempts precedence check: permanently locks if >= 3
  if (resume.processing_attempts >= 3) {
    throw new ExtractionError(
      'MAX_PROCESSING_ATTEMPTS_EXCEEDED',
      'Resume has reached the maximum allowed processing attempts (3).',
      422,
      {
        resumeId,
        extractionStatus: resume.extraction_status,
        processingAttempts: resume.processing_attempts,
        canRetry: false,
      }
    );
  }

  // Timeout cooldown check: checked before semaphore acquisition
  if (resume.processing_error_code === 'EXTRACTION_TIMEOUT') {
    const remainingSeconds = calculateCooldownSeconds(
      resume.processing_completed_at,
      currentTimeMs,
      10
    );
    if (remainingSeconds > 0) {
      throw new ExtractionError(
        'RETRY_COOLDOWN_ACTIVE',
        'Retry cooldown is active for this resume. Please wait before retrying.',
        429,
        {
          resumeId,
          extractionStatus: resume.extraction_status,
          processingAttempts: resume.processing_attempts,
          retryAfterSeconds: remainingSeconds,
          canRetry: true,
        }
      );
    }
  }

  // ==========================================================================
  // Step 2: Semaphore Permit Acquisition
  // Occurs strictly after pre-checks and before the database atomic claim.
  // ==========================================================================
  const permitHandle = activeSemaphore.tryAcquire(resumeId);
  if (!permitHandle) {
    throw new ExtractionError(
      'EXTRACTION_CONCURRENCY_EXCEEDED',
      'Server is currently at maximum extraction capacity. Please try again shortly.',
      503,
      { retryAfterSeconds: 5 }
    );
  }

  let processingToken = null;
  let attemptsCount = resume.processing_attempts + 1;

  try {
    // ========================================================================
    // Step 3: Atomic Database Claim
    // ========================================================================
    const claimQuery = `
      UPDATE resumes
      SET extraction_status = 'PROCESSING',
          processing_token = gen_random_uuid(),
          processing_started_at = CURRENT_TIMESTAMP,
          processing_completed_at = NULL,
          processing_error_code = NULL,
          processing_error_message = NULL,
          processing_attempts = processing_attempts + 1,
          extracted_text = NULL
      WHERE resume_id = $1
        AND user_id = $2
        AND extraction_status IN ('PENDING', 'FAILED')
        AND processing_attempts < 3
      RETURNING processing_token, processing_attempts;
    `;

    const claimResult = await query(claimQuery, [resumeId, userId]);

    if (claimResult.rowCount === 0) {
      // Step 3b: Atomic claim lost race! Release permit immediately before fallback re-query.
      permitHandle.releasePermit('CLAIM_RACE_FAILURE');

      // Fallback re-query to classify exact race outcome
      const fallbackQuery = `
        SELECT
          resume_id,
          user_id,
          extraction_status,
          processing_attempts,
          processing_error_code,
          processing_completed_at
        FROM resumes
        WHERE resume_id = $1 AND user_id = $2;
      `;

      let fallbackResult;
      try {
        fallbackResult = await query(fallbackQuery, [resumeId, userId]);
      } catch (fbErr) {
        throw new ExtractionError(
          'INTERNAL_SERVER_ERROR',
          'An unexpected error occurred while verifying resume state.',
          500
        );
      }

      if (fallbackResult.rowCount === 0) {
        throw new ExtractionError('RESUME_NOT_FOUND', 'Resume not found.', 404);
      }

      const fbRow = fallbackResult.rows[0];

      if (fbRow.extraction_status === 'COMPLETED') {
        throw new ExtractionError(
          'RESUME_ALREADY_COMPLETED',
          'Resume text has already been successfully extracted.',
          400,
          { resumeId, extractionStatus: 'COMPLETED', canRetry: false }
        );
      }

      if (fbRow.extraction_status === 'PROCESSING') {
        throw new ExtractionError(
          'RESUME_ALREADY_PROCESSING',
          'Resume is currently being processed by another request.',
          409,
          {
            resumeId,
            extractionStatus: 'PROCESSING',
            processingAttempts: fbRow.processing_attempts,
          }
        );
      }

      if (fbRow.processing_attempts >= 3) {
        throw new ExtractionError(
          'MAX_PROCESSING_ATTEMPTS_EXCEEDED',
          'Resume has reached the maximum allowed processing attempts (3).',
          422,
          {
            resumeId,
            extractionStatus: fbRow.extraction_status,
            processingAttempts: fbRow.processing_attempts,
            canRetry: false,
          }
        );
      }

      if (fbRow.processing_error_code === 'EXTRACTION_TIMEOUT') {
        const rem = calculateCooldownSeconds(
          fbRow.processing_completed_at,
          currentTimeMs,
          10
        );
        if (rem > 0) {
          throw new ExtractionError(
            'RETRY_COOLDOWN_ACTIVE',
            'Retry cooldown is active for this resume. Please wait before retrying.',
            429,
            {
              resumeId,
              extractionStatus: fbRow.extraction_status,
              processingAttempts: fbRow.processing_attempts,
              retryAfterSeconds: rem,
              canRetry: true,
            }
          );
        }
      }

      throw new ExtractionError(
        'RESUME_CLAIM_CONFLICT',
        'Concurrent state conflict while claiming resume. Please retry.',
        409,
        { resumeId, canRetry: true }
      );
    }

    // Claim successfully granted!
    processingToken = claimResult.rows[0].processing_token;
    attemptsCount = claimResult.rows[0].processing_attempts;

    // ========================================================================
    // Step 4: Read File from Database or Storage and Execute Extraction
    // ========================================================================
    let fileBuffer = resume.file_data;
    if (!fileBuffer || fileBuffer.length === 0) {
      try {
        fileBuffer = await storageService.readFileBuffer(resume.file_path);
      } catch (storageErr) {
        if (storageErr.code === 'STORAGE_READ_ERROR' || storageErr.code === 'ENOENT') {
          const userErr = new ExtractionError(
            'FILE_NOT_FOUND',
            'Document file is no longer available in server cache. Please re-upload your resume.',
            404,
            { resumeId, canRetry: false }
          );
          throw userErr;
        }
        throw storageErr;
      }
    }

    let extracted;
    const isDocx =
      resume.mime_type.includes('word') ||
      resume.file_path.toLowerCase().endsWith('.docx');

    if (isDocx) {
      extracted = await extractTextFromDocx(fileBuffer);
    } else {
      extracted = await extractTextFromPdf(fileBuffer, { timeoutMs });
    }

    if (options.extractionDelayMs) {
      await new Promise((r) => setTimeout(r, options.extractionDelayMs));
    }

    // ========================================================================
    // Step 5: Successful Finalization (Token-Fenced)
    // ========================================================================
    await finalizeAttempt({
      resumeId,
      token: processingToken,
      status: 'COMPLETED',
      text: extracted.text,
      errorCode: null,
      errorMessage: null,
    });

    return {
      resumeId,
      extractionStatus: 'COMPLETED',
      extractedText: extracted.text,
      characterCount: extracted.characterCount,
      wordCount: extracted.wordCount,
      processingAttempts: attemptsCount,
      processingCompletedAt: new Date().toISOString(),
    };
  } catch (err) {
    // If an error occurred after acquiring the claim, finalize as FAILED
    if (processingToken) {
      const errorCode = err.code || 'EXTRACTION_FAILED';
      const errorMessage = err.message || 'An unexpected error occurred during extraction.';

      try {
        await finalizeAttempt({
          resumeId,
          token: processingToken,
          status: 'FAILED',
          text: null,
          errorCode,
          errorMessage,
        });
      } catch (finalErr) {
        console.error(
          `[PROCESSOR] Failed to record failure state for resume ${resumeId}: ${finalErr.message}`
        );
      }

      // Add attempt metadata to error details
      const canRetry =
        attemptsCount < 3 &&
        errorCode !== 'TEXT_LIMIT_EXCEEDED' &&
        errorCode !== 'DECOMPRESSION_LIMIT_EXCEEDED' &&
        errorCode !== 'ARCHIVE_SIZE_LIMIT_EXCEEDED' &&
        errorCode !== 'UNSAFE_XML_DECLARATION';

      if (err instanceof ExtractionError) {
        err.details = {
          resumeId,
          extractionStatus: 'FAILED',
          processingAttempts: attemptsCount,
          canRetry,
          ...(errorCode === 'EXTRACTION_TIMEOUT' && { retryAfterSeconds: 10 }),
        };
      }
    }

    throw err;
  } finally {
    // Exactly-once settlement: decrements unsettledTasks and releases permit if not already released
    permitHandle.settleTask();
  }
};

/**
 * Startup Recovery Runner
 * Executes strictly once during server boot before HTTP listener opens.
 *
 * NOTE: Designed strictly for Single-Instance MVP.
 * In multi-instance or rolling deployments, this requires distributed leases.
 *
 * @returns {Promise<{ recoveredCount: number }>}
 */
export const runStartupRecovery = async () => {
  console.warn(
    '[WARN] [RECOVERY] Running single-instance startup recovery. Resetting orphaned PROCESSING records to FAILED.'
  );
  console.warn(
    '[WARN] [RECOVERY] Do NOT run in multi-instance, clustered, or rolling-deployment environments without distributed lease locks.'
  );

  const startupQuery = `
    UPDATE resumes
    SET extraction_status = 'FAILED',
        processing_error_code = 'SERVER_RESTARTED',
        processing_error_message = 'Extraction was interrupted by a server restart.',
        processing_completed_at = CURRENT_TIMESTAMP,
        processing_token = NULL,
        extracted_text = NULL
    WHERE extraction_status = 'PROCESSING';
  `;

  const result = await query(startupQuery);
  if (result.rowCount > 0) {
    console.info(
      `[RECOVERY] Startup recovery reset ${result.rowCount} orphaned PROCESSING resume(s) to FAILED.`
    );
  }
  return { recoveredCount: result.rowCount };
};

/**
 * Periodic Stale Recovery Runner
 * Runs on a timer to recover tasks abandoned for more than 5 minutes.
 * Guarded by an in-memory lock to prevent overlapping runs.
 */
let isStaleRecoveryRunning = false;

export const runStaleRecovery = async () => {
  if (isStaleRecoveryRunning) {
    return { skipped: true, recoveredCount: 0 };
  }

  isStaleRecoveryRunning = true;
  try {
    const staleQuery = `
      UPDATE resumes
      SET extraction_status = 'FAILED',
          processing_error_code = 'STALE_PROCESSING_TIMEOUT',
          processing_error_message = 'Extraction exceeded the maximum processing duration and was marked stale.',
          processing_completed_at = CURRENT_TIMESTAMP,
          processing_token = NULL,
          extracted_text = NULL
      WHERE extraction_status = 'PROCESSING'
        AND processing_started_at < NOW() - INTERVAL '5 minutes';
    `;

    const result = await query(staleQuery);
    if (result.rowCount > 0) {
      console.info(
        `[RECOVERY] Stale recovery reclaimed ${result.rowCount} abandoned resume(s).`
      );
    }
    return { skipped: false, recoveredCount: result.rowCount };
  } finally {
    isStaleRecoveryRunning = false;
  }
};

export default {
  calculateCooldownSeconds,
  getResumeProcessingStatus,
  finalizeAttempt,
  processResume,
  runStartupRecovery,
  runStaleRecovery,
};
