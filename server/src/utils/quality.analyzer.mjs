/**
 * Deterministic Resume Quality and Structural Analyzer
 * Phase 7 Stage 4: Rule-based heuristics for section detection, formatting, and impact
 *
 * All scoring is deterministic and bounded:
 * quality_score = clamp(100.00 - sum(deductions), 0.00, 100.00), rounded to 2 decimals.
 */

import { SECTION_PATTERNS } from '../config/skills.taxonomy.mjs';

/**
 * Curated list of 40 engineering and professional action verbs
 */
export const ACTION_VERBS = [
  'architected', 'automated', 'built', 'configured', 'constructed',
  'coordinated', 'created', 'debugged', 'deployed', 'designed',
  'developed', 'engineered', 'enhanced', 'established', 'executed',
  'expanded', 'spearheaded', 'implemented', 'improved', 'initiated',
  'installed', 'integrated', 'launched', 'led', 'maintained',
  'managed', 'mentored', 'migrated', 'modernized', 'monitored',
  'optimized', 'orchestrated', 'partitioned', 'refactored', 'resolved',
  'reviewed', 'scaled', 'tested', 'tracked', 'transformed',
];

const ACTION_VERBS_REGEX = new RegExp(
  `\\b(?:${ACTION_VERBS.join('|')})\\b`,
  'gi'
);

/**
 * Quantifiable impact patterns:
 * - Percentages (e.g., 30%, 15.5%)
 * - Metric multipliers (e.g., 2x, 10x)
 * - Currency values (e.g., $50, $1000)
 * - Scale indicators (e.g., 10k users, 500 requests, 100ms)
 * - Compact numerical magnitudes (e.g., 100k+, 5M, 2B)
 */
const METRICS_REGEX = new RegExp(
  [
    '\\b\\d+(?:\\.\\d+)?%',
    '\\b\\d+(?:\\.\\d+)?x\\b',
    '\\$\\s*\\d+',
    '\\b\\d+\\+?\\s*(?:users|clients|requests|qps|queries|rps|ms|seconds|minutes|hours|days|percent|records|rows|gb|tb|mb|customers)\\b',
    '\\b\\d+(?:\\.\\d+)?[kKmMbB]\\+?\\b',
  ].join('|'),
  'gi'
);

const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

const EXPERIENCE_HEADER_REGEX = /(?:^|\n)\s*(?:experience|work\s+experience|employment|work\s+history|professional\s+experience)\b/im;
const EDUCATION_HEADER_REGEX = /(?:^|\n)\s*(?:education|academic\s+background|academics|qualifications)\b/im;
const PROJECTS_HEADER_REGEX = /(?:^|\n)\s*(?:projects|technical\s+projects|academic\s+projects|personal\s+projects)\b/im;
const BULLET_POINTS_REGEX = /(?:^|\n)\s*[-*•–—]\s+/g;

/**
 * Check if the text contains a dedicated skills section header
 *
 * @param {string} text
 * @returns {boolean}
 */
