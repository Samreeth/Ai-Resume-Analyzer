/**
 * Unit Test Suite for Phase 7 Stage 1:
 * Skill Extraction, Boundary-Safe Matcher, and Precedence Scoring
 */

import {
  extractSkills,
  extractFromJobDescription,
  calculateMatchScore,
  computeDeterministicMatchScore,
  matchC,
  matchGo,
  matchR,
  matchDotNet,
  matchSql,
  matchRestApis,
} from '../src/utils/skill.matcher.mjs';

export const runSkillTests = async () => {
  console.log('====================================================');
  console.log('Running Phase 7 Stage 1: Skill Matcher Unit Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const test = (name, fn) => {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  };

  // 1. C in Skills Section
  test('1. C in Skills Section: "Skills: C, C++, Java" matches both C and C++', () => {
    const skills = extractSkills('Skills: C, C++, Java', { isSkillsSectionOverride: true });
    const names = skills.map((s) => s.skillName);
    if (!names.includes('C')) throw new Error('Expected C to match in skills section');
    if (!names.includes('C++')) throw new Error('Expected C++ to match in skills section');
  });

  // 2. C in Body Context
  test('2. C in Body Context: "Proficient in C programming and compilers" matches C', () => {
    const skills = extractSkills('Proficient in C programming and compilers', { isSkillsSectionOverride: false });
    const names = skills.map((s) => s.skillName);
    if (!names.includes('C')) throw new Error('Expected C to match with programming context');
  });

  // 3. C Strict Case Sensitivity
  test('3. C Strict Case Sensitivity: "C programming" matches C, "c programming" does NOT', () => {
    const matchUpper = matchC('C programming', false);
    if (matchUpper.length === 0) throw new Error('Expected C programming to match');

    const matchLower = matchC('c programming', false);
    if (matchLower.length > 0) throw new Error('c programming must NOT match C');
  });

  // 4. C False Positive Rejection
  test('4. C False Positive Rejection: "Vitamin C", "Section C", "Grade C" do NOT match C', () => {
    const falsePositives = ['Takes Vitamin C daily', 'Refer to Section C of document', 'Received Grade C in math'];
    for (const text of falsePositives) {
      const skills = extractSkills(text, { isSkillsSectionOverride: false });
      if (skills.some((s) => s.skillName === 'C')) {
        throw new Error(`False positive detected for C in: "${text}"`);
      }
    }
  });

  // 5. Objective-C Boundary
  test('5. Objective-C Boundary: "Objective-C developer" does NOT match C', () => {
    const skillsSec = extractSkills('Skills: Objective-C, Swift', { isSkillsSectionOverride: true });
    if (skillsSec.some((s) => s.skillName === 'C')) {
      throw new Error('Objective-C in skills section falsely matched C');
    }
    const skillsBody = extractSkills('Experienced Objective-C developer for iOS', { isSkillsSectionOverride: false });
    if (skillsBody.some((s) => s.skillName === 'C')) {
      throw new Error('Objective-C in body text falsely matched C');
    }
  });

  // 6. C++ & C# Isolation
  test('6. C++ & C# Isolation: "C++ and C#" matches C++ and C# but never C', () => {
    const skills = extractSkills('Skills: C++ and C#', { isSkillsSectionOverride: true });
    const names = skills.map((s) => s.skillName);
    if (!names.includes('C++') || !names.includes('C#')) throw new Error('Expected C++ and C# to match');
    if (names.includes('C')) throw new Error('C++ and C# must not produce standalone C match');
  });

  // 7. Go in Skills Section
  test('7. Go in Skills Section: "Technical Skills: Python, R, SQL, Go" matches Go', () => {
    const skills = extractSkills('Technical Skills: Python, R, SQL, Go', { isSkillsSectionOverride: true });
    const names = skills.map((s) => s.skillName);
    if (!names.includes('Go')) throw new Error('Expected Go to match in skills section');
  });

  // 8. Go Strict Case Sensitivity
  test('8. Go Strict Case Sensitivity: "Go programming" matches Go, "go programming" does NOT', () => {
    const matchUpper = matchGo('Go programming', false);
    if (matchUpper.length === 0) throw new Error('Expected Go programming to match');

    const matchLower = matchGo('go programming', false);
    if (matchLower.length > 0) throw new Error('go programming must NOT match Go');
  });

  // 9. Go False Positive Rejection
  test('9. Go False Positive Rejection: "Let\'s go to the office." and "Go to market" do NOT match Go', () => {
    const falsePositives = ["Let's go to the office.", 'Go to market strategy for Q3.', 'Ongoing development work.'];
    for (const text of falsePositives) {
      const skills = extractSkills(text, { isSkillsSectionOverride: false });
      if (skills.some((s) => s.skillName === 'Go')) {
        throw new Error(`False positive detected for Go in: "${text}"`);
      }
    }
  });

  // 10. Go Contextual Match
  test('10. Go Contextual Match: "Developed backend in Golang" and "Go programming" match Go', () => {
    const s1 = extractSkills('Developed backend in Golang', { isSkillsSectionOverride: false });
    if (!s1.some((s) => s.skillName === 'Go')) throw new Error('Golang alias failed to match Go');

    const s2 = extractSkills('Expert in Go programming', { isSkillsSectionOverride: false });
    if (!s2.some((s) => s.skillName === 'Go')) throw new Error('Go programming failed to match Go');
  });

  // 11. R in Skills Section
  test('11. R in Skills Section: "Skills: Python, R, SQL" matches R', () => {
    const skills = extractSkills('Skills: Python, R, SQL', { isSkillsSectionOverride: true });
    const names = skills.map((s) => s.skillName);
    if (!names.includes('R')) throw new Error('Expected R to match in skills section');
  });

  // 12. R Strict Case Sensitivity
  test('12. R Strict Case Sensitivity: "R programming" matches R, "r programming" does NOT', () => {
    const matchUpper = matchR('R programming', false);
    if (matchUpper.length === 0) throw new Error('Expected R programming to match');

    const matchLower = matchR('r programming', false);
    if (matchLower.length > 0) throw new Error('r programming must NOT match R');
  });

  // 13. R False Positive Rejection
  test('13. R False Positive Rejection: "Worked in R&D" and "Samreeth R." do NOT match R', () => {
    const falsePositives = ['Worked in R&D department', 'Contacted Samreeth R. via email', 'Toys R Us store'];
    for (const text of falsePositives) {
      const skills = extractSkills(text, { isSkillsSectionOverride: false });
      if (skills.some((s) => s.skillName === 'R')) {
        throw new Error(`False positive detected for R in: "${text}"`);
      }
    }
  });

  // 14. R Contextual Match
  test('14. R Contextual Match: "Statistical analysis with R language" and "RStudio" match R', () => {
    const s1 = extractSkills('Statistical analysis with R language', { isSkillsSectionOverride: false });
    if (!s1.some((s) => s.skillName === 'R')) throw new Error('R language failed to match R');

    const s2 = extractSkills('Data modeling using RStudio', { isSkillsSectionOverride: false });
    if (!s2.some((s) => s.skillName === 'R')) throw new Error('RStudio alias failed to match R');
  });

  // 15. .NET Variants
  test('15. .NET Variants: ".NET", ".NET Core", "ASP.NET", "ASP.NET Core" match canonical .NET', () => {
    const variants = ['.NET', '.NET Core', 'ASP.NET', 'ASP.NET Core'];
    for (const v of variants) {
      const m = matchDotNet(v);
      if (m.length === 0) throw new Error(`Expected variant to match: ${v}`);
    }
  });

  // 16. .NET False Positive Rejection
  test('16. .NET False Positive Rejection: "internet", "network", ".com", ".net domain" do NOT match .NET', () => {
    const falsePositives = ['High speed internet access', 'Senior network administrator', 'Visit website at test.com', 'Registered a .net domain name'];
    for (const text of falsePositives) {
      const m = matchDotNet(text);
      if (m.length > 0) throw new Error(`False positive detected for .NET in: "${text}"`);
    }
  });

  // 17. SQL Variants
  test('17. SQL Variants: "SQL", "SQL queries", "T-SQL", "PL/SQL" match canonical SQL', () => {
    const variants = ['SQL', 'SQL queries', 'T-SQL', 'PL/SQL'];
    for (const v of variants) {
      const m = matchSql(v);
      if (m.length === 0) throw new Error(`Expected SQL variant to match: ${v}`);
    }
  });

  // 18. SQL False Positive Rejection
  test('18. SQL False Positive Rejection: "NoSQL" and "SQL-like" do NOT match SQL', () => {
    const falsePositives = ['NoSQL database architecture', 'nosql', 'SQL-like syntax for queries'];
    for (const text of falsePositives) {
      const m = matchSql(text);
      if (m.length > 0) throw new Error(`False positive detected for SQL in: "${text}"`);
    }
  });

  // 19. REST APIs Variants
  test('19. REST APIs Variants: "REST", "REST API", "REST APIs", "RESTful", "RESTful API" resolve to REST APIs', () => {
    const variants = ['REST', 'REST API', 'REST APIs', 'RESTful', 'RESTful API', 'RESTful APIs'];
    for (const v of variants) {
      const m = matchRestApis(v, true);
      if (m.length === 0) throw new Error(`Expected REST variant to match: ${v}`);
    }
  });

  // 20. REST APIs False Positive Rejection
  test('20. REST APIs False Positive Rejection: "restart", "wrestle", "take a rest" do NOT match REST APIs', () => {
    const falsePositives = ['Server restart required', 'Competitors wrestle for dominance', 'Please take a rest after work', 'For the rest of the year'];
    for (const text of falsePositives) {
      const m = matchRestApis(text, false);
      if (m.length > 0) throw new Error(`False positive detected for REST APIs in: "${text}"`);
    }
  });

  // 21. Node.js & JavaScript Aliases
  test('21. Node.js & JavaScript Aliases: "NodeJS" -> Node.js, "JS" -> JavaScript, "JSON" does NOT match', () => {
    const s1 = extractSkills('Skills: NodeJS, JS', { isSkillsSectionOverride: true });
    const names = s1.map((s) => s.skillName);
    if (!names.includes('Node.js')) throw new Error('NodeJS alias failed to match Node.js');
    if (!names.includes('JavaScript')) throw new Error('JS alias failed to match JavaScript');

    const s2 = extractSkills('Parsed JSON payloads', { isSkillsSectionOverride: false });
    if (s2.some((s) => s.skillName === 'JavaScript')) throw new Error('JSON falsely matched JavaScript');
  });

  // 22. Token Adjacency (C,C++)
  test('22. Token Adjacency: "C,C++" matches both C and C++ without token skip', () => {
    const skills = extractSkills('Skills: C,C++', { isSkillsSectionOverride: true });
    const names = skills.map((s) => s.skillName);
    if (!names.includes('C')) throw new Error('Expected C to match in "C,C++"');
    if (!names.includes('C++')) throw new Error('Expected C++ to match in "C,C++"');
  });

  // 23. Token Adjacency (Java,Python)
  test('23. Token Adjacency: "Java,Python" matches both Java and Python without token skip', () => {
    const skills = extractSkills('Skills: Java,Python', { isSkillsSectionOverride: true });
    const names = skills.map((s) => s.skillName);
    if (!names.includes('Java')) throw new Error('Expected Java to match in "Java,Python"');
    if (!names.includes('Python')) throw new Error('Expected Python to match in "Java,Python"');
  });

  // 24. Token Adjacency (Node.js,React)
  test('24. Token Adjacency: "Node.js,React" matches both Node.js and React without token skip', () => {
    const skills = extractSkills('Skills: Node.js,React', { isSkillsSectionOverride: true });
    const names = skills.map((s) => s.skillName);
    if (!names.includes('Node.js')) throw new Error('Expected Node.js to match in "Node.js,React"');
    if (!names.includes('React')) throw new Error('Expected React to match in "Node.js,React"');
  });

  // 25. Punctuation Delimiters (C++/CLI)
  test('25. Punctuation Delimiters: "C++/CLI" matches C++', () => {
    const skills = extractSkills('Skills: C++/CLI', { isSkillsSectionOverride: true });
    const names = skills.map((s) => s.skillName);
    if (!names.includes('C++')) throw new Error('Expected C++ to match in "C++/CLI"');
  });

  // 26. Match-Tier Precedence: Canonical in Skills Section (100.00)
  test('26. Match-Tier Precedence: Canonical match in Skills section yields 100.00', () => {
    const score = computeDeterministicMatchScore('EXACT', true);
    if (score !== 100.0) throw new Error(`Expected 100.00, got ${score}`);

    const extracted = extractSkills('Skills: PostgreSQL', { isSkillsSectionOverride: true });
    const pg = extracted.find((s) => s.skillName === 'PostgreSQL');
    if (!pg || pg.similarityScore !== 100.0) {
      throw new Error(`Expected similarityScore 100.00 for canonical in skills section, got ${pg?.similarityScore}`);
    }
  });

  // 27. Match-Tier Precedence: Alias in Skills Section (90.00)
  test('27. Match-Tier Precedence: Alias match in Skills section yields 90.00', () => {
    const score = computeDeterministicMatchScore('ALIAS', true);
    if (score !== 90.0) throw new Error(`Expected 90.00, got ${score}`);

    const extracted = extractSkills('Skills: Postgres', { isSkillsSectionOverride: true });
    const pg = extracted.find((s) => s.skillName === 'PostgreSQL');
    if (!pg || pg.similarityScore !== 90.0) {
      throw new Error(`Expected similarityScore 90.00 for alias in skills section, got ${pg?.similarityScore}`);
    }
  });

  // 28. Match-Tier Precedence: Canonical in Body (80.00)
  test('28. Match-Tier Precedence: Canonical match in Body text yields 80.00', () => {
    const score = computeDeterministicMatchScore('EXACT', false);
    if (score !== 80.0) throw new Error(`Expected 80.00, got ${score}`);

    const extracted = extractSkills('Experienced in PostgreSQL database optimization.', { isSkillsSectionOverride: false });
    const pg = extracted.find((s) => s.skillName === 'PostgreSQL');
    if (!pg || pg.similarityScore !== 80.0) {
      throw new Error(`Expected similarityScore 80.00 for canonical in body text, got ${pg?.similarityScore}`);
    }
  });

  // 29. Match-Tier Precedence: Alias in Body (80.00)
  test('29. Match-Tier Precedence: Alias match in Body text yields 80.00', () => {
    const score = computeDeterministicMatchScore('ALIAS', false);
    if (score !== 80.0) throw new Error(`Expected 80.00, got ${score}`);

    const extracted = extractSkills('Developed queries with Postgres databases.', { isSkillsSectionOverride: false });
    const pg = extracted.find((s) => s.skillName === 'PostgreSQL');
    if (!pg || pg.similarityScore !== 80.0) {
      throw new Error(`Expected similarityScore 80.00 for alias in body text, got ${pg?.similarityScore}`);
    }
  });

  // 30. Match-Tier Precedence: Missing (0.00)
  test('30. Match-Tier Precedence: Missing skill yields 0.00 and status MISSING', () => {
    const score = computeDeterministicMatchScore('MISSING', false);
    if (score !== 0.0) throw new Error(`Expected 0.00, got ${score}`);
  });

  // 31. Section Classifier & Fallback Policy
  test('31. Section Classifier & Fallback: Categorizes REQUIRED/PREFERRED/UNKNOWN and fallback maps UNKNOWN -> PREFERRED', () => {
    const jdText = `
About Acme Corp
We build cloud solutions using AWS and Docker.

Requirements:
- Strong experience with Python
- Relational database skills in PostgreSQL

Nice to Have:
- Knowledge of Redis
- Experience with Kubernetes
`;

    const parsed = extractFromJobDescription(jdText);
    const reqNames = parsed.required.map((s) => s.skillName);
    const prefNames = parsed.preferred.map((s) => s.skillName);
    const unkNames = parsed.unknown.map((s) => s.skillName);

    if (!reqNames.includes('Python') || !reqNames.includes('PostgreSQL')) {
      throw new Error('Requirements section failed to categorize Python and PostgreSQL');
    }
    if (!prefNames.includes('Redis') || !prefNames.includes('Kubernetes')) {
      throw new Error('Preferred section failed to categorize Redis and Kubernetes');
    }
    if (!unkNames.includes('AWS') || !unkNames.includes('Docker')) {
      throw new Error('Preamble section failed to categorize AWS and Docker as UNKNOWN');
    }

    // Test Fallback when 0 required and 0 preferred
    const unformattedJd = 'We are seeking a developer with skills in Python, Docker, and Redis.';
    const fallbackParsed = extractFromJobDescription(unformattedJd);
    if (fallbackParsed.required.length !== 0) {
      throw new Error('Fallback should leave required as empty');
    }
    if (fallbackParsed.preferred.length !== 3) {
      throw new Error(`Fallback should map unknown skills to preferred, got ${fallbackParsed.preferred.length}`);
    }
    if (fallbackParsed.unknown.length !== 0) {
      throw new Error('Fallback should leave unknown as empty');
    }

    // Scoring test with fallback
    const scoreResult = calculateMatchScore({
      resumeSkillNames: ['Python', 'PostgreSQL'],
      requiredSkills: parsed.required,
      preferredSkills: parsed.preferred,
    });
    // Candidate has 2/2 required (1.0), 0/2 preferred (0.0), confidence 1.0
    // Score = (0.70 * 1.0 + 0.20 * 0.0 + 0.10 * 1.0) * 100.0 = 80.00
    if (scoreResult.overallScore !== 80.0) {
      throw new Error(`Expected overallScore 80.00, got ${scoreResult.overallScore}`);
    }
  });

  // 32. REST APIs Case Behavior
  test('32. REST APIs Case Behavior: Matches REST, REST API, REST APIs, RESTful, RESTful API, RESTful APIs, lowercase "restful", and "restful api"', () => {
    const variants = [
      'REST',
      'REST API',
      'REST APIs',
      'RESTful',
      'RESTful API',
      'RESTful APIs',
      'restful',
      'restful api',
      'restful apis',
    ];
    for (const v of variants) {
      const inBody = matchRestApis(`Built microservices using ${v} endpoints`, false);
      if (inBody.length === 0) throw new Error(`Expected variant to match in body text: "${v}"`);
      const extracted = extractSkills(`Built microservices using ${v} endpoints`, { isSkillsSectionOverride: false });
      if (!extracted.some((s) => s.skillName === 'REST APIs')) {
        throw new Error(`extractSkills failed to detect REST APIs for variant: "${v}"`);
      }
    }
  });

  // 33. REST False Positives
  test('33. REST False Positives: Rejects "restart", "wrestle", "take a rest", and "rest of the year"', () => {
    const falsePositives = [
      'Need to restart the background services',
      'Engineers wrestle with complex distributed systems',
      'Please take a rest after the sprint',
      'Focusing on stability for the rest of the year',
    ];
    for (const text of falsePositives) {
      const inBody = matchRestApis(text, false);
      if (inBody.length > 0) throw new Error(`False positive match in matchRestApis for: "${text}"`);
      const extracted = extractSkills(text, { isSkillsSectionOverride: false });
      if (extracted.some((s) => s.skillName === 'REST APIs')) {
        throw new Error(`False positive REST APIs detected in extractSkills for: "${text}"`);
      }
    }
  });

  // 34. ANSI C & Embedded C in Skills Section
  test('34. ANSI C & Embedded C in Skills Section: Resolves as ALIAS with score 90.00', () => {
    // Skills: C -> EXACT -> 100.00
    const secC = extractSkills('Skills: C', { isSkillsSectionOverride: true });
    const cExact = secC.find((s) => s.skillName === 'C');
    if (!cExact || cExact.matchType !== 'EXACT' || cExact.similarityScore !== 100.0) {
      throw new Error(`Expected Skills: C to be EXACT with score 100.00, got ${cExact?.similarityScore}`);
    }

    // Skills: ANSI C -> ALIAS -> 90.00
    const secAnsi = extractSkills('Skills: ANSI C', { isSkillsSectionOverride: true });
    const ansiAlias = secAnsi.find((s) => s.skillName === 'C');
    if (!ansiAlias || ansiAlias.matchType !== 'ALIAS' || ansiAlias.similarityScore !== 90.0) {
      throw new Error(`Expected Skills: ANSI C to be ALIAS with score 90.00, got ${ansiAlias?.similarityScore} (${ansiAlias?.matchType})`);
    }

    // Skills: Embedded C -> ALIAS -> 90.00
    const secEmbedded = extractSkills('Skills: Embedded C', { isSkillsSectionOverride: true });
    const embeddedAlias = secEmbedded.find((s) => s.skillName === 'C');
    if (!embeddedAlias || embeddedAlias.matchType !== 'ALIAS' || embeddedAlias.similarityScore !== 90.0) {
      throw new Error(`Expected Skills: Embedded C to be ALIAS with score 90.00, got ${embeddedAlias?.similarityScore} (${embeddedAlias?.matchType})`);
    }
  });

  // 35. ANSI C & Embedded C in Body Text
  test('35. ANSI C & Embedded C in Body Text: Resolves as ALIAS/contextual with score 80.00 without false collisions', () => {
    // body: ANSI C programming -> 80.00
    const bAnsi = extractSkills('Over 5 years of ANSI C programming experience.', { isSkillsSectionOverride: false });
    const cAnsi = bAnsi.find((s) => s.skillName === 'C');
    if (!cAnsi || cAnsi.similarityScore !== 80.0) {
      throw new Error(`Expected body ANSI C to have score 80.00, got ${cAnsi?.similarityScore}`);
    }

    // body: Embedded C development -> 80.00
    const bEmbedded = extractSkills('Specialized in Embedded C development for microcontrollers.', { isSkillsSectionOverride: false });
    const cEmbedded = bEmbedded.find((s) => s.skillName === 'C');
    if (!cEmbedded || cEmbedded.similarityScore !== 80.0) {
      throw new Error(`Expected body Embedded C to have score 80.00, got ${cEmbedded?.similarityScore}`);
    }

    // Isolation checks
    const bObjC = extractSkills('Senior Objective-C developer for macOS/iOS.', { isSkillsSectionOverride: false });
    if (bObjC.some((s) => s.skillName === 'C')) throw new Error('Objective-C falsely matched C');

    const bCpp = extractSkills('High performance C++ game engine development.', { isSkillsSectionOverride: false });
    if (bCpp.some((s) => s.skillName === 'C')) throw new Error('C++ falsely matched C');

    const bCSharp = extractSkills('Enterprise backend development in C# and .NET.', { isSkillsSectionOverride: false });
    if (bCSharp.some((s) => s.skillName === 'C')) throw new Error('C# falsely matched C');
  });

  // 36. Skills Section vs Narrative Adversarial
  test('36. Skills Section vs Narrative Adversarial: Ordinary narrative and project/experience lists retain body score 80.00', () => {
    // Adversarial Case 1: Ordinary narrative containing comma-separated words
    const narrativeText = `
Managed, coached, and guided a team of 5 engineers using Docker and Kubernetes daily.
Delivered quarterly milestones on schedule.
`;
    const sNarrative = extractSkills(narrativeText);
    for (const s of sNarrative) {
      if (s.similarityScore > 80.0) {
        throw new Error(`Ordinary narrative skill "${s.skillName}" falsely upgraded to score ${s.similarityScore}`);
      }
    }

    // Adversarial Case 2: Project descriptions containing technology lists
    const projectText = `
Project Alpha: Developed microservices using Node.js, React, and MongoDB.
Handled high throughput streaming data.
`;
    const sProject = extractSkills(projectText);
    for (const s of sProject) {
      if (s.similarityScore > 80.0) {
        throw new Error(`Project description skill "${s.skillName}" falsely upgraded to score ${s.similarityScore}`);
      }
    }

    // Adversarial Case 3: Experience descriptions containing lists
    const experienceText = `
Experience:
Senior Software Engineer
Led backend development using Java, PostgreSQL, and Redis.
`;
    const sExperience = extractSkills(experienceText);
    for (const s of sExperience) {
      if (s.similarityScore > 80.0) {
        throw new Error(`Experience description skill "${s.skillName}" falsely upgraded to score ${s.similarityScore}`);
      }
    }
  });

  // 37. Recognized Skills Sections
  test('37. Recognized Skills Sections: "Skills:", "Technical Skills:", "Tech Stack:" produce 100.00 canonical and 90.00 alias scores', () => {
    // 1. "Skills:" section
    const t1 = `
Skills:
- Python
- Postgres
`;
    const s1 = extractSkills(t1);
    const py1 = s1.find((s) => s.skillName === 'Python');
    const pg1 = s1.find((s) => s.skillName === 'PostgreSQL');
    if (!py1 || py1.similarityScore !== 100.0) throw new Error(`Expected Python 100.00 in Skills section, got ${py1?.similarityScore}`);
    if (!pg1 || pg1.similarityScore !== 90.0) throw new Error(`Expected Postgres 90.00 (alias) in Skills section, got ${pg1?.similarityScore}`);

    // 2. "Technical Skills:" section
    const t2 = `
Technical Skills:
- TypeScript
- Docker
`;
    const s2 = extractSkills(t2);
    const ts2 = s2.find((s) => s.skillName === 'TypeScript');
    const doc2 = s2.find((s) => s.skillName === 'Docker');
    if (!ts2 || ts2.similarityScore !== 100.0) throw new Error(`Expected TypeScript 100.00 in Technical Skills section, got ${ts2?.similarityScore}`);
    if (!doc2 || doc2.similarityScore !== 100.0) throw new Error(`Expected Docker 100.00 in Technical Skills section, got ${doc2?.similarityScore}`);

    // 3. "Tech Stack:" section
    const t3 = `
Tech Stack:
Go, Redis, Kubernetes
`;
    const s3 = extractSkills(t3);
    const go3 = s3.find((s) => s.skillName === 'Go');
    const red3 = s3.find((s) => s.skillName === 'Redis');
    if (!go3 || go3.similarityScore !== 100.0) throw new Error(`Expected Go 100.00 in Tech Stack section, got ${go3?.similarityScore}`);
    if (!red3 || red3.similarityScore !== 100.0) throw new Error(`Expected Redis 100.00 in Tech Stack section, got ${red3?.similarityScore}`);
  });

  console.log('\n====================================================');
  console.log(`Phase 7 Stage 1 Skill Matcher Suite: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
    throw new Error(`Stage 1 Skill Matcher Suite Failed with ${failed} failure(s)`);
  }
};

runSkillTests().catch((err) => {
  console.error('Unhandled Stage 1 test failure:', err);
  process.exit(1);
});
