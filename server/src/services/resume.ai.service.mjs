/**
 * AI-Powered Resume Understanding Service (Stage 2)
 *
 * Coordinates consent verification, cache freshness checks, AI generation,
 * evidence grounding, and non-destructive JSONB persistence.
 */

import { query } from '../config/database.mjs';
import config from '../config/env.mjs';
import { computeFileHash } from '../utils/file.util.mjs';
import {
  generateResumeUnderstanding,
  generateResumeJobComparison as callGenerateResumeJobComparison,
  isGeminiConfigured,
} from './gemini.service.mjs';
import { createAnalysis, getAnalysisById } from './analysis.service.mjs';
import { AI_PROFILE_LIMITS } from '../validators/resume.ai.validator.mjs';

export const AI_DISCLOSURE_VERSION = '2026-10-02';
export const AI_COMPARISON_CACHE_VERSION = '1.1';

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

/**
 * Generate a new contextual AI comparison between a resume and job description,
 * or return a valid cached comparison (Stage 3).
 *
 * @param {object} params
 * @param {string} params.userId - Authenticated user UUID
 * @param {string} params.resumeId - Target resume UUID
 * @param {string} params.jobId - Target job description UUID
 * @param {boolean} params.consent - Explicit user consent flag
 * @param {boolean} [params.forceRefresh=false] - Whether to bypass cache and regenerate
 * @param {object} [params.clientOverride=null] - Mock client injection for tests
 * @returns {Promise<object>} Complete contextual comparison record with deterministic facts
 */
