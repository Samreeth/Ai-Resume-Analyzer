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

export default {
  normalizeText,
  verifySnippet,
  verifyProfileGrounding,
};
