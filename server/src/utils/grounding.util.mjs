/**
 * Evidence Grounding Verification Utility
 *
 * Verifies that factual claims extracted by Gemini are substantiated by
 * verbatim evidence snippets present in the candidate resume text.
 *
 * Checks:
 * 1. Evidence Existence: Snippet must be a true substring in the source resume.
 * 2. Relevance / Primary Entity Substantiation: Snippet must contain meaningful identifying tokens
 *    (e.g. company, school, skill name) and cannot rely exclusively on generic words.
 * 3. Field-Level Verification: Evaluates factual fields (dates, GPA, locations) separately from
 *    the primary entity.
 * 4. Summary Verification: Verifies professional summary claims against evidence snippets.
 */

// Generic words that alone are insufficient to establish entity identity
const GENERIC_IDENTITY_WORDS = new Set([
  'engineer', 'developer', 'software', 'senior', 'junior', 'lead', 'manager',
  'intern', 'internship', 'consultant', 'associate', 'analyst', 'specialist',
  'project', 'degree', 'bachelor', 'master', 'science', 'arts', 'university',
  'college', 'school', 'institute', 'certified', 'professional', 'team',
  'member', 'full', 'stack', 'frontend', 'backend'
]);

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'or'
]);

/**
 * Normalize whitespace and casing for robust text comparison.
 *
 * @param {string} str
 * @returns {string}
 */
