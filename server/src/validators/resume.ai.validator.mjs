/**
 * Zod Validation Schemas for AI-Powered Resume Understanding (Stage 2)
 */

import { z } from 'zod';

// Maximum size limits to guard against oversized payloads
export const AI_PROFILE_LIMITS = {
  MAX_INPUT_TEXT_LENGTH: 50000,
  MIN_INPUT_TEXT_LENGTH: 50,
  MAX_SUMMARY_LENGTH: 1000,
  MAX_ITEMS_PER_SECTION: 100,
  MAX_STRING_LENGTH: 200,
  MAX_EVIDENCE_LENGTH: 400,
  MIN_EVIDENCE_LENGTH: 3,
};

/**
 * Request schema for POST /api/resumes/:resumeId/ai-profile
 */
export const aiProfileRequestSchema = z.object({
  consent: z.literal(true, {
    errorMap: () => ({
      message: 'Explicit consent is required to process resume text with Gemini AI.',
    }),
  }),
  force_refresh: z.boolean().optional().default(false),
});

/**
 * Resume ID parameter schema
 */
export const resumeIdParamSchema = z.object({
  resumeId: z.string().uuid({ message: 'Invalid resumeId parameter. Must be a valid UUID' }),
});

/**
 * Supporting evidence snippet schema
 */
const evidenceSnippetSchema = z
  .string()
  .min(AI_PROFILE_LIMITS.MIN_EVIDENCE_LENGTH, 'Evidence snippet must have at least 3 characters')
  .max(AI_PROFILE_LIMITS.MAX_EVIDENCE_LENGTH, 'Evidence snippet exceeds maximum allowed length')
  .trim();

/**
 * Technical skill schema
 */
export const technicalSkillSchema = z.object({
  name: z.string().min(1).max(AI_PROFILE_LIMITS.MAX_STRING_LENGTH).trim(),
  category: z.enum([
    'PROGRAMMING_LANGUAGE',
    'FRAMEWORK_OR_LIBRARY',
    'DATABASE',
    'CLOUD_AND_DEVOPS',
    'TOOL_OR_UTILITY',
    'METHODOLOGY',
    'TECHNICAL_OTHER',
  ]).default('TECHNICAL_OTHER'),
  evidence_snippet: evidenceSnippetSchema,
  verification_status: z.enum(['VERIFIED', 'UNVERIFIED']).default('VERIFIED'),
  unverified_reason: z.string().nullable().default(null),
});

/**
 * Soft skill schema
 */
export const softSkillSchema = z.object({
  name: z.string().min(1).max(AI_PROFILE_LIMITS.MAX_STRING_LENGTH).trim(),
  evidence_snippet: evidenceSnippetSchema,
  verification_status: z.enum(['VERIFIED', 'UNVERIFIED']).default('VERIFIED'),
  unverified_reason: z.string().nullable().default(null),
});

/**
 * Professional summary grounded schema
 */
export const professionalSummarySchema = z.object({
  text: z.string().max(AI_PROFILE_LIMITS.MAX_SUMMARY_LENGTH).trim(),
  evidence_snippet: z
    .string()
    .max(AI_PROFILE_LIMITS.MAX_EVIDENCE_LENGTH)
    .nullable()
    .default(null),
  verification_status: z.enum(['VERIFIED', 'UNVERIFIED']).default('UNVERIFIED'),
  unverified_reason: z.string().nullable().default(null),
});

/**
 * Education item schema
 */
export const educationItemSchema = z.object({
  institution: z.string().min(1).max(AI_PROFILE_LIMITS.MAX_STRING_LENGTH).trim(),
  degree: z.string().max(AI_PROFILE_LIMITS.MAX_STRING_LENGTH).nullable().default(null),
  field_of_study: z.string().max(AI_PROFILE_LIMITS.MAX_STRING_LENGTH).nullable().default(null),
  start_year: z.string().max(30).nullable().default(null),
  graduation_year: z.string().max(30).nullable().default(null),
  gpa_or_grade: z.string().max(50).nullable().default(null),
  evidence_snippet: evidenceSnippetSchema,
  verification_status: z.enum(['VERIFIED', 'UNVERIFIED']).default('VERIFIED'),
  unverified_reason: z.string().nullable().default(null),
  field_verification: z
    .record(z.enum(['VERIFIED', 'UNVERIFIED']))
    .optional()
    .default({}),
  unverified_fields: z.array(z.string()).optional().default([]),
});

/**
 * Work experience item schema
 */
export const workExperienceItemSchema = z.object({
  organization: z.string().min(1).max(AI_PROFILE_LIMITS.MAX_STRING_LENGTH).trim(),
  role: z.string().min(1).max(AI_PROFILE_LIMITS.MAX_STRING_LENGTH).trim(),
  location: z.string().max(AI_PROFILE_LIMITS.MAX_STRING_LENGTH).nullable().default(null),
  start_date: z.string().max(50).nullable().default(null),
  end_date: z.string().max(50).nullable().default(null),
  is_current: z.boolean().default(false),
  is_internship: z.boolean().default(false),
  key_responsibilities: z
    .array(z.string().max(500).trim())
    .max(AI_PROFILE_LIMITS.MAX_ITEMS_PER_SECTION)
    .default([]),
  quantified_achievements: z
    .array(z.string().max(500).trim())
    .max(AI_PROFILE_LIMITS.MAX_ITEMS_PER_SECTION)
    .default([]),
  evidence_snippet: evidenceSnippetSchema,
  verification_status: z.enum(['VERIFIED', 'UNVERIFIED']).default('VERIFIED'),
  unverified_reason: z.string().nullable().default(null),
  field_verification: z
    .record(z.enum(['VERIFIED', 'UNVERIFIED']))
    .optional()
    .default({}),
  unverified_fields: z.array(z.string()).optional().default([]),
});

