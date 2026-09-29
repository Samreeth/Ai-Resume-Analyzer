/**
 * Skill Extraction and Matching Engine
 * Phase 7 Stage 1: Deterministic Word-Boundary and Section-Aware Matcher
 *
 * Implements consuming-prefix + zero-width lookahead boundaries,
 * strict case-sensitivity for short tokens (C, Go, R),
 * and match-tier precedence scoring.
 */

import { SKILLS_TAXONOMY, SECTION_PATTERNS } from '../config/skills.taxonomy.mjs';

const PREFIX_DELIM = '(?:^|[\\s,;:(/\\[\\{<>"\'`])';
const SUFFIX_DELIM = '(?=$|[\\s,;:)/[\\]\\}<>"\'`!?.\n])';

/**
 * Escape string for safe use inside RegExp
 */
export const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Classify a line or header into a section type
 *
 * @param {string} line
 * @returns {'REQUIRED'|'PREFERRED'|'SKILLS_SECTION'|'UNKNOWN'}
 */
export const classifyHeader = (line) => {
  const clean = line.trim().replace(/^[-*#•\d.)\s]+/, '').trim();
  if (!clean) return 'UNKNOWN';

  for (const pattern of SECTION_PATTERNS.SKILLS_SECTION) {
    if (pattern.test(clean)) return 'SKILLS_SECTION';
  }
  for (const pattern of SECTION_PATTERNS.REQUIRED) {
    if (pattern.test(clean)) return 'REQUIRED';
  }
  for (const pattern of SECTION_PATTERNS.PREFERRED) {
    if (pattern.test(clean)) return 'PREFERRED';
  }

  return 'UNKNOWN';
};

/**
 * Split text into semantic sections based on recognized headers
 *
 * @param {string} text
 * @returns {Array<{ type: string, header: string, content: string }>}
 */
export const splitIntoSections = (text) => {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split(/\r?\n/);
  const sections = [];
  let currentType = 'UNKNOWN';
  let currentHeader = 'Preamble';
  let currentLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      currentLines.push(line);
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    const hasColon = colonIdx > 0 && colonIdx < 50;
    const candidateHeader = hasColon ? trimmed.slice(0, colonIdx).trim() : trimmed;
    const afterColonContent = hasColon ? trimmed.slice(colonIdx + 1).trim() : '';

    const isHeaderCandidate =
      candidateHeader.length > 0 &&
      candidateHeader.length < 50 &&
      (hasColon ||
        candidateHeader.toUpperCase() === candidateHeader ||
        /^(?:requirements|qualifications|skills|technical skills|nice to have|must have|preferred|tech stack)/i.test(candidateHeader));

    if (isHeaderCandidate) {
      const detectedType = classifyHeader(candidateHeader);
      // Only treat as section boundary if recognized type OR short standalone header ending with colon
      if (detectedType !== 'UNKNOWN' || (hasColon && !afterColonContent && candidateHeader.length < 40)) {
        if (currentLines.length > 0) {
          sections.push({
            type: currentType,
            header: currentHeader,
            content: currentLines.join('\n').trim(),
          });
          currentLines = [];
        }
        currentType = detectedType;
        currentHeader = candidateHeader;
        if (afterColonContent) {
          currentLines.push(afterColonContent);
        }
        continue;
      }
    }
    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    sections.push({
      type: currentType,
      header: currentHeader,
      content: currentLines.join('\n').trim(),
    });
  }

  return sections;
};

/**
 * Determine if text block or section represents a dedicated technical skills section.
 * Authoritative signals:
 * 1. Explicit sectionType === 'SKILLS_SECTION'
 * 2. Starts with a recognized skills header cue (e.g. 'Skills:', 'Technical Skills:', 'Tech Stack:')
 * Ordinary narrative or lists within experience/projects must NOT be upgraded to skills sections.
 *
 * @param {string} text
 * @param {string} [sectionType]
 * @returns {boolean}
 */
export const isSkillsSection = (text, sectionType = null) => {
  if (sectionType === 'SKILLS_SECTION') return true;
  if (!text || typeof text !== 'string') return false;

  const firstLine = text.trim().split(/\r?\n/)[0].trim().replace(/^[-*#•\d.)\s]+/, '').trim();
  const colonIdx = firstLine.indexOf(':');
  const headerPart = colonIdx > 0 ? firstLine.slice(0, colonIdx).trim() : firstLine;

  for (const pattern of SECTION_PATTERNS.SKILLS_SECTION) {
    if (pattern.test(headerPart)) return true;
  }

  return false;
};

/**
 * Edge Case Matcher for C
 */
export const matchC = (text, isSection) => {
  const matches = [];

  // 1. C aliases: ANSI C and Embedded C (case-insensitive prefix, C required)
  const aliasRegex = new RegExp(
    `${PREFIX_DELIM}((?:ANSI|Embedded)\\s+C)${SUFFIX_DELIM}`,
    'gi'
  );
  let am;
  while ((am = aliasRegex.exec(text)) !== null) {
    const raw = am[1];
    const startIdx = am.index + am[0].indexOf(raw);
    matches.push({
      token: raw,
      matchType: 'ALIAS',
      index: startIdx,
    });
    aliasRegex.lastIndex = am.index + am[0].length;
  }

  // 2. Standalone C
  if (isSection) {
    // In skills section: Strict uppercase 'C', not followed by + or #, not preceded by Objective- or ANSI/Embedded
    const regex = new RegExp(`${PREFIX_DELIM}(C)(?![+#])${SUFFIX_DELIM}`, 'g');
    let m;
    while ((m = regex.exec(text)) !== null) {
      const startIdx = m.index + m[0].indexOf('C');
      const prefixSlice = text.slice(Math.max(0, startIdx - 15), startIdx);
      if (/Objective-?$/i.test(prefixSlice) || /(?:ANSI|Embedded)\s+$/i.test(prefixSlice)) {
        regex.lastIndex = m.index + m[0].length;
        continue;
      }
      matches.push({ token: 'C', matchType: 'EXACT', index: startIdx });
      regex.lastIndex = m.index + m[0].length;
    }
  } else {
    // Body Text: Strict uppercase 'C' requiring explicit programming context
    const bodyRegex = new RegExp(
      `${PREFIX_DELIM}(?:(C)(?![+#])\\s+(?:language|programming|developer|compiler|code)|(C)(?=\\s*\\/\\s*C\\+\\+)|(C)(?=\\s+and\\s+C\\+\\+))${SUFFIX_DELIM}`,
      'g'
    );
    let m;
    while ((m = bodyRegex.exec(text)) !== null) {
      const token = m[1] || m[2] || m[3];
      const startIdx = m.index + m[0].indexOf(token);
      const prefixSlice = text.slice(Math.max(0, startIdx - 15), startIdx);
      if (/Objective-?$/i.test(prefixSlice) || /(?:ANSI|Embedded)\s+$/i.test(prefixSlice)) {
        bodyRegex.lastIndex = m.index + m[0].length;
        continue;
      }
      matches.push({ token: 'C', matchType: 'CONTEXT', index: startIdx });
      bodyRegex.lastIndex = m.index + m[0].length;
    }
  }

  matches.sort((a, b) => a.index - b.index);
  return matches;
};

/**
 * Edge Case Matcher for Go
 */
export const matchGo = (text, isSection) => {
  const matches = [];

  // Alias Golang is always supported case-insensitively
  const golangRegex = new RegExp(`${PREFIX_DELIM}(Golang)${SUFFIX_DELIM}`, 'gi');
  let gm;
  while ((gm = golangRegex.exec(text)) !== null) {
    matches.push({ token: gm[1], matchType: 'ALIAS', index: gm.index });
    golangRegex.lastIndex = gm.index + gm[0].length;
  }

  if (isSection) {
    // In skills section: strict case-sensitive 'Go'
    const goSecRegex = new RegExp(`${PREFIX_DELIM}(Go)${SUFFIX_DELIM}`, 'g');
    let sm;
    while ((sm = goSecRegex.exec(text)) !== null) {
      matches.push({ token: 'Go', matchType: 'EXACT', index: sm.index });
      goSecRegex.lastIndex = sm.index + sm[0].length;
    }
  } else {
    // In body text: strict case-sensitive 'Go' requiring adjacent context
    const goBodyRegex = new RegExp(
      `${PREFIX_DELIM}(Go)\\s+(?:language|programming|developer|runtime|routine|backend|code)${SUFFIX_DELIM}`,
      'g'
    );
    let bm;
    while ((bm = goBodyRegex.exec(text)) !== null) {
      matches.push({ token: 'Go', matchType: 'CONTEXT', index: bm.index });
      goBodyRegex.lastIndex = bm.index + bm[0].length;
    }
  }

  return matches;
};

/**
 * Edge Case Matcher for R
 */
export const matchR = (text, isSection) => {
  const matches = [];

  // Alias RStudio is always supported case-insensitively
  const rstudioRegex = new RegExp(`${PREFIX_DELIM}(RStudio)${SUFFIX_DELIM}`, 'gi');
  let rm;
  while ((rm = rstudioRegex.exec(text)) !== null) {
    matches.push({ token: rm[1], matchType: 'ALIAS', index: rm.index });
    rstudioRegex.lastIndex = rm.index + rm[0].length;
  }

  if (isSection) {
    // In skills section: strict case-sensitive 'R'
    const rSecRegex = new RegExp(`${PREFIX_DELIM}(R)${SUFFIX_DELIM}`, 'g');
    let sm;
    while ((sm = rSecRegex.exec(text)) !== null) {
      // Exclude R&D or middle initials
      const afterSlice = text.slice(sm.index, sm.index + 5);
      if (/^[\s,;:(/\[]?R&D/i.test(afterSlice)) {
        rSecRegex.lastIndex = sm.index + sm[0].length;
        continue;
      }
      matches.push({ token: 'R', matchType: 'EXACT', index: sm.index });
      rSecRegex.lastIndex = sm.index + sm[0].length;
    }
  } else {
    // In body text: strict case-sensitive 'R' with context
    const rBodyRegex = new RegExp(
      `${PREFIX_DELIM}(R)\\s+(?:language|programming|developer|package|script|analytics|statistical)${SUFFIX_DELIM}`,
      'g'
    );
    let bm;
    while ((bm = rBodyRegex.exec(text)) !== null) {
      matches.push({ token: 'R', matchType: 'CONTEXT', index: bm.index });
      rBodyRegex.lastIndex = bm.index + bm[0].length;
    }
  }

  return matches;
};

/**
 * Edge Case Matcher for .NET
 */
export const matchDotNet = (text) => {
  const matches = [];
  const regex = new RegExp(
    `${PREFIX_DELIM}(ASP\\.NET(?:\\s*Core)?|\\.(?:NET|Net)(?:\\s*Core)?)${SUFFIX_DELIM}`,
    'g'
  );
  let m;
  while ((m = regex.exec(text)) !== null) {
    matches.push({ token: m[1], matchType: m[1].toLowerCase() === '.net' ? 'EXACT' : 'ALIAS', index: m.index });
    regex.lastIndex = m.index + m[0].length;
  }
  return matches;
};

/**
 * Edge Case Matcher for SQL
 */
export const matchSql = (text) => {
  const matches = [];
  const regex = new RegExp(`${PREFIX_DELIM}(T-SQL|PL\\/SQL|SQL)${SUFFIX_DELIM}`, 'gi');
  let m;
  while ((m = regex.exec(text)) !== null) {
    const raw = m[1];
    matches.push({ token: raw, matchType: raw.toUpperCase() === 'SQL' ? 'EXACT' : 'ALIAS', index: m.index });
    regex.lastIndex = m.index + m[0].length;
  }
  return matches;
};

/**
 * Edge Case Matcher for REST APIs
 */
/**
 * Edge Case Matcher for REST APIs
 *
 * Implements case-insensitive matching for compound variants (RESTful, RESTful API,
 * RESTful APIs, REST APIs, REST API, restful, restful api, rest api), and strict
 * uppercase 'REST' in body text to prevent false positives from everyday English
 * words ('take a rest', 'rest of the day', 'restart', 'wrestle').
 */
export const matchRestApis = (text, isSection) => {
  const matches = [];

  // 1. Safe compound and derivative variants (case-insensitive)
  const compoundRegex = new RegExp(
    `${PREFIX_DELIM}(RESTful(?:\\s*APIs?)?|REST\\s+APIs?)${SUFFIX_DELIM}`,
    'gi'
  );

  // 2. Standalone REST (strictly uppercase in body text to avoid verb/noun 'rest'; case-insensitive in skills section)
  const standaloneRegex = isSection
    ? new RegExp(`${PREFIX_DELIM}(REST)${SUFFIX_DELIM}`, 'gi')
    : new RegExp(`${PREFIX_DELIM}(REST)${SUFFIX_DELIM}`, 'g');

  let m;
  while ((m = compoundRegex.exec(text)) !== null) {
    const raw = m[1];
    const isExact = raw.toUpperCase().replace(/\s+/g, ' ') === 'REST APIS';
    matches.push({
      token: raw,
      matchType: isExact ? 'EXACT' : 'ALIAS',
      index: m.index + m[0].indexOf(raw),
    });
    compoundRegex.lastIndex = m.index + m[0].length;
  }

  while ((m = standaloneRegex.exec(text)) !== null) {
    const raw = m[1];
    const startIdx = m.index + m[0].indexOf(raw);
    const isOverlapping = matches.some(
      (existing) => Math.abs(existing.index - startIdx) < Math.max(existing.token.length, raw.length)
    );
    if (!isOverlapping) {
      matches.push({
        token: raw,
        matchType: 'ALIAS',
        index: startIdx,
      });
    }
    standaloneRegex.lastIndex = m.index + m[0].length;
  }

  matches.sort((a, b) => a.index - b.index);
  return matches;
};

/**
 * Match a generic skill using canonical name and aliases
 *
 * NOTE: The generic matcher intentionally performs case-insensitive matching ('gi' flag)
 * for ordinary multi-character skills (e.g., Python, Docker, Kubernetes, React, JavaScript).
 * Specialized handlers remain strictly responsible for short tokens, punctuation-sensitive,
 * and contextual skills (C, Go, R, .NET, SQL, REST APIs) where case-insensitivity would
 * otherwise introduce widespread false positives.
 */
export const matchGenericSkill = (text, skillDef) => {
  const matches = [];
  const allVariants = [skillDef.name, ...skillDef.aliases].sort((a, b) => b.length - a.length);
  const patternStr = allVariants.map(escapeRegex).join('|');

  const regex = new RegExp(`${PREFIX_DELIM}(${patternStr})${SUFFIX_DELIM}`, 'gi');
  let m;
  while ((m = regex.exec(text)) !== null) {
    const raw = m[1];
    const isExact = raw.toLowerCase() === skillDef.name.toLowerCase();
    matches.push({
      token: raw,
      matchType: isExact ? 'EXACT' : 'ALIAS',
      index: m.index,
    });
    regex.lastIndex = m.index + m[0].length;
  }

  return matches;
};

/**
 * Calculate deterministic match score based on tier precedence:
 * - Canonical in dedicated Skills section -> 100.00
 * - Alias in dedicated Skills section -> 90.00
 * - Canonical or Alias in body with valid context -> 80.00
 * - Missing -> 0.00
 *
 * @param {string} matchType - 'EXACT' | 'ALIAS' | 'CONTEXT' | 'MISSING'
 * @param {boolean} isSection - true if detected in Skills section
 * @returns {number}
 */
export const computeDeterministicMatchScore = (matchType, isSection) => {
  if (matchType === 'MISSING') return 0.0;
  if (isSection) {
    return matchType === 'EXACT' ? 100.0 : 90.0;
  }
  return 80.0;
};

/**
 * Extract all recognized skills from document text (Resume or Job Description)
 *
 * @param {string} text
 * @param {object} [options={}]
 * @param {boolean} [options.isSkillsSectionOverride]
 * @param {string} [options.sectionType]
 * @returns {Array<object>} Deduplicated matched skills
 */
export const extractSkills = (text, options = {}) => {
  if (!text || typeof text !== 'string') return [];

  const sections = options.isSkillsSectionOverride !== undefined
    ? [{ type: options.isSkillsSectionOverride ? 'SKILLS_SECTION' : 'BODY', header: 'Override', content: text }]
    : splitIntoSections(text);

  if (sections.length === 0) {
    sections.push({ type: 'UNKNOWN', header: 'Default', content: text });
  }

  const detectedMap = new Map(); // Key: skill.name -> best match object

  for (const sec of sections) {
    const isSec = sec.type === 'SKILLS_SECTION' || isSkillsSection(sec.content, sec.type);

    for (const skillDef of SKILLS_TAXONOMY) {
      let rawMatches = [];

      switch (skillDef.name) {
        case 'C':
          rawMatches = matchC(sec.content, isSec);
          break;
        case 'Go':
          rawMatches = matchGo(sec.content, isSec);
          break;
        case 'R':
          rawMatches = matchR(sec.content, isSec);
          break;
        case '.NET':
          rawMatches = matchDotNet(sec.content);
          break;
        case 'SQL':
          rawMatches = matchSql(sec.content);
          break;
        case 'REST APIs':
          rawMatches = matchRestApis(sec.content, isSec);
          break;
        default:
          rawMatches = matchGenericSkill(sec.content, skillDef);
          break;
      }

      for (const m of rawMatches) {
        const score = computeDeterministicMatchScore(m.matchType, isSec);
        const confidence = isSec ? 1.0 : 0.8;

        const candidate = {
          skillName: skillDef.name,
          category: skillDef.category,
          matchedToken: m.token,
          matchType: m.matchType,
          similarityScore: score,
          confidence,
          isSkillsSection: isSec,
          sectionType: sec.type,
          evidence: `${sec.header}: ${m.token}`,
        };

        const existing = detectedMap.get(skillDef.name);
        if (!existing || candidate.similarityScore > existing.similarityScore) {
          detectedMap.set(skillDef.name, candidate);
        }
      }
    }
  }

  return Array.from(detectedMap.values());
};

/**
 * Extract and classify skills from job description text
 * Categorizes into REQUIRED, PREFERRED, and UNKNOWN with fallback.
 *
 * @param {string} text
 * @returns {object} { required: [], preferred: [], unknown: [], metadata: {} }
 */
export const extractFromJobDescription = (text) => {
  if (!text || typeof text !== 'string') {
    return { required: [], preferred: [], unknown: [], metadata: { totalRequired: 0, totalPreferred: 0, totalUnknown: 0 } };
  }

  const sections = splitIntoSections(text);
  const requiredMap = new Map();
  const preferredMap = new Map();
  const unknownMap = new Map();

  for (const sec of sections) {
    const skills = extractSkills(sec.content, {
      isSkillsSectionOverride: sec.type === 'SKILLS_SECTION',
      sectionType: sec.type,
    });

    for (const skill of skills) {
      if (sec.type === 'REQUIRED') {
        if (!requiredMap.has(skill.skillName)) requiredMap.set(skill.skillName, { ...skill, requirementType: 'REQUIRED' });
      } else if (sec.type === 'PREFERRED') {
        if (!preferredMap.has(skill.skillName) && !requiredMap.has(skill.skillName)) {
          preferredMap.set(skill.skillName, { ...skill, requirementType: 'PREFERRED' });
        }
      } else {
        if (!unknownMap.has(skill.skillName) && !requiredMap.has(skill.skillName) && !preferredMap.has(skill.skillName)) {
          unknownMap.set(skill.skillName, { ...skill, requirementType: 'UNKNOWN' });
        }
      }
    }
  }

  let required = Array.from(requiredMap.values());
  let preferred = Array.from(preferredMap.values());
  let unknown = Array.from(unknownMap.values());

  // Approved Fallback Policy:
  // If zero required and zero preferred detected, but unknown skills exist,
  // assign unknown skills to PREFERRED so they act as non-penalizing bonus qualifications.
  if (required.length === 0 && preferred.length === 0 && unknown.length > 0) {
    preferred = unknown.map((s) => ({ ...s, requirementType: 'PREFERRED' }));
    unknown = [];
  }

  return {
    required,
    preferred,
    unknown,
    metadata: {
      totalRequired: required.length,
      totalPreferred: preferred.length,
      totalUnknown: unknown.length,
      extractedAt: new Date().toISOString(),
    },
  };
};

/**
 * Deterministic Composite Scoring Formula
 *
 * S_req  = |M_req| / N_req (or 1.0 if N_req = 0 and N_pref > 0)
 * S_pref = |M_pref| / N_pref (or 1.0 if N_pref = 0 and N_req > 0)
 * S_conf = (1 / |M_all|) * sum(c_s)
 * Raw Score = (0.70 * S_req + 0.20 * S_pref + 0.10 * S_conf) * 100.0
 * Clamped to [0.00, 100.00], rounded to 2 decimal places.
 *
 * @param {object} params
 * @param {Array<string>} params.resumeSkillNames - Array of unique skill names in resume
 * @param {Array<object>} [params.resumeSkillsDetails=[]] - Resume skill objects with confidence
 * @param {Array<object>} params.requiredSkills - Job required skills
 * @param {Array<object>} [params.preferredSkills=[]] - Job preferred skills
 * @returns {object} { overallScore, skillScore, sReq, sPref, sConf, matchedRequired, matchedPreferred, missingRequired, missingPreferred }
 */
export const calculateMatchScore = ({
  resumeSkillNames = [],
  resumeSkillsDetails = [],
  requiredSkills = [],
  preferredSkills = [],
}) => {
  const resumeSet = new Set(resumeSkillNames.map((s) => s.toLowerCase()));
  const confidenceMap = new Map();
  for (const s of resumeSkillsDetails) {
    confidenceMap.set(s.skillName.toLowerCase(), s.confidence ?? 1.0);
  }

  const N_req = requiredSkills.length;
  const N_pref = preferredSkills.length;

  // Edge case: Empty job
  if (N_req === 0 && N_pref === 0) {
    return {
      overallScore: 0.0,
      skillScore: 0.0,
      sReq: 0.0,
      sPref: 0.0,
      sConf: 0.0,
      matchedRequired: [],
      matchedPreferred: [],
      missingRequired: [],
      missingPreferred: [],
    };
  }

  const matchedRequired = [];
  const missingRequired = [];
  for (const r of requiredSkills) {
    if (resumeSet.has(r.skillName.toLowerCase())) {
      matchedRequired.push(r);
    } else {
      missingRequired.push(r);
    }
  }

  const matchedPreferred = [];
  const missingPreferred = [];
  for (const p of preferredSkills) {
    if (resumeSet.has(p.skillName.toLowerCase())) {
      matchedPreferred.push(p);
    } else {
      missingPreferred.push(p);
    }
  }

  // S_req
  let sReq = 0.0;
  if (N_req > 0) {
    sReq = matchedRequired.length / N_req;
  } else if (N_pref > 0) {
    sReq = 1.0;
  }

  // S_pref
  let sPref = 0.0;
  if (N_pref > 0) {
    sPref = matchedPreferred.length / N_pref;
  } else if (N_req > 0) {
    sPref = 1.0;
  }

  // S_conf
  const allMatched = [...matchedRequired, ...matchedPreferred];
  let sConf = 0.0;
  if (allMatched.length > 0) {
    let confSum = 0.0;
    for (const m of allMatched) {
      confSum += confidenceMap.get(m.skillName.toLowerCase()) ?? 1.0;
    }
    sConf = confSum / allMatched.length;
  }

  // Raw score calculation
  const rawScore = (0.70 * sReq + 0.20 * sPref + 0.10 * sConf) * 100.0;
  const clampedScore = Math.min(100.0, Math.max(0.0, rawScore));
  const finalScore = Math.round(clampedScore * 100) / 100;

  return {
    overallScore: finalScore,
    skillScore: finalScore,
    sReq: Math.round(sReq * 1000) / 1000,
    sPref: Math.round(sPref * 1000) / 1000,
    sConf: Math.round(sConf * 1000) / 1000,
    matchedRequired,
    matchedPreferred,
    missingRequired,
    missingPreferred,
  };
};

export default {
  escapeRegex,
  classifyHeader,
  splitIntoSections,
  isSkillsSection,
  matchC,
  matchGo,
  matchR,
  matchDotNet,
  matchSql,
  matchRestApis,
  matchGenericSkill,
  computeDeterministicMatchScore,
  extractSkills,
  extractFromJobDescription,
  calculateMatchScore,
};
