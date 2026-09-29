import { query, pool } from '../config/database.mjs';
import { extractSkills } from '../utils/skill.matcher.mjs';

/**
 * Extract requirement type from standardized evidence string prefix.
 * e.g., "[REQUIRED] Skills section exact match..." -> "REQUIRED"
 *
 * @param {string} evidence
 * @returns {'REQUIRED'|'PREFERRED'}
 */
export const parseRequirementType = (evidence) => {
  if (typeof evidence === 'string' && evidence.startsWith('[PREFERRED]')) {
    return 'PREFERRED';
  }
  return 'REQUIRED';
};

/**
 * Execute deterministic matching and analysis between an authenticated candidate's
 * processed resume and job description.
 *
 * Atomically persists parent record to `analyses` and child records to `analysis_skills`.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.resumeId
 * @param {string} params.jobId
 * @returns {Promise<object>} Complete persisted analysis report
 */
export const createAnalysis = async ({ userId, resumeId, jobId }) => {
  // 1. Fetch and verify Resume Ownership & Extraction Status
  const resumeRes = await query(
    `SELECT resume_id, file_name, extracted_text, extraction_status
     FROM resumes
     WHERE resume_id = $1 AND user_id = $2`,
    [resumeId, userId]
  );

  if (resumeRes.rowCount === 0) {
    const error = new Error('Resume not found');
    error.code = 'RESOURCE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const resume = resumeRes.rows[0];

  if (resume.extraction_status === 'PENDING') {
    const error = new Error('Resume text extraction has not started yet');
    error.code = 'RESUME_NOT_PROCESSED';
    error.statusCode = 409;
    throw error;
  }

  if (resume.extraction_status === 'PROCESSING') {
    const error = new Error('Resume text extraction is in progress. Please retry after processing completes');
    error.code = 'RESUME_PROCESSING_IN_PROGRESS';
    error.statusCode = 409;
    throw error;
  }

  if (resume.extraction_status === 'FAILED') {
    const error = new Error('Resume text extraction failed. Please re-upload or re-process the resume');
    error.code = 'RESUME_PROCESSING_FAILED';
    error.statusCode = 422;
    throw error;
  }

  if (!resume.extracted_text || resume.extracted_text.trim().length < 20) {
    const error = new Error('Resume has no extractable text content to analyze');
    error.code = 'RESUME_NO_TEXT';
    error.statusCode = 422;
    throw error;
  }

  // 2. Fetch and verify Job Description Ownership & Extracted Data
  const jobRes = await query(
    `SELECT job_id, title, description, extracted_data
     FROM job_descriptions
     WHERE job_id = $1 AND user_id = $2`,
    [jobId, userId]
  );

  if (jobRes.rowCount === 0) {
    const error = new Error('Job description not found');
    error.code = 'RESOURCE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const job = jobRes.rows[0];

  if (job.extracted_data === null || job.extracted_data === undefined) {
    const error = new Error(
      'Job description skill extraction data is unavailable. Please run skill extraction on this job description before analyzing.'
    );
    error.code = 'JOB_EXTRACTION_UNAVAILABLE';
    error.statusCode = 422;
    throw error;
  }

  const extractedData = job.extracted_data;
  if (
    typeof extractedData !== 'object' ||
    !Array.isArray(extractedData.required) ||
    !Array.isArray(extractedData.preferred)
  ) {
    const error = new Error(
      'Job description contains invalid extraction data structure. Please re-extract skills for this job description.'
    );
    error.code = 'INVALID_JOB_EXTRACTION_DATA';
    error.statusCode = 422;
    throw error;
  }

  // 3. Extract Candidate Resume Skills via Stage 1 Matcher
  const detectedResumeSkills = extractSkills(resume.extracted_text);
  const resumeSkillsMap = new Map();
  for (const skill of detectedResumeSkills) {
    resumeSkillsMap.set(skill.skillName.toLowerCase(), skill);
  }

  // 4. Job Requirements Deduplication & Precedence
  // Precedence rule: If a skill appears in both Required and Preferred, REQUIRED takes precedence!
  const requiredMap = new Map();
  const preferredMap = new Map();

  for (const req of extractedData.required) {
    if (!req || !req.skillName) continue;
    const lower = req.skillName.toLowerCase();
    if (!requiredMap.has(lower)) {
      requiredMap.set(lower, req);
    }
  }

  for (const pref of extractedData.preferred) {
    if (!pref || !pref.skillName) continue;
    const lower = pref.skillName.toLowerCase();
    if (!requiredMap.has(lower) && !preferredMap.has(lower)) {
      preferredMap.set(lower, pref);
    }
  }

  const uniqueRequired = Array.from(requiredMap.values());
  const uniquePreferred = Array.from(preferredMap.values());
  const N_req = uniqueRequired.length;
  const N_pref = uniquePreferred.length;

  // 5. Matching Execution & Classification
  const matchedRequired = [];
  const missingRequired = [];
  for (const r of uniqueRequired) {
    const lower = r.skillName.toLowerCase();
    if (resumeSkillsMap.has(lower)) {
      const match = resumeSkillsMap.get(lower);
      matchedRequired.push({
        skillName: r.skillName,
        category: r.category || match.category,
        requirementType: 'REQUIRED',
        status: 'MATCHED',
        similarityScore: Number(match.similarityScore) || 80.0,
        confidence: Number(match.confidence) || 0.8,
        evidence: `[REQUIRED] ${match.isSkillsSection ? 'Skills section' : 'Body context'} ${
          match.matchType === 'ALIAS' ? 'alias' : 'exact'
        } match: '${match.matchedToken}' (Confidence: ${(match.confidence || 0.8).toFixed(2)})`,
      });
    } else {
      missingRequired.push({
        skillName: r.skillName,
        category: r.category || 'Skill',
        requirementType: 'REQUIRED',
        status: 'MISSING',
        similarityScore: 0.0,
        confidence: 0.0,
        evidence: `[REQUIRED] Skill not detected in candidate resume`,
      });
    }
  }

  const matchedPreferred = [];
  const missingPreferred = [];
  for (const p of uniquePreferred) {
    const lower = p.skillName.toLowerCase();
    if (resumeSkillsMap.has(lower)) {
      const match = resumeSkillsMap.get(lower);
      matchedPreferred.push({
        skillName: p.skillName,
        category: p.category || match.category,
        requirementType: 'PREFERRED',
        status: 'MATCHED',
        similarityScore: Number(match.similarityScore) || 80.0,
        confidence: Number(match.confidence) || 0.8,
        evidence: `[PREFERRED] ${match.isSkillsSection ? 'Skills section' : 'Body context'} ${
          match.matchType === 'ALIAS' ? 'alias' : 'exact'
        } match: '${match.matchedToken}' (Confidence: ${(match.confidence || 0.8).toFixed(2)})`,
      });
    } else {
      missingPreferred.push({
        skillName: p.skillName,
        category: p.category || 'Skill',
        requirementType: 'PREFERRED',
        status: 'MISSING',
        similarityScore: 0.0,
        confidence: 0.0,
        evidence: `[PREFERRED] Skill not detected in candidate resume`,
      });
    }
  }

  // 6. Approved Deterministic Composite Scoring Formula
  let sReq = 0.0;
  if (N_req > 0) {
    sReq = matchedRequired.length / N_req;
  } else if (N_pref > 0) {
    sReq = 1.0;
  } else {
    sReq = 0.0;
  }

  let sPref = 0.0;
  if (N_pref > 0) {
    sPref = matchedPreferred.length / N_pref;
  } else {
    sPref = 0.0;
  }

  const allMatched = [...matchedRequired, ...matchedPreferred];
  let sConf = 0.0;
  if (allMatched.length > 0) {
    const sumConf = allMatched.reduce((acc, curr) => acc + curr.confidence, 0);
    sConf = sumConf / allMatched.length;
  }

  const rawScore = (0.7 * sReq + 0.2 * sPref + 0.1 * sConf) * 100.0;
  const clampedScore = Math.min(100.0, Math.max(0.0, rawScore));
  const overallScore = Math.round((clampedScore + Number.EPSILON) * 100) / 100;
  const skillScore = overallScore;

  // 7. Resolve Canonical Skill IDs from Master `skills` table (Read-Only)
  const allEvaluatedSkills = [
    ...matchedRequired,
    ...missingRequired,
    ...matchedPreferred,
    ...missingPreferred,
  ];

  const distinctSkillNames = Array.from(
    new Set(allEvaluatedSkills.map((s) => s.skillName.toLowerCase()))
  );

  let skillIdMap = new Map();
  if (distinctSkillNames.length > 0) {
    const skillsRes = await query(
      `SELECT skill_id, skill_name, category
       FROM skills
       WHERE LOWER(skill_name) = ANY($1::text[])`,
      [distinctSkillNames]
    );

    for (const row of skillsRes.rows) {
      skillIdMap.set(row.skill_name.toLowerCase(), {
        skillId: row.skill_id,
        category: row.category,
      });
    }
  }

  for (const item of allEvaluatedSkills) {
    const resolved = skillIdMap.get(item.skillName.toLowerCase());
    if (resolved) {
      item.skillId = resolved.skillId;
      if (item.category === 'Skill' || item.category === 'Unknown') {
        item.category = resolved.category;
      }
    } else {
      // Fallback in case skill does not exist in master catalog
      throw new Error(`Master skills catalog missing entry for canonical skill: ${item.skillName}`);
    }
  }

  // 8. Atomic Database Transaction
  const client = await pool.connect();
  let createdAnalysisId;
  let createdAt;

  try {
    await client.query('BEGIN');

    // Insert parent record into analyses
    const insertAnalysisSql = `
      INSERT INTO analyses (
        user_id, resume_id, job_id, resume_file_name, job_title,
        overall_score, skill_score, experience_score, project_score, education_score, quality_score, scoring_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING analysis_id, created_at
    `;
    const analysisRes = await client.query(insertAnalysisSql, [
      userId,
      resumeId,
      jobId,
      resume.file_name,
      job.title,
      overallScore,
      skillScore,
      0.0,
      0.0,
      0.0,
      0.0,
      '1.0',
    ]);

    createdAnalysisId = analysisRes.rows[0].analysis_id;
    createdAt = analysisRes.rows[0].created_at;

    // Batch insert child records into analysis_skills
    if (allEvaluatedSkills.length > 0) {
      const valuePlaceholders = [];
      const values = [];
      let p = 1;

      for (const item of allEvaluatedSkills) {
        valuePlaceholders.push(`($${p}, $${p + 1}, $${p + 2}, $${p + 3}, $${p + 4})`);
        values.push(
          createdAnalysisId,
          item.skillId,
          item.status,
          item.evidence,
          item.similarityScore
        );
        p += 5;
      }

      const insertSkillsSql = `
        INSERT INTO analysis_skills (analysis_id, skill_id, status, evidence, similarity_score)
        VALUES ${valuePlaceholders.join(', ')}
      `;
      await client.query(insertSkillsSql, values);
    }

    await client.query('COMMIT');
  } catch (txErr) {
    await client.query('ROLLBACK');
    throw txErr;
  } finally {
    client.release();
  }

  // 9. Construct and return full API response
  const summary = {
    total_job_skills: allEvaluatedSkills.length,
    required_skills_count: N_req,
    preferred_skills_count: N_pref,
    matched_required_count: matchedRequired.length,
    matched_preferred_count: matchedPreferred.length,
    missing_required_count: missingRequired.length,
    missing_preferred_count: missingPreferred.length,
    required_coverage: N_req > 0 ? Math.round((matchedRequired.length / N_req) * 1000) / 1000 : (N_pref > 0 ? 1.0 : 0.0),
    preferred_coverage: N_pref > 0 ? Math.round((matchedPreferred.length / N_pref) * 1000) / 1000 : 0.0,
    average_confidence: Math.round(sConf * 1000) / 1000,
  };

  const formattedSkills = allEvaluatedSkills.map((item) => ({
    skill_id: item.skillId,
    skill_name: item.skillName,
    category: item.category,
    requirement_type: item.requirementType,
    status: item.status,
    similarity_score: item.similarityScore,
    evidence: item.evidence,
  }));

  return {
    analysis_id: createdAnalysisId,
    resume_id: resumeId,
    job_id: jobId,
    resume_file_name: resume.file_name,
    job_title: job.title,
    overall_score: overallScore,
    skill_score: skillScore,
    experience_score: 0.0,
    project_score: 0.0,
    education_score: 0.0,
    quality_score: 0.0,
    scoring_version: '1.0',
    created_at: createdAt,
    summary,
    skills: formattedSkills,
  };
};

/**
 * Retrieve complete analysis details including itemized skill matches.
 * Scoped by user_id to prevent IDOR.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.analysisId
 * @returns {Promise<object>} Complete analysis report
 */
export const getAnalysisById = async ({ userId, analysisId }) => {
  const analysisRes = await query(
    `SELECT analysis_id, resume_id, job_id, resume_file_name, job_title,
            overall_score, skill_score, experience_score, project_score, education_score, quality_score,
            scoring_version, created_at
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

  const skillsRes = await query(
    `SELECT ask.skill_id, s.skill_name, s.category, ask.status, ask.evidence, ask.similarity_score
     FROM analysis_skills ask
     JOIN skills s ON ask.skill_id = s.skill_id
     WHERE ask.analysis_id = $1
     ORDER BY s.skill_name ASC`,
    [analysisId]
  );

  let reqCount = 0;
  let prefCount = 0;
  let matchedReq = 0;
  let matchedPref = 0;
  let missingReq = 0;
  let missingPref = 0;

  const formattedSkills = skillsRes.rows.map((row) => {
    const reqType = parseRequirementType(row.evidence);
    const isMatched = row.status === 'MATCHED';

    if (reqType === 'REQUIRED') {
      reqCount++;
      if (isMatched) matchedReq++;
      else missingReq++;
    } else {
      prefCount++;
      if (isMatched) matchedPref++;
      else missingPref++;
    }

    return {
      skill_id: row.skill_id,
      skill_name: row.skill_name,
      category: row.category,
      requirement_type: reqType,
      status: row.status,
      similarity_score: Number(row.similarity_score),
      evidence: row.evidence,
    };
  });

  const summary = {
    total_job_skills: formattedSkills.length,
    required_skills_count: reqCount,
    preferred_skills_count: prefCount,
    matched_required_count: matchedReq,
    matched_preferred_count: matchedPref,
    missing_required_count: missingReq,
    missing_preferred_count: missingPref,
    required_coverage: reqCount > 0 ? Math.round((matchedReq / reqCount) * 1000) / 1000 : (prefCount > 0 ? 1.0 : 0.0),
    preferred_coverage: prefCount > 0 ? Math.round((matchedPref / prefCount) * 1000) / 1000 : 0.0,
  };

  return {
    analysis_id: analysis.analysis_id,
    resume_id: analysis.resume_id,
    job_id: analysis.job_id,
    resume_file_name: analysis.resume_file_name,
    job_title: analysis.job_title,
    overall_score: Number(analysis.overall_score),
    skill_score: Number(analysis.skill_score),
    experience_score: Number(analysis.experience_score),
    project_score: Number(analysis.project_score),
    education_score: Number(analysis.education_score),
    quality_score: Number(analysis.quality_score),
    scoring_version: analysis.scoring_version,
    created_at: analysis.created_at,
    summary,
    skills: formattedSkills,
  };
};

/**
 * List paginated historical analyses for the authenticated user.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @returns {Promise<{ analyses: Array, pagination: object }>}
 */
export const listAnalyses = async ({ userId, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;

  const countRes = await query(
    'SELECT COUNT(*)::int as total FROM analyses WHERE user_id = $1',
    [userId]
  );
  const total = countRes.rows[0]?.total || 0;

  const analysesRes = await query(
    `SELECT a.analysis_id, a.resume_id, a.job_id, a.resume_file_name, a.job_title,
            a.overall_score, a.skill_score, a.created_at,
            COUNT(CASE WHEN ask.status = 'MATCHED' THEN 1 END)::int as matched_count,
            COUNT(CASE WHEN ask.status = 'MISSING' THEN 1 END)::int as missing_count
     FROM analyses a
     LEFT JOIN analysis_skills ask ON a.analysis_id = ask.analysis_id
     WHERE a.user_id = $1
     GROUP BY a.analysis_id
     ORDER BY a.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const analyses = analysesRes.rows.map((row) => ({
    analysis_id: row.analysis_id,
    resume_id: row.resume_id,
    job_id: row.job_id,
    resume_file_name: row.resume_file_name,
    job_title: row.job_title,
    overall_score: Number(row.overall_score),
    skill_score: Number(row.skill_score),
    matched_count: row.matched_count,
    missing_count: row.missing_count,
    created_at: row.created_at,
  }));

  return {
    analyses,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Delete an analysis record.
 * Child records in `analysis_skills` cascade delete automatically via foreign key.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.analysisId
 * @returns {Promise<boolean>}
 */
export const deleteAnalysisById = async ({ userId, analysisId }) => {
  const res = await query(
    'DELETE FROM analyses WHERE analysis_id = $1 AND user_id = $2 RETURNING analysis_id',
    [analysisId, userId]
  );

  if (res.rowCount === 0) {
    const error = new Error('Analysis not found');
    error.code = 'RESOURCE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  return true;
};

export default {
  createAnalysis,
  getAnalysisById,
  listAnalyses,
  deleteAnalysisById,
  parseRequirementType,
};