/**
 * Project item schema
 */
export const projectItemSchema = z.object({
  name: z.string().min(1).max(AI_PROFILE_LIMITS.MAX_STRING_LENGTH).trim(),
  description: z.string().max(1000).trim(),
  technologies_used: z
    .array(z.string().max(100).trim())
    .max(AI_PROFILE_LIMITS.MAX_ITEMS_PER_SECTION)
    .default([]),
  link_or_url: z.string().max(300).nullable().default(null),
  evidence_snippet: evidenceSnippetSchema,
  verification_status: z.enum(['VERIFIED', 'UNVERIFIED']).default('VERIFIED'),
  unverified_reason: z.string().nullable().default(null),
  field_verification: z
    .record(z.enum(['VERIFIED', 'UNVERIFIED']))
    .optional()
    .default({}),
  unverified_fields: z.array(z.string()).optional().default([]),
});

/**
 * Certification or achievement item schema
 */
export const certificationOrAchievementSchema = z.object({
  title: z.string().min(1).max(AI_PROFILE_LIMITS.MAX_STRING_LENGTH).trim(),
  issuer: z.string().max(AI_PROFILE_LIMITS.MAX_STRING_LENGTH).nullable().default(null),
  issue_date: z.string().max(50).nullable().default(null),
  type: z.enum(['CERTIFICATION', 'AWARD', 'PUBLICATION', 'PATENT', 'OTHER']).default('OTHER'),
  evidence_snippet: evidenceSnippetSchema,
  verification_status: z.enum(['VERIFIED', 'UNVERIFIED']).default('VERIFIED'),
  unverified_reason: z.string().nullable().default(null),
  field_verification: z
    .record(z.enum(['VERIFIED', 'UNVERIFIED']))
    .optional()
    .default({}),
  unverified_fields: z.array(z.string()).optional().default([]),
});

/**
 * Ambiguous or unclear item schema
 */
export const ambiguousItemSchema = z.object({
  section: z.string().max(100).trim(),
  text_snippet: evidenceSnippetSchema,
  ambiguity_reason: z.string().max(400).trim(),
});

/**
 * Complete AI Resume Understanding Profile Schema
 */
export const resumeAiProfileSchema = z.object({
  professional_summary: z
    .preprocess((val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return null;
        return {
          text: trimmed,
          evidence_snippet: trimmed.length <= AI_PROFILE_LIMITS.MAX_EVIDENCE_LENGTH ? trimmed : null,
          verification_status: 'UNVERIFIED',
          unverified_reason: null,
        };
      }
      if (typeof val === 'object' && val !== null) {
        return {
          text:
            typeof val.text === 'string'
              ? val.text.trim()
              : typeof val.summary === 'string'
                ? val.summary.trim()
                : '',
          evidence_snippet:
            typeof val.evidence_snippet === 'string' ? val.evidence_snippet.trim() : null,
          verification_status: val.verification_status === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED',
          unverified_reason: typeof val.unverified_reason === 'string' ? val.unverified_reason : null,
        };
      }
      return val;
    }, professionalSummarySchema.nullable())
    .default(null),
  technical_skills: z
    .array(technicalSkillSchema)
    .max(AI_PROFILE_LIMITS.MAX_ITEMS_PER_SECTION)
    .default([]),
  soft_skills: z
    .array(softSkillSchema)
    .max(AI_PROFILE_LIMITS.MAX_ITEMS_PER_SECTION)
    .default([]),
  education: z
    .array(educationItemSchema)
    .max(AI_PROFILE_LIMITS.MAX_ITEMS_PER_SECTION)
    .default([]),
  work_experience: z
    .array(workExperienceItemSchema)
    .max(AI_PROFILE_LIMITS.MAX_ITEMS_PER_SECTION)
    .default([]),
  projects: z
    .array(projectItemSchema)
    .max(AI_PROFILE_LIMITS.MAX_ITEMS_PER_SECTION)
    .default([]),
  certifications_and_achievements: z
    .array(certificationOrAchievementSchema)
    .max(AI_PROFILE_LIMITS.MAX_ITEMS_PER_SECTION)
    .default([]),
  ambiguous_or_unclear_items: z
    .array(ambiguousItemSchema)
    .max(AI_PROFILE_LIMITS.MAX_ITEMS_PER_SECTION)
    .default([]),
});

export default {
  AI_PROFILE_LIMITS,
  aiProfileRequestSchema,
  resumeIdParamSchema,
  technicalSkillSchema,
  softSkillSchema,
  educationItemSchema,
  workExperienceItemSchema,
  projectItemSchema,
  certificationOrAchievementSchema,
  ambiguousItemSchema,
  professionalSummarySchema,
  resumeAiProfileSchema,
};
