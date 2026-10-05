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

/**
 * Stage 4: Grounding Verification for Personalized Recommendations
 *
 * Enforces:
 * 1. Category <-> Source Type invariants:
 *    - SKILL_GAP -> DETERMINISTIC_ANALYSIS (null snippet)
 *    - RESUME_STRENGTH -> RESUME_EVIDENCE (valid snippet in resume, no absence claim, no redaction marker)
 *    - JOB_REQUIREMENT -> JOB_REQUIREMENT (valid snippet in job if present; NEVER candidate possession)
 * 2. Deterministic priority authority:
 *    - Missing REQUIRED -> HIGH
 *    - Missing PREFERRED -> MEDIUM
 *    - Inconsistent priorities are locked to deterministic value and marked UNVERIFIED
 * 3. JOB_REQUIREMENT candidate possession non-attribution:
 *    - Claiming candidate possession under JOB_REQUIREMENT -> UNVERIFIED
 * 4. Overall Strategy synthesis-only invariant:
 *    - Must not introduce unsupported candidate facts (leadership, years, skills, certifications,
 *      metrics/achievements, projects, education, domain experience)
 *    - Contradicting deterministic missing skills -> UNVERIFIED
 *    - All recommendations ungrounded -> UNVERIFIED
 *
 * @param {object} params
 * @param {Array} params.recommendations
 * @param {object} params.overall_strategy
 * @param {string} params.resumeText
 * @param {string} [params.jobDescription='']
 * @param {object} [params.deterministicResults=null]
 * @returns {object} Grounded recommendations output
 */