export const generateResumeJobComparison = async ({
  userId,
  resumeId,
  jobId,
  consent,
  forceRefresh = false,
  clientOverride = null,
}) => {
  // 1. Enforce explicit user opt-in consent
  if (consent !== true) {
    const err = new Error(
      'Explicit consent is required to process resume and job text with Google Gemini AI.'
    );
    err.code = 'CONSENT_REQUIRED';
    err.statusCode = 400;
    throw err;
  }

  // 2. Fetch resume with ownership verification
  const resumeRes = await query(
    `SELECT resume_id, user_id, file_name, extracted_text, extracted_data, extraction_status
     FROM resumes
     WHERE resume_id = $1 AND user_id = $2`,
    [resumeId, userId]
  );

  if (resumeRes.rowCount === 0) {
    const err = new Error('Resume not found');
    err.code = 'RESOURCE_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const resume = resumeRes.rows[0];

  // 3. Verify resume extraction state guards
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

  const rawResumeText = resume.extracted_text || '';
  if (rawResumeText.trim().length < AI_PROFILE_LIMITS.MIN_INPUT_TEXT_LENGTH) {
    const err = new Error('Resume has no extractable text content to analyze with AI.');
    err.code = 'RESUME_NO_TEXT';
    err.statusCode = 422;
    throw err;
  }

  if (rawResumeText.length > AI_PROFILE_LIMITS.MAX_INPUT_TEXT_LENGTH) {
    const err = new Error(
      `Resume text exceeds maximum limit of ${AI_PROFILE_LIMITS.MAX_INPUT_TEXT_LENGTH} characters.`
    );
    err.code = 'RESUME_TEXT_TOO_LONG';
    err.statusCode = 422;
    throw err;
  }

  // 4. Fetch job description with ownership verification
  const jobRes = await query(
    `SELECT job_id, user_id, title, description, extracted_data
     FROM job_descriptions
     WHERE job_id = $1 AND user_id = $2`,
    [jobId, userId]
  );

  if (jobRes.rowCount === 0) {
    const err = new Error('Job description not found');
    err.code = 'RESOURCE_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const job = jobRes.rows[0];

  if (job.extracted_data === null || job.extracted_data === undefined) {
    const err = new Error(
      'Job description skill extraction data is unavailable. Please run skill extraction on this job description before comparing.'
    );
    err.code = 'JOB_EXTRACTION_UNAVAILABLE';
    err.statusCode = 422;
    throw err;
  }

  // 5. Establish/Fetch deterministic analysis baseline
  let analysisRecord = null;
  const existingAnalysisRes = await query(
    `SELECT analysis_id FROM analyses
     WHERE user_id = $1 AND resume_id = $2 AND job_id = $3
     ORDER BY created_at DESC LIMIT 1`,
    [userId, resumeId, jobId]
  );

  if (existingAnalysisRes.rowCount > 0) {
    analysisRecord = await getAnalysisById({
      userId,
      analysisId: existingAnalysisRes.rows[0].analysis_id,
    });
  } else {
    analysisRecord = await createAnalysis({
      userId,
      resumeId,
      jobId,
    });
  }

  const deterministicMatch = {
    analysis_id: analysisRecord.analysis_id,
    overall_score: Number(analysisRecord.overall_score),
    skill_score: Number(analysisRecord.skill_score),
    matched_required_count: analysisRecord.summary?.matched_required_count ?? 0,
    missing_required_count: analysisRecord.summary?.missing_required_count ?? 0,
    matched_preferred_count: analysisRecord.summary?.matched_preferred_count ?? 0,
    missing_preferred_count: analysisRecord.summary?.missing_preferred_count ?? 0,
    required_skills_matched: (analysisRecord.skills || [])
      .filter((s) => s.requirement_type === 'REQUIRED' && s.status === 'MATCHED')
      .map((s) => s.skill_name),
    required_skills_missing: (analysisRecord.skills || [])
      .filter((s) => s.requirement_type === 'REQUIRED' && s.status === 'MISSING')
      .map((s) => s.skill_name),
    preferred_skills_matched: (analysisRecord.skills || [])
      .filter((s) => s.requirement_type === 'PREFERRED' && s.status === 'MATCHED')
      .map((s) => s.skill_name),
    preferred_skills_missing: (analysisRecord.skills || [])
      .filter((s) => s.requirement_type === 'PREFERRED' && s.status === 'MISSING')
      .map((s) => s.skill_name),
  };

  // 6. Cache Freshness & Version Check (Stage 3.1: requires AI_COMPARISON_CACHE_VERSION)
  const currentResumeHash = computeFileHash(Buffer.from(rawResumeText, 'utf8'));
  const currentJobHash = computeFileHash(Buffer.from(job.title + '\n' + job.description, 'utf8'));
  const existingComparison = resume.extracted_data?.ai_job_comparisons?.[jobId];

  if (
    !forceRefresh &&
    existingComparison &&
    existingComparison.version === AI_COMPARISON_CACHE_VERSION &&
    existingComparison.resume_source_hash === currentResumeHash &&
    existingComparison.job_source_hash === currentJobHash &&
    existingComparison.comparison
  ) {
    return {
      ...existingComparison,
      resume_id: resumeId,
      job_id: jobId,
      cached: true,
    };
  }

  // 7. Feature Gate Check (unless a mock client is injected)
  if (!clientOverride && !isGeminiConfigured()) {
    const err = new Error(
      'Gemini AI features are currently disabled or unconfigured on this server.'
    );
    err.code = 'AI_SERVICE_UNAVAILABLE';
    err.statusCode = 503;
    throw err;
  }

  // 8. Execute AI Contextual Job-to-Resume Comparison
  const groundedComparison = await callGenerateResumeJobComparison({
    resumeText: rawResumeText,
    jobTitle: job.title,
    jobDescription: job.description,
    deterministicResults: deterministicMatch,
    clientOverride,
  });

  // 9. Assemble Structured Persistence Container
  const now = new Date().toISOString();
  const comparisonRecord = {
    version: AI_COMPARISON_CACHE_VERSION,
    is_ai_generated: true,
    model: config.geminiModel,
    generated_at: now,
    consent_recorded_at: now,
    consent_disclosure_version: AI_DISCLOSURE_VERSION,
    resume_source_hash: currentResumeHash,
    job_source_hash: currentJobHash,
    analysis_id: analysisRecord.analysis_id,
    deterministic_match: deterministicMatch,
    comparison: groundedComparison,
  };

  // 10. Atomic Non-Destructive JSONB Update
  // Sets or updates extracted_data.ai_job_comparisons[jobId]
  await query(
    `UPDATE resumes
     SET extracted_data = jsonb_set(
       CASE
         WHEN extracted_data ? 'ai_job_comparisons' THEN extracted_data
         ELSE COALESCE(extracted_data, '{}'::jsonb) || '{"ai_job_comparisons": {}}'::jsonb
       END,
       ARRAY['ai_job_comparisons', $1::text],
       $2::jsonb,
       true
     ),
     updated_at = CURRENT_TIMESTAMP
     WHERE resume_id = $3 AND user_id = $4`,
    [jobId, JSON.stringify(comparisonRecord), resumeId, userId]
  );

  return {
    ...comparisonRecord,
    resume_id: resumeId,
    job_id: jobId,
    cached: false,
  };
};

/**
 * Retrieve cached AI contextual job-to-resume comparison.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.resumeId
 * @param {string} params.jobId
 * @returns {Promise<object>} Cached AI job comparison
 */
export const getResumeJobComparison = async ({ userId, resumeId, jobId }) => {
  const resumeRes = await query(
    `SELECT resume_id, user_id, extracted_text, extracted_data, extraction_status
     FROM resumes
     WHERE resume_id = $1 AND user_id = $2`,
    [resumeId, userId]
  );

  if (resumeRes.rowCount === 0) {
    const err = new Error('Resume not found');
    err.code = 'RESOURCE_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const jobRes = await query(
    `SELECT job_id, user_id, title, description
     FROM job_descriptions
     WHERE job_id = $1 AND user_id = $2`,
    [jobId, userId]
  );

  if (jobRes.rowCount === 0) {
    const err = new Error('Job description not found');
    err.code = 'RESOURCE_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const resume = resumeRes.rows[0];
  const job = jobRes.rows[0];
  const comparison = resume.extracted_data?.ai_job_comparisons?.[jobId];

  if (!comparison || !comparison.comparison) {
    const err = new Error(
      'No AI comparison has been generated for this resume and job description yet. Request generation via POST /api/resumes/:resumeId/ai-job-comparison.'
    );
    err.code = 'AI_COMPARISON_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  // Cache Version Check (Stage 3.1: requires AI_COMPARISON_CACHE_VERSION)
  if (comparison.version !== AI_COMPARISON_CACHE_VERSION) {
    const err = new Error(
      'The cached AI comparison was generated under an older schema version and lacks Stage 3.1 claim provenance. Please regenerate via POST /api/resumes/:resumeId/ai-job-comparison.'
    );
    err.code = 'AI_COMPARISON_STALE';
    err.statusCode = 404;
    throw err;
  }

  // Cache Stale Invalidation Check
  const currentResumeHash = computeFileHash(Buffer.from(resume.extracted_text || '', 'utf8'));
  const currentJobHash = computeFileHash(Buffer.from(job.title + '\n' + job.description, 'utf8'));

  if (
    comparison.resume_source_hash !== currentResumeHash ||
    comparison.job_source_hash !== currentJobHash
  ) {
    const err = new Error(
      'The cached AI comparison is stale because the resume or job description has changed. Please regenerate via POST /api/resumes/:resumeId/ai-job-comparison.'
    );
    err.code = 'AI_COMPARISON_STALE';
    err.statusCode = 404;
    throw err;
  }

  return {
    ...comparison,
    resume_id: resumeId,
    job_id: jobId,
    cached: true,
  };
};

export default {
  AI_DISCLOSURE_VERSION,
  AI_COMPARISON_CACHE_VERSION,
  generateResumeAiProfile,
  getResumeAiProfile,
  generateResumeJobComparison,
  getResumeJobComparison,
};
