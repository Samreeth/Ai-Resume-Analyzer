/**
 * Skill Gap Analysis and Recommendation Service
 * Phase 7 Stage 4: Read-only deterministic analysis intelligence
 */

import { query } from '../config/database.mjs';
import { parseRequirementType } from './analysis.service.mjs';
import { analyzeResumeQuality } from '../utils/quality.analyzer.mjs';

/**
 * Helper to slugify skill names for stable recommendation identifiers
 *
 * @param {string} str
 * @returns {string}
 */
const slugify = (str) => {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const PRIORITY_ORDER = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/**
 * Retrieve skill gap analysis, resume quality diagnostics, and prioritized recommendations
 * for an authenticated user's analysis.
 *
 * Scopes strictly to authenticated user_id to prevent IDOR.
 * Performs approximately 2-3 read queries without database mutations.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.analysisId
 * @param {string} [params.priority] - Optional filter ('HIGH'|'MEDIUM'|'LOW')
 * @param {string} [params.category] - Optional filter ('SKILL_GAP'|'RESUME_QUALITY'|'IMPACT_METRICS'|'FORMATTING')
 * @returns {Promise<object>} Complete recommendation payload
 */
export const getRecommendations = async ({ userId, analysisId, priority, category }) => {
  // Query 1: Fetch and verify analysis ownership
  const analysisRes = await query(
    `SELECT analysis_id, resume_id, job_id, resume_file_name, job_title,
            overall_score, skill_score, created_at
     FROM analyses
     WHERE analysis_id = $1 AND user_id = $2`,
    [analysisId, userId]
  );

  if (analysisRes.rowCount === 0) {
    const error = new Error('Analysis not found');
    error.code = 'RESOURCE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const analysis = analysisRes.rows[0];

  // Query 2: Fetch evaluated skills for this analysis joined with skills catalog
  const skillsRes = await query(
    `SELECT ask.skill_id, s.skill_name, s.category, ask.status, ask.evidence, ask.similarity_score
     FROM analysis_skills ask
     JOIN skills s ON ask.skill_id = s.skill_id
     WHERE ask.analysis_id = $1
     ORDER BY s.skill_name ASC`,
    [analysisId]
  );

  // Query 3 (Conditional): Fetch resume extracted text if resume_id is not null
  let resumeQuality = {
    status: 'UNAVAILABLE',
    reason: 'Original resume text is no longer retained',
  };

  if (analysis.resume_id) {
    const resumeRes = await query(
      `SELECT extracted_text FROM resumes WHERE resume_id = $1`,
      [analysis.resume_id]
    );

    if (resumeRes.rowCount > 0 && resumeRes.rows[0].extracted_text) {
      resumeQuality = analyzeResumeQuality(resumeRes.rows[0].extracted_text);
    }
  }

  // 4. Synthesize Skill Gap Analysis
  const criticalMissingRequired = [];
  const secondaryMissingPreferred = [];
  const categoryStats = new Map();

  for (const row of skillsRes.rows) {
    const reqType = parseRequirementType(row.evidence);
    const cat = row.category || 'Other';

    // Track category totals
    if (!categoryStats.has(cat)) {
      categoryStats.set(cat, { total: 0, matched: 0, missing: 0 });
    }
    const stat = categoryStats.get(cat);
    stat.total += 1;

    if (row.status === 'MATCHED') {
      stat.matched += 1;
    } else {
      stat.missing += 1;
      if (reqType === 'REQUIRED') {
        criticalMissingRequired.push({
          skill_name: row.skill_name,
          category: cat,
          requirement_type: 'REQUIRED',
          impact: 'CRITICAL',
          remediation: `This is a required skill. If you have experience with ${row.skill_name}, add it prominently to your Skills or Projects section. If not, prioritize acquiring foundational skills in this area.`,
        });
      } else {
        secondaryMissingPreferred.push({
          skill_name: row.skill_name,
          category: cat,
          requirement_type: 'PREFERRED',
          impact: 'SECONDARY',
          remediation: `This is a preferred skill. Mentioning caching, tooling, or project experience with ${row.skill_name} will strengthen your profile.`,
        });
      }
    }
  }

  // Calculate category coverage percentages
  const categoryBreakdown = {};
  for (const [catName, stat] of categoryStats.entries()) {
    categoryBreakdown[catName] = {
      total: stat.total,
      matched: stat.matched,
      missing: stat.missing,
      coverage_percentage:
        stat.total > 0
          ? Math.round(((stat.matched / stat.total) * 100) * 100) / 100
          : 0.0,
    };
  }

  // 5. Generate Actionable Recommendations with Strict Deterministic Categories & Priorities
  const recommendations = [];

  // A. Missing REQUIRED Skills (SKILL_GAP / HIGH)
  for (const item of criticalMissingRequired) {
    recommendations.push({
      id: `rec_gap_required_${slugify(item.skill_name)}`,
      priority: 'HIGH',
      category: 'SKILL_GAP',
      title: `Add Missing Required Skill: ${item.skill_name}`,
      message: `The job description designates ${item.skill_name} as a mandatory requirement. Your resume currently lacks evidence for this skill.`,
      action: `If you have verified experience with ${item.skill_name}, add it prominently to your Skills or Projects section. If not, prioritize acquiring foundational skills in this area.`,
    });
  }

  // B. Missing PREFERRED Skills (SKILL_GAP / MEDIUM)
  for (const item of secondaryMissingPreferred) {
    recommendations.push({
      id: `rec_gap_preferred_${slugify(item.skill_name)}`,
      priority: 'MEDIUM',
      category: 'SKILL_GAP',
      title: `Highlight Preferred Skill: ${item.skill_name}`,
      message: `${item.skill_name} is listed as a preferred qualification for this role.`,
      action: `Highlight any familiar tools, coursework, or projects demonstrating ${item.skill_name} to strengthen your candidacy.`,
    });
  }

  // C. Resume Quality Diagnostics (Only when resume text is available)
  if (resumeQuality.status === 'AVAILABLE') {
    const sec = resumeQuality.sections_detected;
    const fmt = resumeQuality.formatting_metrics;

    // Missing Contact (RESUME_QUALITY / HIGH)
    if (!sec.contact_info.detected) {
      recommendations.push({
        id: 'rec_quality_contact',
        priority: 'HIGH',
        category: 'RESUME_QUALITY',
        title: 'Add Contact Information',
        message: 'Your resume lacks essential contact details.',
        action: 'Add clear, accessible contact information (email address or phone number) in your resume header so employers can reach you.',
      });
    }

    // Missing Skills Section (RESUME_QUALITY / HIGH)
    if (!sec.skills_section.detected) {
      recommendations.push({
        id: 'rec_quality_skills',
        priority: 'HIGH',
        category: 'RESUME_QUALITY',
        title: 'Add Dedicated Skills Section',
        message: 'Your resume lacks a clearly designated Skills or Technical Proficiencies section.',
        action: "Create a dedicated 'Skills' section listing your technical proficiencies, frameworks, and tools to enhance automated and human screening.",
      });
    }

    // Missing Experience Section (RESUME_QUALITY / HIGH)
    if (!sec.experience.detected) {
      recommendations.push({
        id: 'rec_quality_experience',
        priority: 'HIGH',
        category: 'RESUME_QUALITY',
        title: 'Add Experience Section',
        message: 'Your resume lacks an Experience or Work History section.',
        action: "Include an 'Experience' section detailing past employment, roles, responsibilities, and achievements.",
      });
    }

    // Missing Education Section (RESUME_QUALITY / HIGH)
    if (!sec.education.detected) {
      recommendations.push({
        id: 'rec_quality_education',
        priority: 'HIGH',
        category: 'RESUME_QUALITY',
        title: 'Add Education Section',
        message: 'Your resume lacks an Education section.',
        action: "Add an 'Education' section outlining your academic background, degree, institution, and graduation year.",
      });
    }

    // Missing Projects Section (RESUME_QUALITY / MEDIUM)
    if (!sec.projects.detected) {
      recommendations.push({
        id: 'rec_quality_projects',
        priority: 'MEDIUM',
        category: 'RESUME_QUALITY',
        title: 'Add Projects Section',
        message: 'Your resume lacks a dedicated Projects section.',
        action: "Include a 'Projects' section showcasing practical technical implementations, architecture, and personal or academic initiatives.",
      });
    }

    // Quantifiable Metrics - Zero (IMPACT_METRICS / MEDIUM)
    if (fmt.quantifiable_metrics_count === 0) {
      recommendations.push({
        id: 'rec_impact_metrics_zero',
        priority: 'MEDIUM',
        category: 'IMPACT_METRICS',
        title: 'Add Quantifiable Impact Metrics',
        message: 'No quantifiable metrics (percentages, user numbers, latency, scale) were detected in your resume.',
        action: "Incorporate measurable results (e.g., 'improved latency by 30%', 'scaled to 10k users', 'managed 500k queries') to substantiate your achievements.",
      });
    }
    // Quantifiable Metrics - Sparse 1–2 (IMPACT_METRICS / MEDIUM)
    else if (fmt.quantifiable_metrics_count < 3) {
      recommendations.push({
        id: 'rec_impact_metrics_sparse',
        priority: 'MEDIUM',
        category: 'IMPACT_METRICS',
        title: 'Expand Quantifiable Results',
        message: `Only ${fmt.quantifiable_metrics_count} quantifiable metric(s) were detected across your resume.`,
        action: 'Add more metrics and numerical outcomes across your project and experience bullet points to demonstrate consistent impact.',
      });
    }

    // Word Count Deviations (FORMATTING / LOW)
    if (fmt.word_count_status !== 'OPTIMAL') {
      const isBrief = ['TOO_BRIEF', 'SHORT'].includes(fmt.word_count_status);
      recommendations.push({
        id: 'rec_formatting_word_count',
        priority: 'LOW',
        category: 'FORMATTING',
        title: 'Optimize Resume Length',
        message: `Your resume length (${fmt.word_count} words) deviates from the standard optimal range (250–1,000 words).`,
        action: isBrief
          ? 'Expand your project and role descriptions with more technical context and detail.'
          : 'Edit and tighten descriptions for conciseness to focus on highest-impact accomplishments.',
      });
    }

    // Bullet Points Sparse (FORMATTING / LOW)
    if (fmt.bullet_points_count < 3) {
      recommendations.push({
        id: 'rec_formatting_bullet_points',
        priority: 'LOW',
        category: 'FORMATTING',
        title: 'Use Bullet Points for Scannability',
        message: 'Your resume contains fewer than 3 bullet points, presenting information in dense narrative blocks.',
        action: 'Convert dense paragraphs into concise, bulleted accomplishment statements starting with action verbs.',
      });
    }

    // Action Verbs Low (IMPACT_METRICS / LOW)
    if (fmt.action_verbs_count < 3) {
      recommendations.push({
        id: 'rec_impact_action_verbs',
        priority: 'LOW',
        category: 'IMPACT_METRICS',
        title: 'Strengthen Action Verbs',
        message: 'Fewer than 3 strong engineering action verbs were detected across your resume.',
        action: "Begin role and project bullet points with active verbs such as 'built', 'developed', 'architected', or 'optimized'.",
      });
    }
  }

  // 6. Sort Recommendations by Priority (HIGH -> MEDIUM -> LOW)
  recommendations.sort((a, b) => {
    return (PRIORITY_ORDER[a.priority] || 99) - (PRIORITY_ORDER[b.priority] || 99);
  });

  // 7. Apply Query Filters
  let filtered = recommendations;
  if (priority) {
    filtered = filtered.filter((r) => r.priority === priority);
  }
  if (category) {
    filtered = filtered.filter((r) => r.category === category);
  }

  return {
    analysis_id: analysis.analysis_id,
    resume_id: analysis.resume_id,
    job_id: analysis.job_id,
    resume_file_name: analysis.resume_file_name,
    job_title: analysis.job_title,
    overall_score: Number(analysis.overall_score),
    skill_score: Number(analysis.skill_score),
    created_at: analysis.created_at,
    skill_gap_analysis: {
      total_job_skills: skillsRes.rows.length,
      critical_missing_required: criticalMissingRequired,
      secondary_missing_preferred: secondaryMissingPreferred,
      category_breakdown: categoryBreakdown,
    },
    resume_quality: resumeQuality,
    recommendations: filtered,
    disclaimer:
      'This analysis is an automated decision-support suggestion generated by deterministic heuristics. It does not evaluate hiring probability or guarantee employment outcomes.',
  };
};

export default {
  getRecommendations,
};
