/**
 * AI-Powered Resume Understanding Service (Stage 2)
 *
 * Coordinates consent verification, cache freshness checks, AI generation,
 * evidence grounding, and non-destructive JSONB persistence.
 */

import { query } from '../config/database.mjs';
import config from '../config/env.mjs';
import { computeFileHash } from '../utils/file.util.mjs';
import { generateResumeUnderstanding, isGeminiConfigured } from './gemini.service.mjs';
import { AI_PROFILE_LIMITS } from '../validators/resume.ai.validator.mjs';

export const AI_DISCLOSURE_VERSION = '2026-10-02';

/**
 * Generate a new AI resume understanding profile or return valid cached profile.
 *
 * @param {object} params
 * @param {string} params.userId - Authenticated user UUID
 * @param {string} params.resumeId - Target resume UUID
 * @param {boolean} params.consent - Explicit user consent flag
 * @param {boolean} [params.forceRefresh=false] - Whether to bypass cache and regenerate
 * @param {object} [params.clientOverride=null] - Mock client injection for tests
 * @returns {Promise<object>} Complete AI profile record
 */
export const generateResumeAiProfile = async ({
  userId,
  resumeId,
  consent,
  forceRefresh = false,
  clientOverride = null,
}) => {
  // 1. Enforce explicit user opt-in consent
  if (consent !== true) {
    const err = new Error(
      'Explicit consent is required to process resume text with Google Gemini AI.'
    );
    err.code = 'CONSENT_REQUIRED';
    err.statusCode = 400;
    throw err;
  }

  // 2. Fetch resume with ownership verification
  const selectRes = await query(
    `SELECT resume_id, user_id, file_name, extracted_text, extracted_data, extraction_status
     FROM resumes
     WHERE resume_id = $1 AND user_id = $2`,
    [resumeId, userId]
  );

  if (selectRes.rowCount === 0) {
    const err = new Error('Resume not found');
    err.code = 'RESOURCE_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const resume = selectRes.rows[0];

  // 3. Verify extraction state guards
  if (resume.extraction_status === 'PENDING' || resume.extraction_status === 'PROCESSING') {
    const err = new Error(
      'Resume text extraction is not complete. Please retry after text extraction completes.'
    );
    err.code = 'RESUME_NOT_PROCESSED';
    err.statusCode = 409;
    throw err;
  }

  if (resume.extraction_status === 'FAILED') {
    const err = new Error(
      'Resume text extraction failed. Please re-upload or re-process the resume.'
    );
    err.code = 'RESUME_PROCESSING_FAILED';
    err.statusCode = 422;
    throw err;
  }

  const rawText = resume.extracted_text || '';
  if (rawText.trim().length < AI_PROFILE_LIMITS.MIN_INPUT_TEXT_LENGTH) {
    const err = new Error('Resume has no extractable text content to analyze with AI.');
    err.code = 'RESUME_NO_TEXT';
    err.statusCode = 422;
    throw err;
  }

  if (rawText.length > AI_PROFILE_LIMITS.MAX_INPUT_TEXT_LENGTH) {
    const err = new Error(
      `Resume text exceeds maximum limit of ${AI_PROFILE_LIMITS.MAX_INPUT_TEXT_LENGTH} characters.`
    );
    err.code = 'RESUME_TEXT_TOO_LONG';
    err.statusCode = 422;
    throw err;
  }

  // 4. Cache Freshness Check
  const currentTextHash = computeFileHash(Buffer.from(rawText, 'utf8'));
  const existingAiProfile = resume.extracted_data?.ai_profile;

  if (
    !forceRefresh &&
    existingAiProfile &&
    existingAiProfile.source_text_hash === currentTextHash &&
    existingAiProfile.profile
  ) {
    return {
      ...existingAiProfile,
      resume_id: resumeId,
      cached: true,
    };
  }

  // 5. Feature Gate Check (unless a mock client is injected)
  if (!clientOverride && !isGeminiConfigured()) {
    const err = new Error(
      'Gemini AI features are currently disabled or unconfigured on this server.'
    );
    err.code = 'AI_SERVICE_UNAVAILABLE';
    err.statusCode = 503;
    throw err;
  }

  // 6. Execute AI Resume Understanding
  const groundedProfile = await generateResumeUnderstanding({
    resumeText: rawText,
    clientOverride,
  });

  // 7. Assemble Structured Persistence Container
  const now = new Date().toISOString();
  const aiProfileRecord = {
    version: '1.0',
    is_ai_generated: true,
    model: config.geminiModel,
    generated_at: now,
    consent_recorded_at: now,
    consent_disclosure_version: AI_DISCLOSURE_VERSION,
    source_text_hash: currentTextHash,
    profile: groundedProfile,
  };

  // 8. Atomic Non-Destructive JSONB Update
  // Uses PostgreSQL || operator to shallow-merge top-level JSONB keys, preserving all other existing keys
  await query(
    `UPDATE resumes
     SET extracted_data = COALESCE(extracted_data, '{}'::jsonb) || jsonb_build_object('ai_profile', $1::jsonb),
         updated_at = CURRENT_TIMESTAMP
     WHERE resume_id = $2 AND user_id = $3`,
    [JSON.stringify(aiProfileRecord), resumeId, userId]
  );

  return {
    ...aiProfileRecord,
    resume_id: resumeId,
    cached: false,
  };
};

/**
 * Retrieve cached AI resume understanding profile.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.resumeId
 * @returns {Promise<object>} Cached AI profile
 */
export const getResumeAiProfile = async ({ userId, resumeId }) => {
  const selectRes = await query(
    `SELECT resume_id, user_id, extracted_text, extracted_data, extraction_status
     FROM resumes
     WHERE resume_id = $1 AND user_id = $2`,
    [resumeId, userId]
  );

  if (selectRes.rowCount === 0) {
    const err = new Error('Resume not found');
    err.code = 'RESOURCE_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const resume = selectRes.rows[0];
  const aiProfile = resume.extracted_data?.ai_profile;

  if (!aiProfile || !aiProfile.profile) {
    const err = new Error(
      'No AI profile has been generated for this resume yet. Request generation via POST /api/resumes/:resumeId/ai-profile.'
    );
    err.code = 'AI_PROFILE_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  // Cache Stale Invalidation Check
  const currentTextHash = computeFileHash(Buffer.from(resume.extracted_text || '', 'utf8'));
  if (aiProfile.source_text_hash !== currentTextHash) {
    const err = new Error(
      'The cached AI profile is stale because the resume text has changed. Please regenerate via POST /api/resumes/:resumeId/ai-profile.'
    );
    err.code = 'AI_PROFILE_STALE';
    err.statusCode = 404;
    throw err;
  }

  return {
    ...aiProfile,
    resume_id: resumeId,
    cached: true,
  };
};

export default {
  AI_DISCLOSURE_VERSION,
  generateResumeAiProfile,
  getResumeAiProfile,
};