export const hasSkillsSection = (text) => {
  if (!text || typeof text !== 'string') return false;
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const clean = rawLine.trim().replace(/^[-*#•\d.)\s]+/, '').trim();
    if (!clean) continue;
    for (const pattern of SECTION_PATTERNS.SKILLS_SECTION) {
      if (pattern.test(clean)) return true;
    }
  }
  return false;
};

/**
 * Analyze resume text for section presence, formatting metrics, and explainable deductions.
 *
 * @param {string|null} rawText
 * @returns {object} Quality diagnostics result
 */
export const analyzeResumeQuality = (rawText) => {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return {
      status: 'UNAVAILABLE',
      reason: 'Original resume text is no longer retained',
    };
  }

  const text = rawText.trim();
  const deductions = [];
  const strengths = [];

  // 1. Section Completeness Audits
  // Contact: Either email OR phone satisfies contact presence
  const hasEmail = EMAIL_REGEX.test(text);
  const hasPhone = PHONE_REGEX.test(text);
  const hasContact = hasEmail || hasPhone;

  if (!hasContact) {
    deductions.push({
      rule: 'MISSING_CONTACT',
      deduction: 15.0,
      reason: 'Resume lacks essential contact information (email or phone number).',
    });
  } else {
    strengths.push('Essential contact information (email or phone) is provided.');
  }

  // Skills Section
  const skillsDetected = hasSkillsSection(text);
  if (!skillsDetected) {
    deductions.push({
      rule: 'MISSING_SKILLS',
      deduction: 15.0,
      reason: 'Resume lacks a dedicated Skills or Technical Proficiencies section.',
    });
  } else {
    strengths.push('Dedicated Skills or Technical Proficiencies section found.');
  }

  // Experience Section
  const experienceDetected = EXPERIENCE_HEADER_REGEX.test(text);
  if (!experienceDetected) {
    deductions.push({
      rule: 'MISSING_EXPERIENCE',
      deduction: 20.0,
      reason: 'Resume lacks a dedicated Experience or Work History section.',
    });
  } else {
    strengths.push('Experience / Work History section found.');
  }

  // Education Section
  const educationDetected = EDUCATION_HEADER_REGEX.test(text);
  if (!educationDetected) {
    deductions.push({
      rule: 'MISSING_EDUCATION',
      deduction: 15.0,
      reason: 'Resume lacks a dedicated Education or Academic Background section.',
    });
  } else {
    strengths.push('Education section found.');
  }

  // Projects Section
  const projectsDetected = PROJECTS_HEADER_REGEX.test(text);
  if (!projectsDetected) {
    deductions.push({
      rule: 'MISSING_PROJECTS',
      deduction: 10.0,
      reason: 'Resume lacks a dedicated Projects section demonstrating applied technical experience.',
    });
  } else {
    strengths.push('Projects section found.');
  }

  // 2. Word Count Bounds
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  let wordCountStatus = 'OPTIMAL';

  if (wordCount < 150) {
    wordCountStatus = 'TOO_BRIEF';
    deductions.push({
      rule: 'WORD_COUNT_TOO_BRIEF',
      deduction: 20.0,
      reason: 'Resume is severely brief (under 150 words) and lacks sufficient detail.',
    });
  } else if (wordCount < 250) {
    wordCountStatus = 'SHORT';
    deductions.push({
      rule: 'WORD_COUNT_SHORT',
      deduction: 10.0,
      reason: 'Resume is on the shorter side (under 250 words); consider expanding role details.',
    });
  } else if (wordCount <= 1000) {
    wordCountStatus = 'OPTIMAL';
    strengths.push(`Word count (${wordCount} words) is within the optimal readability range (250–1,000 words).`);
  } else if (wordCount <= 1500) {
    wordCountStatus = 'LONG';
    deductions.push({
      rule: 'WORD_COUNT_LONG',
      deduction: 5.0,
      reason: 'Resume is lengthy (over 1000 words); consider editing for conciseness.',
    });
  } else {
    wordCountStatus = 'EXCESSIVE';
    deductions.push({
      rule: 'WORD_COUNT_EXCESSIVE',
      deduction: 15.0,
      reason: 'Resume is excessively long (over 1500 words); standard resumes should be concise.',
    });
  }

  // 3. Bullet Points Count
  const bulletMatches = text.match(BULLET_POINTS_REGEX) || [];
  const bulletPointsCount = bulletMatches.length;

  if (bulletPointsCount < 3) {
    deductions.push({
      rule: 'BULLET_POINTS_SPARSE',
      deduction: 10.0,
      reason: 'Resume has fewer than 3 bullet points, indicating dense narrative text that reduces scannability.',
    });
  } else {
    strengths.push(`Bullet points (${bulletPointsCount} detected) provide clear structural scannability.`);
  }

  // 4. Action Verbs Density
  const verbMatches = text.match(ACTION_VERBS_REGEX) || [];
  const actionVerbsCount = verbMatches.length;

  if (actionVerbsCount < 3) {
    deductions.push({
      rule: 'ACTION_VERBS_LOW',
      deduction: 10.0,
      reason: "Fewer than 3 strong action verbs detected; use verbs like 'developed', 'architected', or 'optimized' to highlight initiative.",
    });
  } else {
    strengths.push(`Strong action verbs (${actionVerbsCount} detected) demonstrate initiative and execution.`);
  }

  // 5. Quantifiable Metrics Density
  const metricMatches = text.match(METRICS_REGEX) || [];
  const quantifiableMetricsCount = metricMatches.length;

  if (quantifiableMetricsCount === 0) {
    deductions.push({
      rule: 'METRICS_ZERO',
      deduction: 15.0,
      reason: 'No quantifiable results or metrics detected; add numbers, percentages, or scale indicators to demonstrate impact.',
    });
  } else if (quantifiableMetricsCount < 3) {
    deductions.push({
      rule: 'METRICS_SPARSE',
      deduction: 5.0,
      reason: 'Fewer than 3 quantifiable metrics detected; consider adding more measurable outcomes to project and work bullets.',
    });
  } else {
    strengths.push(`Includes quantifiable metrics (${quantifiableMetricsCount} detected) demonstrating tangible impact.`);
  }

  // 6. Calculate Final Score
  const totalDeductions = deductions.reduce((sum, d) => sum + d.deduction, 0);
  const rawScore = 100.0 - totalDeductions;
  const clampedScore = Math.min(100.0, Math.max(0.0, rawScore));
  const qualityScore = Math.round(clampedScore * 100) / 100;

  return {
    status: 'AVAILABLE',
    quality_score: qualityScore,
    sections_detected: {
      contact_info: {
        detected: hasContact,
        details: hasContact
          ? 'Contact information (email or phone) detected'
          : 'Neither email nor phone detected',
      },
      skills_section: {
        detected: skillsDetected,
        details: skillsDetected
          ? 'Dedicated Skills section found'
          : 'No dedicated Skills section found',
      },
      experience: {
        detected: experienceDetected,
        details: experienceDetected
          ? 'Experience / Work History section found'
          : 'No dedicated Experience section found',
      },
      education: {
        detected: educationDetected,
        details: educationDetected
          ? 'Education section found'
          : 'No dedicated Education section found',
      },
      projects: {
        detected: projectsDetected,
        details: projectsDetected
          ? 'Projects section found'
          : 'No dedicated Projects section found',
      },
    },
    formatting_metrics: {
      word_count: wordCount,
      word_count_status: wordCountStatus,
      bullet_points_count: bulletPointsCount,
      action_verbs_count: actionVerbsCount,
      quantifiable_metrics_count: quantifiableMetricsCount,
    },
    strengths,
    deductions,
  };
};

export default {
  ACTION_VERBS,
  hasSkillsSection,
  analyzeResumeQuality,
};