export const normalizeText = (str) => {
  return String(str || '')
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Check if an evidence snippet is grounded in source text and supports the claim.
 *
 * @param {string} snippet - Extracted evidence quote
 * @param {string} normalizedSource - Source resume text
 * @param {string[]} [keyTokens=[]] - Identifying tokens that should appear in the snippet
 * @param {string[]} [requiredTokens=[]] - Mandatory tokens that MUST appear in the snippet
 * @returns {{ verified: boolean, reason: string | null }}
 */
export const verifySnippet = (snippet, normalizedSource, keyTokens = [], requiredTokens = []) => {
  if (!snippet || typeof snippet !== 'string' || snippet.trim().length < 3) {
    return {
      verified: false,
      reason: 'Missing or insufficient evidence snippet',
    };
  }

  const normalizedSnippet = normalizeText(snippet);
  const normSource = normalizeText(normalizedSource);

  // Check 1: Verbatim existence in source text
  if (!normSource.includes(normalizedSnippet)) {
    return {
      verified: false,
      reason: 'Evidence snippet not found in candidate resume text',
    };
  }

  // Check 2: Mandatory identifying tokens (e.g. Organization name for a job, Institution for school)
  const validRequired = (Array.isArray(requiredTokens) ? requiredTokens : [])
    .filter((t) => t && typeof t === 'string' && t.trim().length >= 2)
    .map((t) => normalizeText(t));

  for (const req of validRequired) {
    if (!normalizedSnippet.includes(req)) {
      return {
        verified: false,
        reason: `Evidence snippet does not substantiate the primary entity (${req})`,
      };
    }
  }

  // Check 3: Distinctive identifying tokens (must not rely exclusively on generic words like "engineer")
  const validTokens = (Array.isArray(keyTokens) ? keyTokens : [])
    .filter((t) => t && typeof t === 'string' && t.trim().length >= 2)
    .map((t) => normalizeText(t));

  if (validTokens.length > 0) {
    const nonGenericTokens = validTokens.filter((token) => {
      const words = token.split(/\s+/);
      return words.some((w) => !GENERIC_IDENTITY_WORDS.has(w) && !STOP_WORDS.has(w));
    });

    const tokensToCheck = nonGenericTokens.length > 0 ? nonGenericTokens : validTokens;
    const hasToken = tokensToCheck.some((token) => normalizedSnippet.includes(token));

    if (!hasToken) {
      return {
        verified: false,
        reason: 'Evidence snippet does not substantiate the claimed entity or skill',
      };
    }
  }

  return { verified: true, reason: null };
};

/**
 * Perform evidence grounding verification across all sections of an AI-generated resume profile.
 *
 * @param {object} profile - Validated resume profile object
 * @param {string} sanitizedResumeText - Sanitized resume text (same representation sent to Gemini)
 * @returns {object} Grounded profile with verification_status, field_verification, and unverified_reason populated
 */
export const verifyProfileGrounding = (profile, sanitizedResumeText) => {
  if (!profile || typeof profile !== 'object') return profile;

  const normalizedSource = normalizeText(sanitizedResumeText);
  const ungroundedClaims = [];

  // 1. Professional Summary Grounding
  let professional_summary = null;
  if (profile.professional_summary) {
    const rawSummary = profile.professional_summary;
    const summaryText = typeof rawSummary === 'string' ? rawSummary : (rawSummary.text || '');
    const evidenceSnippet = typeof rawSummary === 'object' && rawSummary.evidence_snippet ? rawSummary.evidence_snippet : null;

    if (summaryText.trim().length > 0) {
      let snippetToVerify = evidenceSnippet;
      if (!snippetToVerify && normalizedSource.includes(normalizeText(summaryText))) {
        snippetToVerify = summaryText;
      }

      let summaryVerified = false;
      let summaryReason = null;

      if (!snippetToVerify) {
        summaryVerified = false;
        summaryReason = 'Missing supporting evidence snippet for professional summary';
      } else {
        const snippetCheck = verifySnippet(snippetToVerify, normalizedSource);
        if (!snippetCheck.verified) {
          summaryVerified = false;
          summaryReason = snippetCheck.reason;
        } else {
          // Verify factual claims: numeric experience years e.g. "5 years", "5+ years", "3 years"
          const expMatch = summaryText.match(/\b(\d+)\+?\s*(?:years?|yrs?)\b/i);
          if (expMatch) {
            const expClaim = expMatch[0].toLowerCase();
            const numStr = expMatch[1];
            const snippetNorm = normalizeText(snippetToVerify);
            if (!snippetNorm.includes(expClaim) && !snippetNorm.includes(numStr)) {
              summaryVerified = false;
              summaryReason = `Professional summary claims "${expMatch[0]}" of experience without supporting evidence in resume text`;
            } else {
              summaryVerified = true;
            }
          } else {
            summaryVerified = true;
          }
        }
      }

      if (!summaryVerified) {
        ungroundedClaims.push({
          section: 'Professional Summary',
          text_snippet: String(snippetToVerify || summaryText).slice(0, 400),
          ambiguity_reason: `Unverified professional summary: ${summaryReason}`,
        });
      }

      professional_summary = {
        text: summaryText,
        evidence_snippet: snippetToVerify || null,
        verification_status: summaryVerified ? 'VERIFIED' : 'UNVERIFIED',
        unverified_reason: summaryVerified ? null : summaryReason,
      };
    }
  }

  // 2. Technical Skills
  const technical_skills = (profile.technical_skills || []).map((item) => {
    const { verified, reason } = verifySnippet(item.evidence_snippet, normalizedSource, [item.name], [item.name]);
    if (!verified) {
      ungroundedClaims.push({
        section: 'Technical Skills',
        text_snippet: String(item.evidence_snippet || '').slice(0, 400),
        ambiguity_reason: `Unverified skill (${item.name}): ${reason}`,
      });
    }
    return {
      ...item,
      verification_status: verified ? 'VERIFIED' : 'UNVERIFIED',
      unverified_reason: verified ? null : reason,
    };
  });

  // 3. Soft Skills
  const soft_skills = (profile.soft_skills || []).map((item) => {
    const { verified, reason } = verifySnippet(item.evidence_snippet, normalizedSource, [item.name]);
    if (!verified) {
      ungroundedClaims.push({
        section: 'Soft Skills',
        text_snippet: String(item.evidence_snippet || '').slice(0, 400),
        ambiguity_reason: `Unverified soft skill (${item.name}): ${reason}`,
      });
    }
    return {
      ...item,
      verification_status: verified ? 'VERIFIED' : 'UNVERIFIED',
      unverified_reason: verified ? null : reason,
    };
  });

  // 4. Work Experience with Field-Level Verification
  const work_experience = (profile.work_experience || []).map((item) => {
    const requiredTokens = item.organization ? [item.organization] : [];
    const keyTokens = [item.organization, item.role].filter(Boolean);
    const { verified: entityVerified, reason: entityReason } = verifySnippet(
      item.evidence_snippet,
      normalizedSource,
      keyTokens,
      requiredTokens
    );

    const fieldVerification = {};
    const unverifiedFields = [];

    // organization
    const hasOrg = item.organization && normalizedSource.includes(normalizeText(item.organization));
    fieldVerification.organization = hasOrg ? 'VERIFIED' : 'UNVERIFIED';
    if (!hasOrg) unverifiedFields.push('organization');

    // role
    const hasRole = item.role && (normalizedSource.includes(normalizeText(item.role)) || entityVerified);
    fieldVerification.role = hasRole ? 'VERIFIED' : 'UNVERIFIED';
    if (!hasRole) unverifiedFields.push('role');

    // start_date
    if (item.start_date) {
      const normDate = normalizeText(item.start_date);
      const yearMatch = normDate.match(/\b\d{4}\b/);
      const isVerified = normalizedSource.includes(normDate) || (yearMatch && normalizedSource.includes(yearMatch[0]));
      fieldVerification.start_date = isVerified ? 'VERIFIED' : 'UNVERIFIED';
      if (!isVerified) unverifiedFields.push('start_date');
    }

    // end_date
    if (item.end_date) {
      const normDate = normalizeText(item.end_date);
      const yearMatch = normDate.match(/\b\d{4}\b/);
      const isVerified = normalizedSource.includes(normDate) ||
        (normDate === 'present' && normalizedSource.includes('present')) ||
        (yearMatch && normalizedSource.includes(yearMatch[0]));
      fieldVerification.end_date = isVerified ? 'VERIFIED' : 'UNVERIFIED';
      if (!isVerified) unverifiedFields.push('end_date');
    }

    // location
    if (item.location) {
      const normLoc = normalizeText(item.location);
      const isVerified = normalizedSource.includes(normLoc);
      fieldVerification.location = isVerified ? 'VERIFIED' : 'UNVERIFIED';
      if (!isVerified) unverifiedFields.push('location');
    }

    const overallVerified = entityVerified && hasOrg;
    let overallReason = null;
    if (!overallVerified) {
      overallReason = entityReason || 'Organization or role not substantiated by evidence snippet';
      ungroundedClaims.push({
        section: 'Work Experience',
        text_snippet: String(item.evidence_snippet || '').slice(0, 400),
        ambiguity_reason: `Unverified work experience (${item.organization || 'item'}): ${overallReason}`,
      });
    } else if (unverifiedFields.length > 0) {
      overallReason = `Unverified fields: ${unverifiedFields.join(', ')} (not found in resume text)`;
      ungroundedClaims.push({
        section: 'Work Experience',
        text_snippet: String(item.evidence_snippet || '').slice(0, 400),
        ambiguity_reason: `Unverified fields in ${item.organization}: ${unverifiedFields.join(', ')}`,
      });
    }

    return {
      ...item,
      verification_status: overallVerified ? 'VERIFIED' : 'UNVERIFIED',
      unverified_reason: overallReason,
      field_verification: fieldVerification,
      unverified_fields: unverifiedFields,
    };
  });

  // 5. Education with Field-Level Verification
  const education = (profile.education || []).map((item) => {
    const requiredTokens = item.institution ? [item.institution] : [];
    const keyTokens = [item.institution, item.degree, item.field_of_study].filter(Boolean);
    const { verified: entityVerified, reason: entityReason } = verifySnippet(
      item.evidence_snippet,
      normalizedSource,
      keyTokens,
      requiredTokens
    );

    const fieldVerification = {};
    const unverifiedFields = [];

    // institution
    const hasInst = item.institution && normalizedSource.includes(normalizeText(item.institution));
    fieldVerification.institution = hasInst ? 'VERIFIED' : 'UNVERIFIED';
    if (!hasInst) unverifiedFields.push('institution');

    // degree
    if (item.degree) {
      const normDeg = normalizeText(item.degree);
      const isVerified = normalizedSource.includes(normDeg) || entityVerified;
      fieldVerification.degree = isVerified ? 'VERIFIED' : 'UNVERIFIED';
      if (!isVerified) unverifiedFields.push('degree');
    }

    // start_year
    if (item.start_year) {
      const normYear = normalizeText(item.start_year);
      const isVerified = normalizedSource.includes(normYear);
      fieldVerification.start_year = isVerified ? 'VERIFIED' : 'UNVERIFIED';
      if (!isVerified) unverifiedFields.push('start_year');
    }

    // graduation_year
    if (item.graduation_year) {
      const normYear = normalizeText(item.graduation_year);
      const isVerified = normalizedSource.includes(normYear);
      fieldVerification.graduation_year = isVerified ? 'VERIFIED' : 'UNVERIFIED';
      if (!isVerified) unverifiedFields.push('graduation_year');
    }

    // gpa_or_grade
    if (item.gpa_or_grade) {
      const normGpa = normalizeText(item.gpa_or_grade);
      const isVerified = normalizedSource.includes(normGpa);
      fieldVerification.gpa_or_grade = isVerified ? 'VERIFIED' : 'UNVERIFIED';
      if (!isVerified) unverifiedFields.push('gpa_or_grade');
    }

    const overallVerified = entityVerified && hasInst;
    let overallReason = null;
    if (!overallVerified) {
      overallReason = entityReason || 'Institution not substantiated by evidence snippet';
      ungroundedClaims.push({
        section: 'Education',
        text_snippet: String(item.evidence_snippet || '').slice(0, 400),
        ambiguity_reason: `Unverified education (${item.institution || 'item'}): ${overallReason}`,
      });
    } else if (unverifiedFields.length > 0) {
      overallReason = `Unverified fields: ${unverifiedFields.join(', ')} (not found in resume text)`;
      ungroundedClaims.push({
        section: 'Education',
        text_snippet: String(item.evidence_snippet || '').slice(0, 400),
        ambiguity_reason: `Unverified fields in ${item.institution}: ${unverifiedFields.join(', ')}`,
      });
    }

    return {
      ...item,
      verification_status: overallVerified ? 'VERIFIED' : 'UNVERIFIED',
      unverified_reason: overallReason,
      field_verification: fieldVerification,
      unverified_fields: unverifiedFields,
    };
  });

  // 6. Projects with Field-Level Verification
  const projects = (profile.projects || []).map((item) => {
    const requiredTokens = item.name ? [item.name] : [];
    const { verified: entityVerified, reason: entityReason } = verifySnippet(
      item.evidence_snippet,
      normalizedSource,
      [item.name],
      requiredTokens
    );

    const fieldVerification = {};
    const unverifiedFields = [];

    const hasName = item.name && normalizedSource.includes(normalizeText(item.name));
    fieldVerification.name = hasName ? 'VERIFIED' : 'UNVERIFIED';
    if (!hasName) unverifiedFields.push('name');

    if (item.link_or_url) {
      const isVerified = normalizedSource.includes(normalizeText(item.link_or_url));
      fieldVerification.link_or_url = isVerified ? 'VERIFIED' : 'UNVERIFIED';
      if (!isVerified) unverifiedFields.push('link_or_url');
    }

    const overallVerified = entityVerified && hasName;
    let overallReason = null;
    if (!overallVerified) {
      overallReason = entityReason || 'Project name not substantiated by evidence snippet';
      ungroundedClaims.push({
        section: 'Projects',
        text_snippet: String(item.evidence_snippet || '').slice(0, 400),
        ambiguity_reason: `Unverified project (${item.name || 'item'}): ${overallReason}`,
      });
    } else if (unverifiedFields.length > 0) {
      overallReason = `Unverified fields: ${unverifiedFields.join(', ')}`;
      ungroundedClaims.push({
        section: 'Projects',
        text_snippet: String(item.evidence_snippet || '').slice(0, 400),
        ambiguity_reason: `Unverified fields in ${item.name}: ${unverifiedFields.join(', ')}`,
      });
    }

    return {
      ...item,
      verification_status: overallVerified ? 'VERIFIED' : 'UNVERIFIED',
      unverified_reason: overallReason,
      field_verification: fieldVerification,
      unverified_fields: unverifiedFields,
    };
  });

  // 7. Certifications and Achievements with Field-Level Verification
  const certifications_and_achievements = (profile.certifications_and_achievements || []).map((item) => {
    const requiredTokens = item.title ? [item.title] : [];
    const keyTokens = [item.title, item.issuer].filter(Boolean);
    const { verified: entityVerified, reason: entityReason } = verifySnippet(
      item.evidence_snippet,
      normalizedSource,
      keyTokens,
      requiredTokens
    );

    const fieldVerification = {};
    const unverifiedFields = [];

    const hasTitle = item.title && normalizedSource.includes(normalizeText(item.title));
    fieldVerification.title = hasTitle ? 'VERIFIED' : 'UNVERIFIED';
    if (!hasTitle) unverifiedFields.push('title');

    if (item.issuer) {
      const isVerified = normalizedSource.includes(normalizeText(item.issuer));
      fieldVerification.issuer = isVerified ? 'VERIFIED' : 'UNVERIFIED';
      if (!isVerified) unverifiedFields.push('issuer');
    }

    const overallVerified = entityVerified && hasTitle;
    let overallReason = null;
    if (!overallVerified) {
      overallReason = entityReason || 'Certification title not substantiated by evidence snippet';
      ungroundedClaims.push({
        section: 'Certifications & Achievements',
        text_snippet: String(item.evidence_snippet || '').slice(0, 400),
        ambiguity_reason: `Unverified certification (${item.title || 'item'}): ${overallReason}`,
      });
    } else if (unverifiedFields.length > 0) {
      overallReason = `Unverified fields: ${unverifiedFields.join(', ')}`;
      ungroundedClaims.push({
        section: 'Certifications & Achievements',
        text_snippet: String(item.evidence_snippet || '').slice(0, 400),
        ambiguity_reason: `Unverified fields in ${item.title}: ${unverifiedFields.join(', ')}`,
      });
    }

    return {
      ...item,
      verification_status: overallVerified ? 'VERIFIED' : 'UNVERIFIED',
      unverified_reason: overallReason,
      field_verification: fieldVerification,
      unverified_fields: unverifiedFields,
    };
  });

  // Combine original ambiguous items with newly detected ungrounded claims
  const ambiguous_or_unclear_items = [
    ...(Array.isArray(profile.ambiguous_or_unclear_items) ? profile.ambiguous_or_unclear_items : []),
    ...ungroundedClaims,
  ];

  return {
    professional_summary,
    technical_skills,
    soft_skills,
    education,
    work_experience,
    projects,
    certifications_and_achievements,
    ambiguous_or_unclear_items,
  };
};

/**
 * Stage 3: Grounding Verification for AI-Powered Contextual Job Comparison
 *
 * Verifies that all contextual insights, strengths, gaps, requirement analyses,
 * and transferable experience claims are grounded in the sanitized resume and job text,
 * and preserves deterministic match invariants.
 *
 * @param {object} comparison - Raw model output for comparison
 * @param {string} sanitizedResumeText - Sanitized resume text
 * @param {string} [sanitizedJobText=''] - Sanitized job description text
 * @param {object} [deterministicResults=null] - Authoritative deterministic results
 * @returns {object} Fully grounded and verified comparison object
 */
export const verifyComparisonGrounding = (
  comparison,
  sanitizedResumeText,
  sanitizedJobText = '',
  deterministicResults = null
) => {
  if (!comparison || typeof comparison !== 'object') {
    return comparison;
  }

  const normResume = normalizeText(sanitizedResumeText);
  const normJob = normalizeText(sanitizedJobText);

  // 1. Deterministic skill lookup for cross-check
  const deterministicMissingSkills = new Set();
  const deterministicMatchedSkills = new Set();

  if (deterministicResults) {
    if (Array.isArray(deterministicResults.skills)) {
      for (const s of deterministicResults.skills) {
        const normName = normalizeText(s.skill_name);
        if (s.status === 'MATCHED') {
          deterministicMatchedSkills.add(normName);
        } else if (s.status === 'MISSING') {
          deterministicMissingSkills.add(normName);
        }
      }
    }
    if (Array.isArray(deterministicResults.required_skills_missing)) {
      for (const s of deterministicResults.required_skills_missing) {
        deterministicMissingSkills.add(normalizeText(s));
      }
    }
    if (Array.isArray(deterministicResults.required_skills_matched)) {
      for (const s of deterministicResults.required_skills_matched) {
        deterministicMatchedSkills.add(normalizeText(s));
      }
    }
    if (Array.isArray(deterministicResults.missing_required)) {
      for (const s of deterministicResults.missing_required) {
        deterministicMissingSkills.add(normalizeText(s));
      }
    }
    if (Array.isArray(deterministicResults.matched_required)) {
      for (const s of deterministicResults.matched_required) {
        deterministicMatchedSkills.add(normalizeText(s));
      }
    }
  }

  const isAbsenceClaim = (text) => {
    if (typeof text !== 'string') return false;
    return /\b(no|none|lack|lacks|lacking|missing|without|not found|not identified|no verified)\b/i.test(text);
  };

  // 2. Ground overall_context
  let overall_context = {
    source_type: comparison.overall_context?.source_type || 'RESUME_EVIDENCE',
    summary: '',
    evidence_snippet: null,
    verification_status: 'UNVERIFIED',
    unverified_reason: 'Missing overall context',
  };

  if (comparison.overall_context) {
    const rawSummary =
      typeof comparison.overall_context === 'string'
        ? comparison.overall_context
        : comparison.overall_context.summary || '';
    const sourceType = comparison.overall_context.source_type;
    let snippet =
      typeof comparison.overall_context === 'object'
        ? comparison.overall_context.evidence_snippet
        : null;

    let verified = false;
    let reason = null;

    if (sourceType === 'RESUME_EVIDENCE') {
      if (!snippet || typeof snippet !== 'string' || snippet.trim().length < 3) {
        verified = false;
        reason = 'Missing supporting evidence snippet from resume';
      } else {
        const snippetCheck = verifySnippet(snippet, normResume);
        if (!snippetCheck.verified) {
          verified = false;
          reason = snippetCheck.reason || 'Evidence snippet not found in candidate resume text';
        } else if (isAbsenceClaim(rawSummary) && !normResume.includes(normalizeText(snippet))) {
          verified = false;
          reason = 'Absence of evidence claims cannot be attributed to RESUME_EVIDENCE without verbatim source text';
        } else {
          verified = true;
          // Verify factual numeric experience claims (e.g. "5 years of experience")
          const expMatch = rawSummary.match(/\b(\d+)\+?\s*(?:years?|yrs?)\b/i);
          if (expMatch) {
            const claimedYears = expMatch[1];
            const hasSourceSupport =
              normResume.includes(`${claimedYears} year`) ||
              normResume.includes(`${claimedYears} yr`) ||
              normResume.includes(`${claimedYears}+ year`);
            if (!hasSourceSupport) {
              verified = false;
              reason = `Factual experience claim (${claimedYears} years) not substantiated by resume text`;
            }
          }
        }
      }
    } else if (sourceType === 'DETERMINISTIC_ANALYSIS') {
      snippet = null;
      verified = true;
      reason = null;
    } else if (sourceType === 'JOB_REQUIREMENT') {
      if (snippet) {
        if (!normJob.includes(normalizeText(snippet))) {
          verified = false;
          reason = 'Evidence snippet not found in job description';
        } else {
          verified = true;
        }
      } else {
        verified = true;
      }
    } else {
      verified = false;
      reason = `Invalid source_type: ${sourceType}`;
    }

    overall_context = {
      source_type: sourceType,
      summary: rawSummary,
      evidence_snippet: snippet || null,
      verification_status: verified ? 'VERIFIED' : 'UNVERIFIED',
      unverified_reason: verified ? null : reason,
    };
  }

  // 3. Ground strengths
  const strengths = (Array.isArray(comparison.strengths) ? comparison.strengths : []).map((item) => {
    const claim = String(item.claim || '').trim();
    const sourceType = item.source_type;
    let snippet = item.evidence_snippet ? String(item.evidence_snippet).trim() : null;

    if (sourceType === 'RESUME_EVIDENCE') {
      if (!snippet) {
        return {
          claim,
          source_type: sourceType,
          evidence_snippet: null,
          verification_status: 'UNVERIFIED',
          unverified_reason: 'Missing evidence snippet for claimed strength',
        };
      }

      if (isAbsenceClaim(claim) && !normResume.includes(normalizeText(snippet))) {
        return {
          claim,
          source_type: sourceType,
          evidence_snippet: snippet,
          verification_status: 'UNVERIFIED',
          unverified_reason: 'Absence of evidence claims cannot be attributed to RESUME_EVIDENCE without verbatim source text',
        };
      }

      const snippetCheck = verifySnippet(snippet, normResume);
      if (!snippetCheck.verified) {
        return {
          claim,
          source_type: sourceType,
          evidence_snippet: snippet,
          verification_status: 'UNVERIFIED',
          unverified_reason: snippetCheck.reason || 'Evidence snippet not found in candidate resume text',
        };
      }

      return {
        claim,
        source_type: sourceType,
        evidence_snippet: snippet,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    if (sourceType === 'DETERMINISTIC_ANALYSIS') {
      snippet = null;
      const normClaim = normalizeText(claim);
      for (const missingSkill of deterministicMissingSkills) {
        if (missingSkill.length > 2 && normClaim.includes(missingSkill)) {
          return {
            claim,
            source_type: sourceType,
            evidence_snippet: null,
            verification_status: 'UNVERIFIED',
            unverified_reason: `Claimed strength contradicts deterministic match: skill '${missingSkill}' is missing`,
          };
        }
      }
      return {
        claim,
        source_type: sourceType,
        evidence_snippet: null,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    if (sourceType === 'JOB_REQUIREMENT') {
      return {
        claim,
        source_type: sourceType,
        evidence_snippet: snippet,
        verification_status: 'UNVERIFIED',
        unverified_reason: 'Job requirements cannot be attributed as candidate strengths',
      };
    }

    return {
      claim,
      source_type: sourceType,
      evidence_snippet: snippet,
      verification_status: 'UNVERIFIED',
      unverified_reason: `Unrecognized source_type '${sourceType}'`,
    };
  });

  // 4. Ground gaps
  const gaps = (Array.isArray(comparison.gaps) ? comparison.gaps : []).map((item) => {
    const claim = String(item.claim || '').trim();
    const sourceType = item.source_type;
    let snippet = item.evidence_snippet ? String(item.evidence_snippet).trim() : null;

    if (sourceType === 'RESUME_EVIDENCE') {
      if (!snippet) {
        return {
          claim,
          source_type: sourceType,
          evidence_snippet: null,
          verification_status: 'UNVERIFIED',
          unverified_reason: 'Missing evidence snippet for claimed resume evidence',
        };
      }

      const snippetNorm = normalizeText(snippet);
      const isLiteralNegativeInResume = normResume.includes(snippetNorm) && isAbsenceClaim(snippet);
      if (isAbsenceClaim(claim) && !isLiteralNegativeInResume) {
        return {
          claim,
          source_type: sourceType,
          evidence_snippet: snippet,
          verification_status: 'UNVERIFIED',
          unverified_reason: 'Absence of evidence claims cannot be attributed to RESUME_EVIDENCE without verbatim source text',
        };
      }

      const snippetCheck = verifySnippet(snippet, normResume);
      if (!snippetCheck.verified) {
        return {
          claim,
          source_type: sourceType,
          evidence_snippet: snippet,
          verification_status: 'UNVERIFIED',
          unverified_reason: snippetCheck.reason || 'Evidence snippet not found in candidate resume text',
        };
      }

      return {
        claim,
        source_type: sourceType,
        evidence_snippet: snippet,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    if (sourceType === 'DETERMINISTIC_ANALYSIS') {
      snippet = null; // Deterministic analysis must have evidence_snippet = null
      const normClaim = normalizeText(claim);
      for (const matchedSkill of deterministicMatchedSkills) {
        if (matchedSkill.length > 2 && normClaim.includes(matchedSkill)) {
          return {
            claim,
            source_type: sourceType,
            evidence_snippet: null,
            verification_status: 'UNVERIFIED',
            unverified_reason: `Claimed gap contradicts deterministic match: skill '${matchedSkill}' is present in resume`,
          };
        }
      }
      return {
        claim,
        source_type: sourceType,
        evidence_snippet: null,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    if (sourceType === 'JOB_REQUIREMENT') {
      if (snippet && !normJob.includes(normalizeText(snippet))) {
        return {
          claim,
          source_type: sourceType,
          evidence_snippet: snippet,
          verification_status: 'UNVERIFIED',
          unverified_reason: 'Evidence snippet not found in job description',
        };
      }
      return {
        claim,
        source_type: sourceType,
        evidence_snippet: snippet,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    return {
      claim,
      source_type: sourceType,
      evidence_snippet: snippet,
      verification_status: 'UNVERIFIED',
      unverified_reason: `Unrecognized source_type '${sourceType}'`,
    };
  });

  // 5. Ground requirement_analysis
  const requirement_analysis = (
    Array.isArray(comparison.requirement_analysis) ? comparison.requirement_analysis : []
  ).map((item) => {
    const requirement = String(item.requirement || '').trim();
    const context = String(item.context || '').trim();
    const sourceType = item.source_type;
    let snippet = item.evidence_snippet ? String(item.evidence_snippet).trim() : null;
    let matchType = item.match_type;
    if (!['EXACT_MATCH', 'ADJACENT', 'NO_EVIDENCE'].includes(matchType)) {
      matchType = 'NO_EVIDENCE';
    }

    const normReq = normalizeText(requirement);

    // Contradiction Check 1: If deterministic analysis says this skill is MISSING, Gemini cannot claim EXACT_MATCH
    if (matchType === 'EXACT_MATCH' && deterministicMissingSkills.has(normReq)) {
      return {
        requirement,
        context,
        source_type: sourceType,
        evidence_snippet: snippet,
        match_type: matchType,
        verification_status: 'UNVERIFIED',
        unverified_reason: `Claimed exact match contradicts deterministic matching: '${requirement}' is missing in resume`,
      };
    }

    // Contradiction Check 2: JOB_REQUIREMENT cannot be claimed as candidate EXACT_MATCH
    if (matchType === 'EXACT_MATCH' && sourceType === 'JOB_REQUIREMENT') {
      return {
        requirement,
        context,
        source_type: sourceType,
        evidence_snippet: snippet,
        match_type: matchType,
        verification_status: 'UNVERIFIED',
        unverified_reason: 'Job requirement cannot be asserted as candidate exact match evidence',
      };
    }

    if (sourceType === 'RESUME_EVIDENCE') {
      if (matchType === 'NO_EVIDENCE') {
        const isLiteralNegativeInResume = snippet && normResume.includes(normalizeText(snippet)) && isAbsenceClaim(snippet);
        if (!isLiteralNegativeInResume) {
          return {
            requirement,
            context,
            source_type: sourceType,
            evidence_snippet: snippet,
            match_type: matchType,
            verification_status: 'UNVERIFIED',
            unverified_reason: 'Absence of evidence claims cannot be attributed to RESUME_EVIDENCE without verbatim source text',
          };
        }
      }

      if (!snippet) {
        return {
          requirement,
          context,
          source_type: sourceType,
          evidence_snippet: null,
          match_type: matchType,
          verification_status: 'UNVERIFIED',
          unverified_reason: `Missing evidence snippet for ${matchType === 'EXACT_MATCH' ? 'exact match' : 'claimed resume evidence'}`,
        };
      }

      const snippetCheck = verifySnippet(snippet, normResume);
      if (!snippetCheck.verified) {
        return {
          requirement,
          context,
          source_type: sourceType,
          evidence_snippet: snippet,
          match_type: matchType,
          verification_status: 'UNVERIFIED',
          unverified_reason: snippetCheck.reason || 'Evidence snippet not found in candidate resume text',
        };
      }

      return {
        requirement,
        context,
        source_type: sourceType,
        evidence_snippet: snippet,
        match_type: matchType,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    if (sourceType === 'DETERMINISTIC_ANALYSIS') {
      snippet = null; // Must be null
      if (matchType === 'EXACT_MATCH') {
        if (!deterministicMatchedSkills.has(normReq)) {
          return {
            requirement,
            context,
            source_type: sourceType,
            evidence_snippet: null,
            match_type: matchType,
            verification_status: 'UNVERIFIED',
            unverified_reason: `Deterministic analysis does not confirm '${requirement}' as matched`,
          };
        }
      }
      return {
        requirement,
        context,
        source_type: sourceType,
        evidence_snippet: null,
        match_type: matchType,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    if (sourceType === 'JOB_REQUIREMENT') {
      if (snippet && !normJob.includes(normalizeText(snippet))) {
        return {
          requirement,
          context,
          source_type: sourceType,
          evidence_snippet: snippet,
          match_type: matchType,
          verification_status: 'UNVERIFIED',
          unverified_reason: 'Evidence snippet not found in job description',
        };
      }
      return {
        requirement,
        context,
        source_type: sourceType,
        evidence_snippet: snippet,
        match_type: matchType,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    return {
      requirement,
      context,
      source_type: sourceType,
      evidence_snippet: snippet,
      match_type: matchType,
      verification_status: 'UNVERIFIED',
      unverified_reason: `Unrecognized source_type '${sourceType}'`,
    };
  });

  // 6. Ground transferable_experience
  const transferable_experience = (
    Array.isArray(comparison.transferable_experience) ? comparison.transferable_experience : []
  ).map((item) => {
    const claim = String(item.claim || '').trim();
    const sourceType = item.source_type;
    let snippet = item.evidence_snippet ? String(item.evidence_snippet).trim() : null;

    if (sourceType === 'RESUME_EVIDENCE') {
      if (!snippet) {
        return {
          claim,
          source_type: sourceType,
          evidence_snippet: null,
          verification_status: 'UNVERIFIED',
          unverified_reason: 'Missing evidence snippet for transferable experience',
        };
      }

      const snippetCheck = verifySnippet(snippet, normResume);
      if (!snippetCheck.verified) {
        return {
          claim,
          source_type: sourceType,
          evidence_snippet: snippet,
          verification_status: 'UNVERIFIED',
          unverified_reason: snippetCheck.reason || 'Evidence snippet not found in candidate resume text',
        };
      }

      return {
        claim,
        source_type: sourceType,
        evidence_snippet: snippet,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    if (sourceType === 'DETERMINISTIC_ANALYSIS') {
      return {
        claim,
        source_type: sourceType,
        evidence_snippet: null,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    if (sourceType === 'JOB_REQUIREMENT') {
      if (snippet && !normJob.includes(normalizeText(snippet))) {
        return {
          claim,
          source_type: sourceType,
          evidence_snippet: snippet,
          verification_status: 'UNVERIFIED',
          unverified_reason: 'Evidence snippet not found in job description',
        };
      }
      return {
        claim,
        source_type: sourceType,
        evidence_snippet: snippet,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    return {
      claim,
      source_type: sourceType,
      evidence_snippet: snippet,
      verification_status: 'UNVERIFIED',
      unverified_reason: `Unrecognized source_type '${sourceType}'`,
    };
  });

  // 7. Ground recommendations
  const recommendations = (
    Array.isArray(comparison.recommendations) ? comparison.recommendations : []
  ).map((item) => {
    const recommendation = String(item.recommendation || '').trim();
    const reason = String(item.reason || '').trim();
    const sourceType = item.source_type;
    let snippet = item.evidence_snippet ? String(item.evidence_snippet).trim() : null;

    if (sourceType === 'RESUME_EVIDENCE') {
      // Recommendation based on resume evidence (e.g. improving an existing resume achievement/bullet)
      if (!snippet) {
        return {
          recommendation,
          reason,
          source_type: sourceType,
          evidence_snippet: null,
          verification_status: 'UNVERIFIED',
          unverified_reason: 'Missing evidence snippet for resume-based recommendation',
        };
      }

      const snippetCheck = verifySnippet(snippet, normResume);
      if (!snippetCheck.verified) {
        return {
          recommendation,
          reason,
          source_type: sourceType,
          evidence_snippet: snippet,
          verification_status: 'UNVERIFIED',
          unverified_reason: snippetCheck.reason || 'Evidence snippet not found in candidate resume text',
        };
      }

      return {
        recommendation,
        reason,
        source_type: sourceType,
        evidence_snippet: snippet,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    if (sourceType === 'DETERMINISTIC_ANALYSIS') {
      snippet = null; // No resume snippet for deterministic gap
      return {
        recommendation,
        reason,
        source_type: sourceType,
        evidence_snippet: null,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    if (sourceType === 'JOB_REQUIREMENT') {
      if (snippet && !normJob.includes(normalizeText(snippet))) {
        return {
          recommendation,
          reason,
          source_type: sourceType,
          evidence_snippet: snippet,
          verification_status: 'UNVERIFIED',
          unverified_reason: 'Evidence snippet not found in job description',
        };
      }

      return {
        recommendation,
        reason,
        source_type: sourceType,
        evidence_snippet: snippet,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      };
    }

    return {
      recommendation,
      reason,
      source_type: sourceType,
      evidence_snippet: snippet,
      verification_status: 'UNVERIFIED',
      unverified_reason: `Unrecognized source_type '${sourceType}'`,
    };
  });

  return {
    overall_context,
    strengths,
    gaps,
    requirement_analysis,
    transferable_experience,
    recommendations,
  };
};

export default {
  normalizeText,
  verifySnippet,
  verifyProfileGrounding,
  verifyComparisonGrounding,
};