export const verifyRecommendationGrounding = ({
  recommendations = [],
  overall_strategy = {},
  resumeText = '',
  jobDescription = '',
  deterministicResults = null,
} = {}) => {
  const normResume = normalizeText(resumeText);
  const normJob = normalizeText(jobDescription);

  const REDACTION_MARKER_REGEX = /\[[A-Z_\s]+REDACTED\]/i;
  const containsRedactionMarker = (str) => typeof str === 'string' && REDACTION_MARKER_REGEX.test(str);

  const isAbsenceClaim = (text) => {
    if (typeof text !== 'string') return false;
    return /\b(no|none|lack|lacks|lacking|missing|without|not found|not identified|no verified)\b/i.test(text);
  };

  // 1. Build deterministic skill lookup sets
  const requiredSkillsMissing = new Set();
  const requiredSkillsMatched = new Set();
  const preferredSkillsMissing = new Set();
  const preferredSkillsMatched = new Set();

  if (deterministicResults) {
    if (Array.isArray(deterministicResults.skills)) {
      for (const s of deterministicResults.skills) {
        const normName = normalizeText(s.skill_name);
        if (s.requirement_type === 'REQUIRED') {
          if (s.status === 'MATCHED') requiredSkillsMatched.add(normName);
          else if (s.status === 'MISSING') requiredSkillsMissing.add(normName);
        } else if (s.requirement_type === 'PREFERRED') {
          if (s.status === 'MATCHED') preferredSkillsMatched.add(normName);
          else if (s.status === 'MISSING') preferredSkillsMissing.add(normName);
        }
      }
    }
    if (Array.isArray(deterministicResults.required_skills_missing)) {
      for (const s of deterministicResults.required_skills_missing) requiredSkillsMissing.add(normalizeText(s));
    }
    if (Array.isArray(deterministicResults.required_skills_matched)) {
      for (const s of deterministicResults.required_skills_matched) requiredSkillsMatched.add(normalizeText(s));
    }
    if (Array.isArray(deterministicResults.preferred_skills_missing)) {
      for (const s of deterministicResults.preferred_skills_missing) preferredSkillsMissing.add(normalizeText(s));
    }
    if (Array.isArray(deterministicResults.preferred_skills_matched)) {
      for (const s of deterministicResults.preferred_skills_matched) preferredSkillsMatched.add(normalizeText(s));
    }
    if (Array.isArray(deterministicResults.missing_required)) {
      for (const s of deterministicResults.missing_required) requiredSkillsMissing.add(normalizeText(s));
    }
    if (Array.isArray(deterministicResults.matched_required)) {
      for (const s of deterministicResults.matched_required) requiredSkillsMatched.add(normalizeText(s));
    }
  }

  const allDeterministicMissing = new Set([...requiredSkillsMissing, ...preferredSkillsMissing]);
  const allDeterministicMatched = new Set([...requiredSkillsMatched, ...preferredSkillsMatched]);

  // Helper: check if text indicates candidate possession of a skill/requirement
  const claimsCandidatePossession = (text) => {
    if (typeof text !== 'string') return false;
    const possessionRegex = /\b(?:candidate|applicant|resume|you)\s+(?:has|possesses|demonstrates|features|meets|holds|exhibits|brings|showcases|already\s+has)\b/i;
    const candidateExperienceRegex = /\b(?:candidate's|applicant's|your)\s+(?:strong|proven|extensive|verified|deep|hands-on|solid)\s+(?:experience|skill|background|knowledge)\b/i;
    const directClaimRegex = /\b(?:already\s+possesses|already\s+mastered|has\s+proven|demonstrated\s+mastery|fully\s+meets)\b/i;
    return possessionRegex.test(text) || candidateExperienceRegex.test(text) || directClaimRegex.test(text);
  };

  // 2. Ground recommendation items
  const groundedRecommendations = (Array.isArray(recommendations) ? recommendations : []).map((item) => {
    const category = item.category;
    const sourceType = item.source_type;
    const title = String(item.title || '').trim();
    const recommendation = String(item.recommendation || '').trim();
    const rationale = String(item.rationale || '').trim();
    let priority = item.priority;
    let snippet = item.evidence_snippet ? String(item.evidence_snippet).trim() : null;

    let verification_status = 'VERIFIED';
    let unverified_reason = null;

    // Check A: Category <-> Source Type
    if (category === 'SKILL_GAP') {
      if (sourceType !== 'DETERMINISTIC_ANALYSIS') {
        verification_status = 'UNVERIFIED';
        unverified_reason = 'SKILL_GAP recommendations must have source_type DETERMINISTIC_ANALYSIS';
      }
      snippet = null; // Enforce null evidence_snippet

      // Check contradiction with deterministic matches
      const combinedText = normalizeText(`${title} ${recommendation} ${rationale}`);
      for (const matchedSkill of allDeterministicMatched) {
        if (matchedSkill.length > 2 && combinedText.includes(matchedSkill)) {
          // Check if this matched skill is also listed as missing (should not happen, but safeguard)
          if (!allDeterministicMissing.has(matchedSkill)) {
            // Contradiction: skill is matched, not missing
            if (combinedText.includes(`missing ${matchedSkill}`) || combinedText.includes(`gap ${matchedSkill}`) || combinedText.includes(`lack of ${matchedSkill}`)) {
              verification_status = 'UNVERIFIED';
              unverified_reason = `Claimed gap contradicts deterministic match: skill '${matchedSkill}' is present in resume`;
            }
          }
        }
      }

      // Priority Authority Enforcement
      let isRequiredGap = false;
      let isPreferredGap = false;
      for (const reqSkill of requiredSkillsMissing) {
        if (reqSkill.length > 1 && combinedText.includes(reqSkill)) {
          isRequiredGap = true;
          break;
        }
      }
      if (!isRequiredGap) {
        for (const prefSkill of preferredSkillsMissing) {
          if (prefSkill.length > 1 && combinedText.includes(prefSkill)) {
            isPreferredGap = true;
            break;
          }
        }
      }

      if (isRequiredGap) {
        if (priority !== 'HIGH') {
          priority = 'HIGH'; // Lock to deterministic value
          verification_status = 'UNVERIFIED';
          unverified_reason = 'Priority overridden to match deterministic requirement type (REQUIRED -> HIGH)';
        }
      } else if (isPreferredGap) {
        if (priority !== 'MEDIUM') {
          priority = 'MEDIUM'; // Lock to deterministic value
          verification_status = 'UNVERIFIED';
          unverified_reason = 'Priority overridden to match deterministic requirement type (PREFERRED -> MEDIUM)';
        }
      }
    } else if (category === 'RESUME_STRENGTH') {
      if (sourceType !== 'RESUME_EVIDENCE') {
        verification_status = 'UNVERIFIED';
        unverified_reason = 'RESUME_STRENGTH recommendations must have source_type RESUME_EVIDENCE';
      }

      if (!snippet) {
        verification_status = 'UNVERIFIED';
        unverified_reason = 'Missing evidence snippet for claimed resume strength';
      } else if (containsRedactionMarker(snippet)) {
        verification_status = 'UNVERIFIED';
        unverified_reason = 'Redaction markers cannot be accepted as resume evidence';
      } else if (isAbsenceClaim(recommendation) || isAbsenceClaim(rationale) || isAbsenceClaim(title)) {
        verification_status = 'UNVERIFIED';
        unverified_reason = 'Absence of evidence claims cannot be attributed to RESUME_EVIDENCE without verbatim source text';
      } else {
        const snippetCheck = verifySnippet(snippet, normResume);
        if (!snippetCheck.verified) {
          verification_status = 'UNVERIFIED';
          unverified_reason = snippetCheck.reason || 'Evidence snippet not found in candidate resume text';
        }
      }
    } else if (category === 'JOB_REQUIREMENT') {
      if (sourceType !== 'JOB_REQUIREMENT') {
        verification_status = 'UNVERIFIED';
        unverified_reason = 'JOB_REQUIREMENT recommendations must have source_type JOB_REQUIREMENT';
      }

      if (snippet && !normJob.includes(normalizeText(snippet))) {
        verification_status = 'UNVERIFIED';
        unverified_reason = 'Evidence snippet not found in job description';
      }

      // JOB_REQUIREMENT candidate possession non-attribution
      if (claimsCandidatePossession(recommendation) || claimsCandidatePossession(rationale)) {
        verification_status = 'UNVERIFIED';
        unverified_reason = 'Job requirement cannot be asserted as candidate possession';
      }
    }

    return {
      id: item.id || `rec-${Math.random().toString(36).substr(2, 9)}`,
      category,
      source_type: sourceType,
      title,
      recommendation,
      rationale,
      priority,
      evidence_snippet: snippet,
      verification_status,
      unverified_reason,
    };
  });

  // 3. Ground overall_strategy (Generic Invariant)
  const rawStrategySummary = String(overall_strategy?.summary || '').trim();
  let strategyStatus = 'VERIFIED';
  let strategyReason = null;

  if (!rawStrategySummary) {
    strategyStatus = 'UNVERIFIED';
    strategyReason = 'Missing overall strategy summary';
  } else if (groundedRecommendations.length > 0 && groundedRecommendations.every((r) => r.verification_status === 'UNVERIFIED')) {
    // If all recommendations are ungrounded -> strategy must be UNVERIFIED
    strategyStatus = 'UNVERIFIED';
    strategyReason = 'Strategy based entirely on ungrounded recommendations';
  } else {
    const normStrategy = normalizeText(rawStrategySummary);

    // Check A: Contradicts deterministic missing skills
    for (const missingSkill of allDeterministicMissing) {
      if (missingSkill.length > 2) {
        // e.g., claims candidate has strong AWS experience or production AWS when AWS is missing
        const skillPossessionPatterns = [
          new RegExp(`\\b(?:strong|production|proven|extensive|solid|deep|hands-on)\\s+${missingSkill}\\b`, 'i'),
          new RegExp(`\\b${missingSkill}\\s+(?:experience|mastery|skills?|expertise)\\b`, 'i'),
          new RegExp(`\\b(?:proficient|skilled|experienced)\\s+in\\s+${missingSkill}\\b`, 'i'),
          new RegExp(`\\bleveraging\\s+(?:your|candidate's)?\\s+${missingSkill}\\b`, 'i'),
        ];
        if (skillPossessionPatterns.some((pattern) => pattern.test(rawStrategySummary))) {
          strategyStatus = 'UNVERIFIED';
          strategyReason = `Strategy contradicts deterministic missing skill: '${missingSkill}'`;
          break;
        }
      }
    }

    // Check B: Generic candidate factual claims invariant
    // Must be traceable to grounded RESUME_EVIDENCE items, deterministic facts, or normResume
    if (strategyStatus === 'VERIFIED') {
      const groundedSnippets = groundedRecommendations
        .filter((r) => r.verification_status === 'VERIFIED' && r.evidence_snippet)
        .map((r) => normalizeText(r.evidence_snippet))
        .join(' ');
      const groundedResumeCorpus = `${normResume} ${groundedSnippets}`;

      // B1: Leadership claims
      if (/\b(?:extensive\s+leadership|strong\s+leadership|leadership\s+experience|engineering\s+director|lead\s+architect|head\s+of\s+engineering|managed\s+teams?|led\s+teams?)\b/i.test(rawStrategySummary)) {
        const hasLeadershipSupport = /\b(?:leadership|leader|managed\s+teams?|lead\s+architect|director)\b/i.test(groundedResumeCorpus);
        if (!hasLeadershipSupport) {
          strategyStatus = 'UNVERIFIED';
          strategyReason = 'Strategy introduces unsupported candidate factual claims (leadership)';
        }
      }

      // B2: Years of experience claims
      if (strategyStatus === 'VERIFIED') {
        const yearsMatch = rawStrategySummary.match(/\b(\d+)\+?\s*(?:years?|yrs?)\b/i);
        if (yearsMatch) {
          const claimedYears = yearsMatch[1];
          const hasYearsSupport =
            groundedResumeCorpus.includes(`${claimedYears} year`) ||
            groundedResumeCorpus.includes(`${claimedYears} yr`) ||
            groundedResumeCorpus.includes(`${claimedYears}+ year`);
          if (!hasYearsSupport) {
            strategyStatus = 'UNVERIFIED';
            strategyReason = `Strategy introduces unsupported candidate factual claims (${claimedYears} years experience)`;
          }
        }
      }

      // B3: Metrics / Achievements claims (e.g. 50% improvement, $10M budget, 10k req/s)
      if (strategyStatus === 'VERIFIED') {
        const metricMatch = rawStrategySummary.match(/\b(?:\d+%\s*(?:reduction|improvement|increase|growth|latency)|reduced\s+latency|scaled\s+(?:systems?|services?)\s+to\s+\d+|processing\s+\d+\s*(?:k|m|req)|managed\s+\$(?:\d+|[\d.]+m))\b/i);
        if (metricMatch) {
          const metricText = normalizeText(metricMatch[0]);
          if (!groundedResumeCorpus.includes(metricText)) {
            strategyStatus = 'UNVERIFIED';
            strategyReason = `Strategy introduces unsupported candidate factual claims (metric/achievement: ${metricMatch[0]})`;
          }
        }
      }

      // B4: Unsupported projects / architectures
      if (strategyStatus === 'VERIFIED') {
        const projectMatch = rawStrategySummary.match(/\b(?:automated\s+fraud|microservices?\s+platform|migration\s+to\s+microservices?|e-commerce\s+platform|data\s+pipeline)\b/i);
        if (projectMatch) {
          const projectText = normalizeText(projectMatch[0]);
          if (!groundedResumeCorpus.includes(projectText)) {
            strategyStatus = 'UNVERIFIED';
            strategyReason = `Strategy introduces unsupported candidate factual claims (project: ${projectMatch[0]})`;
          }
        }
      }

      // B5: Unsupported education / degrees (Master's degree, Stanford, MIT, PhD)
      if (strategyStatus === 'VERIFIED') {
        const eduMatch = rawStrategySummary.match(/\b(?:master's|masters\s+degree|phd|bachelor's|degree\s+in\s+machine\s+learning|stanford|mit|harvard)\b/i);
        if (eduMatch) {
          const eduText = normalizeText(eduMatch[0]);
          if (!groundedResumeCorpus.includes(eduText)) {
            strategyStatus = 'UNVERIFIED';
            strategyReason = `Strategy introduces unsupported candidate factual claims (education: ${eduMatch[0]})`;
          }
        }
      }

      // B6: Unsupported domain expertise (FinTech banking, healthcare regulatory, etc.)
      if (strategyStatus === 'VERIFIED') {
        const domainMatch = rawStrategySummary.match(/\b(?:fintech|banking|healthcare|regulatory|compliance)\s+(?:domain|expertise|experience)\b/i);
        if (domainMatch) {
          const domainText = normalizeText(domainMatch[0]);
          if (!groundedResumeCorpus.includes(domainText)) {
            strategyStatus = 'UNVERIFIED';
            strategyReason = `Strategy introduces unsupported candidate factual claims (domain: ${domainMatch[0]})`;
          }
        }
      }

      // B7: Unsupported technologies claimed as candidate capability
      if (strategyStatus === 'VERIFIED') {
        const techMatch = rawStrategySummary.match(/\b(?:leveraging\s+(?:your|candidate's)?|with\s+your|using\s+your|extensive\s+experience\s+in)\s+([a-zA-Z0-9+#]+)\b/i);
        if (techMatch) {
          const claimedTech = normalizeText(techMatch[1]);
          const techInResume = groundedResumeCorpus.includes(claimedTech);
          const techInMatched = allDeterministicMatched.has(claimedTech);
          if (!techInResume && !techInMatched) {
            strategyStatus = 'UNVERIFIED';
            strategyReason = `Strategy introduces unsupported candidate factual claims (technology: ${techMatch[1]})`;
          }
        }
      }

      // B8: Unsupported certifications
      if (strategyStatus === 'VERIFIED') {
        const certMatch = rawStrategySummary.match(/\b(?:solutions\s+architect|pmp\s+certified|certified\s+scrum\s+master|aws\s+certified)\b/i);
        if (certMatch) {
          const certText = normalizeText(certMatch[0]);
          if (!groundedResumeCorpus.includes(certText)) {
            strategyStatus = 'UNVERIFIED';
            strategyReason = `Strategy introduces unsupported candidate factual claims (certification: ${certMatch[0]})`;
          }
        }
      }
    }
  }

  const groundedOverallStrategy = {
    summary: rawStrategySummary,
    verification_status: strategyStatus,
    unverified_reason: strategyReason,
  };

  return {
    overall_strategy: groundedOverallStrategy,
    recommendations: groundedRecommendations,
  };
};

export default {
  normalizeText,
  verifySnippet,
  verifyProfileGrounding,
  verifyComparisonGrounding,
  verifyRecommendationGrounding,
};

