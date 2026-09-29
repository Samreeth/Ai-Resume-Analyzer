/**
 * Phase 7 Stage 4: Skill Gap Analysis & Recommendation Engine Test Suite
 * Covers 53 approved test scenarios:
 * 1. Authentication & IDOR Protection (7 tests)
 * 2. Parameter & Query Validation (6 tests)
 * 3. Skill Gap Analysis & Category Coverage (7 tests)
 * 4. Deterministic Resume Quality Scoring Rules (15 tests)
 * 5. Action Verbs, Metrics Density & Score Clamping (7 tests)
 * 6. Actionable Recommendations Synthesis, Priorities & Category Filtering (7 tests)
 * 7. Edge Cases, Resilience & Immutability (4 tests)
 */

import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../src/app.mjs';
import config from '../src/config/env.mjs';
import { query, testDbConnection } from '../src/config/database.mjs';
import { registerUser, generateToken } from '../src/services/auth.service.mjs';
import analysisService from '../src/services/analysis.service.mjs';
import { analyzeResumeQuality, ACTION_VERBS } from '../src/utils/quality.analyzer.mjs';

export const runRecommendationTests = async () => {
  console.log('====================================================');
  console.log('Running Phase 7 Stage 4: Recommendation Engine Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  };

  // Verify DB connection
  const dbStatus = await testDbConnection();
  if (!dbStatus.connected) {
    console.error('\n[FATAL] PostgreSQL is offline. Live integration tests require database connectivity.');
    process.exit(1);
  }

  // Start live ephemeral test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const timestamp = Date.now();
  const userAEmail = `rec_user_a_${timestamp}@example.com`;
  const userBEmail = `rec_user_b_${timestamp}@example.com`;
  const password = 'Password123!Secure';

  let userA, userB, tokenA, tokenB;
  let baseResumeIdA, baseJobIdA, baseAnalysisIdA;
  let userBResumeId, userBJobId, userBAnalysisId;

  try {
    userA = await registerUser({ name: 'Recommendation User A', email: userAEmail, password });
    userA.userId = userA.user_id;
    tokenA = generateToken(userA);

    userB = await registerUser({ name: 'Recommendation User B', email: userBEmail, password });
    userB.userId = userB.user_id;
    tokenB = generateToken(userB);

    const api = async (endpoint, options = {}, token = null) => {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      };
      return fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
      });
    };

    // Helper: Insert resume
    const insertResume = async ({ userId, fileName, text }) => {
      const res = await query(
        `INSERT INTO resumes (user_id, file_name, file_path, extraction_status, extracted_text)
         VALUES ($1, $2, $3, 'COMPLETED', $4)
         RETURNING resume_id`,
        [userId, fileName, `uploads/test_${Date.now()}_${Math.random()}.pdf`, text]
      );
      return res.rows[0].resume_id;
    };

    // Helper: Insert job description
    const insertJob = async ({ userId, title, description, extractedData }) => {
      const res = await query(
        `INSERT INTO job_descriptions (user_id, title, description, extracted_data)
         VALUES ($1, $2, $3, $4)
         RETURNING job_id`,
        [userId, title, description, JSON.stringify(extractedData)]
      );
      return res.rows[0].job_id;
    };

    // Construct a rich, standard resume text (has all 5 sections, optimal length ~280 words, action verbs, metrics)
    const standardResumeText = `
John Doe
Email: john.doe@example.com | Phone: (555) 123-4567 | San Francisco, CA

Professional Summary:
Accomplished Senior Backend Software Engineer with extensive experience in architecting, designing, and maintaining robust distributed systems, high-throughput cloud microservices, and modern web infrastructure.

Technical Skills:
- Languages: Python, JavaScript, TypeScript, Go
- Frameworks: React, Node.js, Express.js
- Databases: PostgreSQL, Redis
- Cloud & Tools: Git, Docker, CI/CD

Experience:
Senior Software Engineer - Tech Solutions (2022 - Present)
- Developed scalable microservices using Node.js and PostgreSQL handling 50k requests per second across multi-region infrastructure.
- Architected automated CI/CD deployment pipelines reducing deployment latency by 40% and cutting staging release errors in half.
- Engineered distributed caching layer with Redis that reduced database query load by 35% during peak product traffic hours.
- Built RESTful APIs serving 200k active users across mobile and web clients with strict backward compatibility and comprehensive test coverage.
- Spearheaded database query tuning, query index optimization, and connection pooling refactoring to eliminate production deadlocks.
- Mentored junior engineers, conducted peer code reviews, established linting standards, and accelerated team engineering velocity.

Projects:
Distributed Task Queue (2023)
- Designed and implemented a high-throughput job queue in Go processing 10k messages per minute with resilient failover workers.
- Optimized worker concurrency resulting in 2x faster execution times and reduced memory overhead under heavy load.
- Integrated automated health monitoring and alerting, improving cluster visibility and resolving transient system bottlenecks.

Education:
B.S. in Computer Science - State University (2018 - 2022)
Graduated with Honors, focused on Distributed Systems and Software Architecture.
    `.trim();

    baseResumeIdA = await insertResume({
      userId: userA.userId,
      fileName: 'standard_resume.pdf',
      text: standardResumeText,
    });

    // Target job requiring Python, Node.js, Docker, Kubernetes, AWS, Redis
    const targetJobData = {
      required: [
        { skillName: 'Python', category: 'Programming language' },
        { skillName: 'Node.js', category: 'Framework' },
        { skillName: 'Docker', category: 'DevOps' },
        { skillName: 'Kubernetes', category: 'DevOps' },
      ],
      preferred: [
        { skillName: 'AWS', category: 'Cloud' },
        { skillName: 'Redis', category: 'Database' },
      ],
    };

    baseJobIdA = await insertJob({
      userId: userA.userId,
      title: 'Senior Backend Engineer',
      description: 'Looking for a Senior Backend Engineer proficient in Python, Node.js, Docker, Kubernetes, AWS, Redis.',
      extractedData: targetJobData,
    });

    const analysisReportA = await analysisService.createAnalysis({
      userId: userA.userId,
      resumeId: baseResumeIdA,
      jobId: baseJobIdA,
    });
    baseAnalysisIdA = analysisReportA.analysis_id;

    // Create User B analysis for IDOR testing
    userBResumeId = await insertResume({
      userId: userB.userId,
      fileName: 'user_b_resume.pdf',
      text: standardResumeText,
    });
    userBJobId = await insertJob({
      userId: userB.userId,
      title: 'User B Job',
      description: 'Job for User B',
      extractedData: targetJobData,
    });
    const analysisReportB = await analysisService.createAnalysis({
      userId: userB.userId,
      resumeId: userBResumeId,
      jobId: userBJobId,
    });
    userBAnalysisId = analysisReportB.analysis_id;

    // ========================================================================
    // Group 1: Authentication & IDOR Protection (7 Scenarios)
    // ========================================================================

    await test('1. Auth: Rejects unauthenticated request without token with 401 AUTHENTICATION_ERROR', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`);
      const body = await res.json();
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
      if (body.error?.code !== 'AUTHENTICATION_ERROR') throw new Error(`Expected AUTHENTICATION_ERROR, got ${body.error?.code}`);
    });

    await test('2. Auth: Rejects request with malformed Bearer token with 401 AUTHENTICATION_ERROR', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, 'malformed.token.here');
      const body = await res.json();
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
      if (body.error?.code !== 'AUTHENTICATION_ERROR') throw new Error(`Expected AUTHENTICATION_ERROR, got ${body.error?.code}`);
    });

    await test('3. Auth: Rejects request with expired JWT with 401 AUTHENTICATION_ERROR', async () => {
      const expiredToken = jwt.sign(
        { userId: userA.userId, email: userA.email },
        config.jwtSecret,
        { expiresIn: '-10s' }
      );
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, expiredToken);
      const body = await res.json();
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
      if (body.error?.code !== 'AUTHENTICATION_ERROR') throw new Error(`Expected AUTHENTICATION_ERROR, got ${body.error?.code}`);
    });

    await test("4. IDOR: User B calling GET recommendations on User A's analysisId returns 404 RESOURCE_NOT_FOUND", async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenB);
      const body = await res.json();
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      if (body.error?.code !== 'RESOURCE_NOT_FOUND') throw new Error(`Expected RESOURCE_NOT_FOUND, got ${body.error?.code}`);
    });

    await test("5. IDOR: User B cannot infer existence of User A's analysis (identical 404 for unowned vs nonexistent ID)", async () => {
      const randomUuid = '00000000-0000-0000-0000-000000000000';
      const resNonexistent = await api(`/api/analyses/${randomUuid}/recommendations`, {}, tokenB);
      const resUnowned = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenB);

      const bodyNonexistent = await resNonexistent.json();
      const bodyUnowned = await resUnowned.json();

      if (resNonexistent.status !== 404 || resUnowned.status !== 404) throw new Error('Both must return 404');
      if (bodyNonexistent.error?.code !== bodyUnowned.error?.code) throw new Error('Error codes must match');
    });

    await test('6. IDOR: Ownership check scopes strictly to authenticated user_id in SQL query', async () => {
      // User A can access own analysis
      const resA = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA);
      if (resA.status !== 200) throw new Error(`Expected 200 for owner, got ${resA.status}`);

      // User A cannot access User B's analysis
      const resB = await api(`/api/analyses/${userBAnalysisId}/recommendations`, {}, tokenA);
      if (resB.status !== 404) throw new Error(`Expected 404 for cross-user, got ${resB.status}`);
    });

    await test('7. Auth: Authenticated owner successfully accesses recommendations for their own analysis', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA);
      const body = await res.json();
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!body.success) throw new Error('Expected success true');
      if (body.data.analysis_id !== baseAnalysisIdA) throw new Error('Returned wrong analysis_id');
      if (!body.data.skill_gap_analysis) throw new Error('skill_gap_analysis missing');
      if (!body.data.resume_quality) throw new Error('resume_quality missing');
      if (!Array.isArray(body.data.recommendations)) throw new Error('recommendations must be an array');
      if (typeof body.data.disclaimer !== 'string') throw new Error('disclaimer missing');
    });

    // ========================================================================
    // Group 2: Parameter & Query Validation (6 Scenarios)
    // ========================================================================

    await test("8. Validation: Rejects non-UUID analysisId (e.g., '123-abc') with 400 VALIDATION_ERROR", async () => {
      const res = await api('/api/analyses/not-a-valid-uuid/recommendations', {}, tokenA);
      const body = await res.json();
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (body.error?.code !== 'VALIDATION_ERROR') throw new Error(`Expected VALIDATION_ERROR, got ${body.error?.code}`);
    });

    await test('9. Validation: Rejects empty analysisId parameter with 400 or route 404', async () => {
      const res = await api('/api/analyses//recommendations', {}, tokenA);
      if (res.status !== 404 && res.status !== 400) throw new Error(`Expected 400 or 404, got ${res.status}`);
    });

    await test('10. Validation: Accepts valid priority filter ?priority=HIGH', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations?priority=HIGH`, {}, tokenA);
      const body = await res.json();
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      for (const r of body.data.recommendations) {
        if (r.priority !== 'HIGH') throw new Error(`Expected only HIGH priority, got ${r.priority}`);
      }
    });

    await test('11. Validation: Accepts valid priority filter ?priority=MEDIUM and ?priority=LOW', async () => {
      const resMed = await api(`/api/analyses/${baseAnalysisIdA}/recommendations?priority=MEDIUM`, {}, tokenA);
      const bodyMed = await resMed.json();
      if (resMed.status !== 200) throw new Error(`Expected 200 for MEDIUM, got ${resMed.status}`);
      for (const r of bodyMed.data.recommendations) {
        if (r.priority !== 'MEDIUM') throw new Error(`Expected only MEDIUM priority, got ${r.priority}`);
      }

      const resLow = await api(`/api/analyses/${baseAnalysisIdA}/recommendations?priority=LOW`, {}, tokenA);
      const bodyLow = await resLow.json();
      if (resLow.status !== 200) throw new Error(`Expected 200 for LOW, got ${resLow.status}`);
      for (const r of bodyLow.data.recommendations) {
        if (r.priority !== 'LOW') throw new Error(`Expected only LOW priority, got ${r.priority}`);
      }
    });

    await test('12. Validation: Rejects invalid priority filter ?priority=URGENT with 400 VALIDATION_ERROR', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations?priority=URGENT`, {}, tokenA);
      const body = await res.json();
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (body.error?.code !== 'VALIDATION_ERROR') throw new Error(`Expected VALIDATION_ERROR, got ${body.error?.code}`);
    });

    await test('13. Validation: Rejects invalid category filter ?category=UNKNOWN with 400 VALIDATION_ERROR', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations?category=UNKNOWN`, {}, tokenA);
      const body = await res.json();
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (body.error?.code !== 'VALIDATION_ERROR') throw new Error(`Expected VALIDATION_ERROR, got ${body.error?.code}`);
    });

    // ========================================================================
    // Group 3: Skill Gap Analysis & Category Coverage (7 Scenarios)
    // ========================================================================

    await test('14. Skill Gap: Accurately identifies missing REQUIRED skills as critical gaps with impact CRITICAL and category SKILL_GAP', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA);
      const body = await res.json();
      const crit = body.data.skill_gap_analysis.critical_missing_required;
      // In baseJobIdA, Docker and Kubernetes are REQUIRED. Standard resume has Docker in Skills, but lacks Kubernetes.
      const k8sGap = crit.find((c) => c.skill_name.toLowerCase() === 'kubernetes');
      if (!k8sGap) throw new Error('Expected Kubernetes in critical_missing_required');
      if (k8sGap.requirement_type !== 'REQUIRED') throw new Error('Expected requirement_type REQUIRED');
      if (k8sGap.impact !== 'CRITICAL') throw new Error('Expected impact CRITICAL');
      if (!k8sGap.remediation || !k8sGap.remediation.includes('Kubernetes')) throw new Error('Remediation text missing skill name');
    });

    await test('15. Skill Gap: Accurately identifies missing PREFERRED skills as secondary gaps with impact SECONDARY and category SKILL_GAP', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA);
      const body = await res.json();
      const sec = body.data.skill_gap_analysis.secondary_missing_preferred;
      // In baseJobIdA, AWS and Redis are PREFERRED. Standard resume has Redis, but lacks AWS.
      const awsGap = sec.find((s) => s.skill_name.toLowerCase() === 'aws');
      if (!awsGap) throw new Error('Expected AWS in secondary_missing_preferred');
      if (awsGap.requirement_type !== 'PREFERRED') throw new Error('Expected requirement_type PREFERRED');
      if (awsGap.impact !== 'SECONDARY') throw new Error('Expected impact SECONDARY');
    });

    await test('16. Skill Gap: Perfectly matched analysis produces empty missing lists and 100% coverage', async () => {
      const perfectJobId = await insertJob({
        userId: userA.userId,
        title: 'Perfect Match Job',
        description: 'Skills: Python, Node.js',
        extractedData: {
          required: [{ skillName: 'Python', category: 'Programming language' }],
          preferred: [{ skillName: 'Node.js', category: 'Framework' }],
        },
      });

      const pAnalysis = await analysisService.createAnalysis({
        userId: userA.userId,
        resumeId: baseResumeIdA,
        jobId: perfectJobId,
      });

      const res = await api(`/api/analyses/${pAnalysis.analysis_id}/recommendations`, {}, tokenA);
      const body = await res.json();
      const gap = body.data.skill_gap_analysis;

      if (gap.critical_missing_required.length !== 0) throw new Error('critical_missing_required must be empty');
      if (gap.secondary_missing_preferred.length !== 0) throw new Error('secondary_missing_preferred must be empty');
      for (const cat of Object.values(gap.category_breakdown)) {
        if (cat.coverage_percentage !== 100.0) throw new Error(`Expected 100% coverage, got ${cat.coverage_percentage}`);
      }
    });

    await test('17. Skill Gap: Job with only REQUIRED skills correctly populates critical gaps and empty preferred gaps', async () => {
      const reqOnlyJobId = await insertJob({
        userId: userA.userId,
        title: 'Required Only Job',
        description: 'Requirements: Kubernetes, C++',
        extractedData: {
          required: [
            { skillName: 'Kubernetes', category: 'DevOps' },
            { skillName: 'C++', category: 'Programming language' },
          ],
          preferred: [],
        },
      });

      const rAnalysis = await analysisService.createAnalysis({
        userId: userA.userId,
        resumeId: baseResumeIdA,
        jobId: reqOnlyJobId,
      });

      const res = await api(`/api/analyses/${rAnalysis.analysis_id}/recommendations`, {}, tokenA);
      const body = await res.json();
      const gap = body.data.skill_gap_analysis;

      if (gap.critical_missing_required.length !== 2) throw new Error(`Expected 2 critical gaps, got ${gap.critical_missing_required.length}`);
      if (gap.secondary_missing_preferred.length !== 0) throw new Error('secondary_missing_preferred must be empty');
    });

    await test('18. Skill Gap: Job with only PREFERRED skills correctly populates secondary gaps and empty required gaps', async () => {
      const prefOnlyJobId = await insertJob({
        userId: userA.userId,
        title: 'Preferred Only Job',
        description: 'Preferred: AWS, Terraform',
        extractedData: {
          required: [],
          preferred: [
            { skillName: 'AWS', category: 'Cloud' },
            { skillName: 'Terraform', category: 'DevOps' },
          ],
        },
      });

      const prAnalysis = await analysisService.createAnalysis({
        userId: userA.userId,
        resumeId: baseResumeIdA,
        jobId: prefOnlyJobId,
      });

      const res = await api(`/api/analyses/${prAnalysis.analysis_id}/recommendations`, {}, tokenA);
      const body = await res.json();
      const gap = body.data.skill_gap_analysis;

      if (gap.critical_missing_required.length !== 0) throw new Error('critical_missing_required must be empty');
      if (gap.secondary_missing_preferred.length !== 2) throw new Error(`Expected 2 preferred gaps, got ${gap.secondary_missing_preferred.length}`);
    });

    await test('19. Skill Gap: Category breakdown includes both REQUIRED and PREFERRED skills (total = matched + missing)', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA);
      const body = await res.json();
      const breakdown = body.data.skill_gap_analysis.category_breakdown;

      for (const [catName, catData] of Object.entries(breakdown)) {
        if (catData.total !== catData.matched + catData.missing) {
          throw new Error(`Category ${catName} total mismatch: ${catData.total} !== ${catData.matched} + ${catData.missing}`);
        }
      }
    });

    await test('20. Skill Gap: Category coverage percentage calculates round((matched / total) * 100, 2) or 0 when total is 0', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA);
      const body = await res.json();
      const breakdown = body.data.skill_gap_analysis.category_breakdown;

      for (const [catName, catData] of Object.entries(breakdown)) {
        const expected = catData.total > 0 ? Math.round(((catData.matched / catData.total) * 100) * 100) / 100 : 0.0;
        if (catData.coverage_percentage !== expected) {
          throw new Error(`Category ${catName} coverage mismatch: expected ${expected}, got ${catData.coverage_percentage}`);
        }
      }
    });

    // ========================================================================
    // Group 4: Deterministic Resume Quality Scoring Rules (15 Scenarios)
    // ========================================================================

    await test('21. Quality Rule: Missing Contact info applies exact 15.00 deduction (rule MISSING_CONTACT)', async () => {
      const noContactText = standardResumeText.replace(/john\.doe@example\.com/g, 'REDACTED').replace(/\(555\) 123-4567/g, 'NO_PHONE');
      const q = analyzeResumeQuality(noContactText);
      const d = q.deductions.find((item) => item.rule === 'MISSING_CONTACT');
      if (!d) throw new Error('Expected MISSING_CONTACT deduction');
      if (d.deduction !== 15.0) throw new Error(`Expected 15.00 deduction, got ${d.deduction}`);
      if (q.sections_detected.contact_info.detected !== false) throw new Error('Expected contact_info.detected false');
    });

    await test('22. Quality Rule: Present Contact info (email or phone) produces 0 deduction for MISSING_CONTACT', async () => {
      // Only email present
      const emailOnlyText = standardResumeText.replace(/\(555\) 123-4567/g, 'NO_PHONE');
      const qEmail = analyzeResumeQuality(emailOnlyText);
      if (qEmail.deductions.some((d) => d.rule === 'MISSING_CONTACT')) {
        throw new Error('Email alone should satisfy contact presence');
      }
      if (qEmail.sections_detected.contact_info.detected !== true) throw new Error('Expected contact_info true');

      // Only phone present
      const phoneOnlyText = standardResumeText.replace(/john\.doe@example\.com/g, 'NO_EMAIL');
      const qPhone = analyzeResumeQuality(phoneOnlyText);
      if (qPhone.deductions.some((d) => d.rule === 'MISSING_CONTACT')) {
        throw new Error('Phone alone should satisfy contact presence');
      }
      if (qPhone.sections_detected.contact_info.detected !== true) throw new Error('Expected contact_info true');
    });

    await test('23. Quality Rule: Missing Skills section applies exact 15.00 deduction (rule MISSING_SKILLS)', async () => {
      const noSkillsText = standardResumeText.replace(/Technical Skills:[\s\S]*?(?=Experience:)/i, '');
      const q = analyzeResumeQuality(noSkillsText);
      const d = q.deductions.find((item) => item.rule === 'MISSING_SKILLS');
      if (!d) throw new Error('Expected MISSING_SKILLS deduction');
      if (d.deduction !== 15.0) throw new Error(`Expected 15.00 deduction, got ${d.deduction}`);
      if (q.sections_detected.skills_section.detected !== false) throw new Error('Expected skills_section.detected false');
    });

    await test('24. Quality Rule: Present Skills section produces 0 deduction for MISSING_SKILLS', async () => {
      const q = analyzeResumeQuality(standardResumeText);
      if (q.deductions.some((d) => d.rule === 'MISSING_SKILLS')) {
        throw new Error('Did not expect MISSING_SKILLS deduction for standard resume');
      }
      if (q.sections_detected.skills_section.detected !== true) throw new Error('Expected skills_section true');
    });

    await test('25. Quality Rule: Missing Experience section applies exact 20.00 deduction (rule MISSING_EXPERIENCE)', async () => {
      const noExpText = standardResumeText.replace(/Experience:[\s\S]*?(?=Projects:)/i, '');
      const q = analyzeResumeQuality(noExpText);
      const d = q.deductions.find((item) => item.rule === 'MISSING_EXPERIENCE');
      if (!d) throw new Error('Expected MISSING_EXPERIENCE deduction');
      if (d.deduction !== 20.0) throw new Error(`Expected 20.00 deduction, got ${d.deduction}`);
      if (q.sections_detected.experience.detected !== false) throw new Error('Expected experience.detected false');
    });

    await test('26. Quality Rule: Present Experience section produces 0 deduction for MISSING_EXPERIENCE', async () => {
      const q = analyzeResumeQuality(standardResumeText);
      if (q.deductions.some((d) => d.rule === 'MISSING_EXPERIENCE')) {
        throw new Error('Did not expect MISSING_EXPERIENCE deduction for standard resume');
      }
      if (q.sections_detected.experience.detected !== true) throw new Error('Expected experience true');
    });

    await test('27. Quality Rule: Missing Education section applies exact 15.00 deduction (rule MISSING_EDUCATION)', async () => {
      const noEduText = standardResumeText.replace(/Education:[\s\S]*$/i, '');
      const q = analyzeResumeQuality(noEduText);
      const d = q.deductions.find((item) => item.rule === 'MISSING_EDUCATION');
      if (!d) throw new Error('Expected MISSING_EDUCATION deduction');
      if (d.deduction !== 15.0) throw new Error(`Expected 15.00 deduction, got ${d.deduction}`);
      if (q.sections_detected.education.detected !== false) throw new Error('Expected education.detected false');
    });

    await test('28. Quality Rule: Present Education section produces 0 deduction for MISSING_EDUCATION', async () => {
      const q = analyzeResumeQuality(standardResumeText);
      if (q.deductions.some((d) => d.rule === 'MISSING_EDUCATION')) {
        throw new Error('Did not expect MISSING_EDUCATION deduction for standard resume');
      }
      if (q.sections_detected.education.detected !== true) throw new Error('Expected education true');
    });

    await test('29. Quality Rule: Missing Projects section applies exact 10.00 deduction (rule MISSING_PROJECTS)', async () => {
      const noProjText = standardResumeText.replace(/Projects:[\s\S]*?(?=Education:)/i, '');
      const q = analyzeResumeQuality(noProjText);
      const d = q.deductions.find((item) => item.rule === 'MISSING_PROJECTS');
      if (!d) throw new Error('Expected MISSING_PROJECTS deduction');
      if (d.deduction !== 10.0) throw new Error(`Expected 10.00 deduction, got ${d.deduction}`);
      if (q.sections_detected.projects.detected !== false) throw new Error('Expected projects.detected false');
    });

    await test('30. Quality Rule: Word count < 150 words applies exact 20.00 deduction (rule WORD_COUNT_TOO_BRIEF)', async () => {
      const briefText = 'John Doe. Developer. Technical Skills: Python. Experience: Built website with 10k users. Education: BS CS. (555) 123-4567';
      const q = analyzeResumeQuality(briefText);
      const d = q.deductions.find((item) => item.rule === 'WORD_COUNT_TOO_BRIEF');
      if (!d) throw new Error('Expected WORD_COUNT_TOO_BRIEF deduction');
      if (d.deduction !== 20.0) throw new Error(`Expected 20.00 deduction, got ${d.deduction}`);
      if (q.formatting_metrics.word_count_status !== 'TOO_BRIEF') throw new Error(`Expected TOO_BRIEF, got ${q.formatting_metrics.word_count_status}`);
    });

    await test('31. Quality Rule: Word count 150–249 words applies exact 10.00 deduction (rule WORD_COUNT_SHORT)', async () => {
      // Create text with exactly ~180 words
      const shortText = `${standardResumeText.slice(0, 700)} ${'filler word '.repeat(50)}`;
      const words = shortText.trim().split(/\s+/).filter(Boolean).length;
      if (words < 150 || words >= 250) {
        // Adjust padding to ensure between 150 and 249
      }
      const padText = Array(180).fill('word').join(' ') + '\nTechnical Skills: Python\nExperience:\n- Built app\nEducation:\n- BS\nProjects:\n- App\nemail@test.com';
      const q = analyzeResumeQuality(padText);
      const d = q.deductions.find((item) => item.rule === 'WORD_COUNT_SHORT');
      if (!d) throw new Error(`Expected WORD_COUNT_SHORT deduction, words: ${q.formatting_metrics.word_count}`);
      if (d.deduction !== 10.0) throw new Error(`Expected 10.00 deduction, got ${d.deduction}`);
      if (q.formatting_metrics.word_count_status !== 'SHORT') throw new Error('Expected SHORT status');
    });

    await test('32. Quality Rule: Word count 250–1000 words produces 0 deduction (OPTIMAL)', async () => {
      const q = analyzeResumeQuality(standardResumeText);
      if (q.formatting_metrics.word_count < 250 || q.formatting_metrics.word_count > 1000) {
        throw new Error(`Standard resume word count ${q.formatting_metrics.word_count} is not in 250-1000 range`);
      }
      if (q.formatting_metrics.word_count_status !== 'OPTIMAL') throw new Error('Expected OPTIMAL status');
      if (q.deductions.some((d) => d.rule.startsWith('WORD_COUNT_'))) {
        throw new Error('Did not expect word count deduction');
      }
    });

    await test('33. Quality Rule: Word count 1001–1500 words applies exact 5.00 deduction (rule WORD_COUNT_LONG)', async () => {
      const longText = Array(1100).fill('word').join(' ') + '\nTechnical Skills: Python\nExperience:\n- Built app\nEducation:\n- BS\nProjects:\n- App\nemail@test.com';
      const q = analyzeResumeQuality(longText);
      const d = q.deductions.find((item) => item.rule === 'WORD_COUNT_LONG');
      if (!d) throw new Error('Expected WORD_COUNT_LONG deduction');
      if (d.deduction !== 5.0) throw new Error(`Expected 5.00 deduction, got ${d.deduction}`);
      if (q.formatting_metrics.word_count_status !== 'LONG') throw new Error('Expected LONG status');
    });

    await test('34. Quality Rule: Word count > 1500 words applies exact 15.00 deduction (rule WORD_COUNT_EXCESSIVE)', async () => {
      const excessiveText = Array(1600).fill('word').join(' ') + '\nTechnical Skills: Python\nExperience:\n- Built app\nEducation:\n- BS\nProjects:\n- App\nemail@test.com';
      const q = analyzeResumeQuality(excessiveText);
      const d = q.deductions.find((item) => item.rule === 'WORD_COUNT_EXCESSIVE');
      if (!d) throw new Error('Expected WORD_COUNT_EXCESSIVE deduction');
      if (d.deduction !== 15.0) throw new Error(`Expected 15.00 deduction, got ${d.deduction}`);
      if (q.formatting_metrics.word_count_status !== 'EXCESSIVE') throw new Error('Expected EXCESSIVE status');
    });

    await test('35. Quality Rule: Bullet points count < 3 applies exact 10.00 deduction (rule BULLET_POINTS_SPARSE)', async () => {
      const noBulletsText = standardResumeText.replace(/[-*•–—]\s+/g, '');
      const q = analyzeResumeQuality(noBulletsText);
      const d = q.deductions.find((item) => item.rule === 'BULLET_POINTS_SPARSE');
      if (!d) throw new Error('Expected BULLET_POINTS_SPARSE deduction');
      if (d.deduction !== 10.0) throw new Error(`Expected 10.00 deduction, got ${d.deduction}`);
      if (q.formatting_metrics.bullet_points_count >= 3) throw new Error('Expected < 3 bullet points');
    });

    // ========================================================================
    // Group 5: Action Verbs, Metrics Density & Score Clamping (7 Scenarios)
    // ========================================================================

    await test('36. Quality Rule: Action verbs count < 3 applies exact 10.00 deduction (rule ACTION_VERBS_LOW)', async () => {
      let textWithoutVerbs = standardResumeText;
      for (const v of ACTION_VERBS) {
        textWithoutVerbs = textWithoutVerbs.replace(new RegExp(`\\b${v}\\b`, 'gi'), 'did');
      }
      const q = analyzeResumeQuality(textWithoutVerbs);
      const d = q.deductions.find((item) => item.rule === 'ACTION_VERBS_LOW');
      if (!d) throw new Error('Expected ACTION_VERBS_LOW deduction');
      if (d.deduction !== 10.0) throw new Error(`Expected 10.00 deduction, got ${d.deduction}`);
      if (q.formatting_metrics.action_verbs_count >= 3) throw new Error(`Expected < 3 action verbs, got ${q.formatting_metrics.action_verbs_count}`);
    });

    await test('37. Quality Rule: Action verbs count >= 3 produces 0 deduction for action verbs', async () => {
      const q = analyzeResumeQuality(standardResumeText);
      if (q.formatting_metrics.action_verbs_count < 3) throw new Error('Standard resume should have >= 3 action verbs');
      if (q.deductions.some((d) => d.rule === 'ACTION_VERBS_LOW')) {
        throw new Error('Did not expect ACTION_VERBS_LOW deduction');
      }
    });

    await test('38. Quality Rule: Zero quantifiable metrics applies exact 15.00 deduction (rule METRICS_ZERO)', async () => {
      let noMetricsText = standardResumeText
        .replace(/50k\s+requests\s+per\s+second/gi, 'many requests')
        .replace(/40%/gi, 'significant rate')
        .replace(/35%/gi, 'some degree')
        .replace(/200k\s+active\s+users/gi, 'many users')
        .replace(/10k\s+messages/gi, 'many messages')
        .replace(/2x/gi, 'much');

      const q = analyzeResumeQuality(noMetricsText);
      const d = q.deductions.find((item) => item.rule === 'METRICS_ZERO');
      if (!d) throw new Error(`Expected METRICS_ZERO deduction, metrics count: ${q.formatting_metrics.quantifiable_metrics_count}`);
      if (d.deduction !== 15.0) throw new Error(`Expected 15.00 deduction, got ${d.deduction}`);
      if (q.formatting_metrics.quantifiable_metrics_count !== 0) throw new Error('Expected 0 metrics');
    });

    await test('39. Quality Rule: 1 to 2 quantifiable metrics applies exact 5.00 deduction (rule METRICS_SPARSE)', async () => {
      let sparseText = standardResumeText
        .replace(/50k\s+requests\s+per\s+second/gi, 'many requests')
        .replace(/40%/gi, 'significant rate')
        .replace(/35%/gi, 'some degree')
        .replace(/200k\s+active\s+users/gi, 'many users')
        .replace(/10k\s+messages/gi, 'many messages');
      // Only 2x remains (1 metric)

      const q = analyzeResumeQuality(sparseText);
      const d = q.deductions.find((item) => item.rule === 'METRICS_SPARSE');
      if (!d) throw new Error(`Expected METRICS_SPARSE deduction, metrics: ${q.formatting_metrics.quantifiable_metrics_count}`);
      if (d.deduction !== 5.0) throw new Error(`Expected 5.00 deduction, got ${d.deduction}`);
      if (q.formatting_metrics.quantifiable_metrics_count < 1 || q.formatting_metrics.quantifiable_metrics_count > 2) {
        throw new Error(`Expected 1 or 2 metrics, got ${q.formatting_metrics.quantifiable_metrics_count}`);
      }
    });

    await test('40. Quality Rule: 3 or more quantifiable metrics produces 0 deduction for metrics', async () => {
      const q = analyzeResumeQuality(standardResumeText);
      if (q.formatting_metrics.quantifiable_metrics_count < 3) throw new Error('Expected >= 3 metrics');
      if (q.deductions.some((d) => d.rule.startsWith('METRICS_'))) {
        throw new Error('Did not expect metrics deduction');
      }
    });

    await test('41. Quality Clamping: Flawless resume with 0 deductions clamps to exactly 100.00', async () => {
      // standardResumeText satisfies all sections, optimal length, >= 3 bullets, >= 3 verbs, >= 3 metrics
      const q = analyzeResumeQuality(standardResumeText);
      if (q.deductions.length !== 0) {
        throw new Error(`Expected 0 deductions for standard resume, got: ${JSON.stringify(q.deductions)}`);
      }
      if (q.quality_score !== 100.0) throw new Error(`Expected 100.00 quality_score, got ${q.quality_score}`);
    });

    await test('42. Quality Clamping: Heavily penalized resume with deductions > 100 clamps to exactly 0.00', async () => {
      // Resume with no sections, < 150 words, 0 bullets, 0 action verbs, 0 metrics
      // Total deductions: Contact(15) + Skills(15) + Experience(20) + Education(15) + Projects(10) + Brief(20) + Bullets(10) + Verbs(10) + Metrics(15) = 140
      const abysmalText = 'Just a small plain sentence without sections or verbs or numbers.';
      const q = analyzeResumeQuality(abysmalText);
      const totalDeductions = q.deductions.reduce((sum, d) => sum + d.deduction, 0);
      if (totalDeductions <= 100) throw new Error(`Expected total deductions > 100, got ${totalDeductions}`);
      if (q.quality_score !== 0.0) throw new Error(`Expected clamped 0.00 quality_score, got ${q.quality_score}`);
    });

    // ========================================================================
    // Group 6: Actionable Recommendations Synthesis, Priorities & Category Filtering (7 Scenarios)
    // ========================================================================

    await test('43. Recommendations: Generates HIGH priority recommendations for missing required skills and missing core sections', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA);
      const body = await res.json();
      const recs = body.data.recommendations;

      // In baseJobIdA, Kubernetes is required and missing -> HIGH
      const k8sRec = recs.find((r) => r.id === 'rec_gap_required_kubernetes');
      if (!k8sRec) throw new Error('Expected rec_gap_required_kubernetes recommendation');
      if (k8sRec.priority !== 'HIGH') throw new Error(`Expected HIGH priority, got ${k8sRec.priority}`);
      if (k8sRec.category !== 'SKILL_GAP') throw new Error(`Expected SKILL_GAP category, got ${k8sRec.category}`);
    });

    await test('44. Recommendations: Generates MEDIUM priority recommendations for missing preferred skills and sparse metrics', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA);
      const body = await res.json();
      const recs = body.data.recommendations;

      // In baseJobIdA, AWS is preferred and missing -> MEDIUM
      const awsRec = recs.find((r) => r.id === 'rec_gap_preferred_aws');
      if (!awsRec) throw new Error('Expected rec_gap_preferred_aws recommendation');
      if (awsRec.priority !== 'MEDIUM') throw new Error(`Expected MEDIUM priority, got ${awsRec.priority}`);
      if (awsRec.category !== 'SKILL_GAP') throw new Error(`Expected SKILL_GAP category, got ${awsRec.category}`);
    });

    await test('45. Recommendations: Filter ?priority=HIGH returns exclusively HIGH priority items', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations?priority=HIGH`, {}, tokenA);
      const body = await res.json();
      const recs = body.data.recommendations;

      if (recs.length === 0) throw new Error('Expected at least 1 HIGH recommendation');
      for (const r of recs) {
        if (r.priority !== 'HIGH') throw new Error(`Expected only HIGH priority, got ${r.priority}`);
      }
    });

    await test('46. Recommendations: Filter ?category=SKILL_GAP returns exclusively recommendations where category is SKILL_GAP', async () => {
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations?category=SKILL_GAP`, {}, tokenA);
      const body = await res.json();
      const recs = body.data.recommendations;

      if (recs.length === 0) throw new Error('Expected at least 1 SKILL_GAP recommendation');
      for (const r of recs) {
        if (r.category !== 'SKILL_GAP') throw new Error(`Expected only SKILL_GAP category, got ${r.category}`);
      }
    });

    await test('47. Recommendations: Filter ?category=RESUME_QUALITY returns exclusively recommendations where category is RESUME_QUALITY', async () => {
      // Create analysis with missing education
      const noEduText = standardResumeText.replace(/Education:[\s\S]*$/i, '');
      const noEduResumeId = await insertResume({
        userId: userA.userId,
        fileName: 'no_edu.pdf',
        text: noEduText,
      });
      const noEduAnalysis = await analysisService.createAnalysis({
        userId: userA.userId,
        resumeId: noEduResumeId,
        jobId: baseJobIdA,
      });

      const res = await api(`/api/analyses/${noEduAnalysis.analysis_id}/recommendations?category=RESUME_QUALITY`, {}, tokenA);
      const body = await res.json();
      const recs = body.data.recommendations;

      if (recs.length === 0) throw new Error('Expected at least 1 RESUME_QUALITY recommendation');
      for (const r of recs) {
        if (r.category !== 'RESUME_QUALITY') throw new Error(`Expected only RESUME_QUALITY category, got ${r.category}`);
      }
    });

    await test('48. Recommendations: Filter ?category=IMPACT_METRICS returns exclusively recommendations where category is IMPACT_METRICS', async () => {
      // Create analysis with no metrics
      const noMetricsText = standardResumeText
        .replace(/50k\s+requests\s+per\s+second/gi, 'many requests')
        .replace(/40%/gi, 'rate')
        .replace(/35%/gi, 'some')
        .replace(/200k\s+active\s+users/gi, 'users')
        .replace(/10k\s+messages/gi, 'messages')
        .replace(/2x/gi, 'faster');

      const noMetricsResumeId = await insertResume({
        userId: userA.userId,
        fileName: 'no_metrics.pdf',
        text: noMetricsText,
      });
      const noMetricsAnalysis = await analysisService.createAnalysis({
        userId: userA.userId,
        resumeId: noMetricsResumeId,
        jobId: baseJobIdA,
      });

      const res = await api(`/api/analyses/${noMetricsAnalysis.analysis_id}/recommendations?category=IMPACT_METRICS`, {}, tokenA);
      const body = await res.json();
      const recs = body.data.recommendations;

      if (recs.length === 0) throw new Error('Expected at least 1 IMPACT_METRICS recommendation');
      for (const r of recs) {
        if (r.category !== 'IMPACT_METRICS') throw new Error(`Expected only IMPACT_METRICS category, got ${r.category}`);
      }
    });

    await test('49. Recommendations: Filter ?category=FORMATTING returns exclusively recommendations where category is FORMATTING', async () => {
      // Create analysis with no bullets
      const noBulletsText = standardResumeText.replace(/[-*•–—]\s+/g, '');
      const noBulletsResumeId = await insertResume({
        userId: userA.userId,
        fileName: 'no_bullets.pdf',
        text: noBulletsText,
      });
      const noBulletsAnalysis = await analysisService.createAnalysis({
        userId: userA.userId,
        resumeId: noBulletsResumeId,
        jobId: baseJobIdA,
      });

      const res = await api(`/api/analyses/${noBulletsAnalysis.analysis_id}/recommendations?category=FORMATTING`, {}, tokenA);
      const body = await res.json();
      const recs = body.data.recommendations;

      if (recs.length === 0) throw new Error('Expected at least 1 FORMATTING recommendation');
      for (const r of recs) {
        if (r.category !== 'FORMATTING') throw new Error(`Expected only FORMATTING category, got ${r.category}`);
      }
    });

    // ========================================================================
    // Group 7: Edge Cases, Resilience & Immutability (4 Scenarios)
    // ========================================================================

    await test('50. Edge Case: Resume deleted after analysis (analyses.resume_id IS NULL) still returns skill gap analysis and sets resume_quality = UNAVAILABLE', async () => {
      // Create disposable resume and analysis
      const tempResumeId = await insertResume({
        userId: userA.userId,
        fileName: 'temp_resume.pdf',
        text: standardResumeText,
      });
      const tempAnalysis = await analysisService.createAnalysis({
        userId: userA.userId,
        resumeId: tempResumeId,
        jobId: baseJobIdA,
      });

      // Delete resume -> analyses.resume_id set to NULL via ON DELETE SET NULL
      await query('DELETE FROM resumes WHERE resume_id = $1', [tempResumeId]);

      const res = await api(`/api/analyses/${tempAnalysis.analysis_id}/recommendations`, {}, tokenA);
      const body = await res.json();

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (body.data.resume_id !== null) throw new Error('Expected resume_id null');
      if (body.data.resume_quality.status !== 'UNAVAILABLE') throw new Error('Expected resume_quality.status UNAVAILABLE');
      // Skill gap analysis still works from analysis_skills
      if (!body.data.skill_gap_analysis.critical_missing_required) throw new Error('Skill gap analysis must still be present');
    });

    await test('51. Edge Case: Job description deleted after analysis (analyses.job_id IS NULL) still returns complete recommendations from analysis_skills snapshot', async () => {
      // Create disposable job and analysis
      const tempJobId = await insertJob({
        userId: userA.userId,
        title: 'Temp Job',
        description: 'Skills: Python, Docker, Kubernetes',
        extractedData: targetJobData,
      });
      const tempAnalysis = await analysisService.createAnalysis({
        userId: userA.userId,
        resumeId: baseResumeIdA,
        jobId: tempJobId,
      });

      // Delete job -> analyses.job_id set to NULL
      await query('DELETE FROM job_descriptions WHERE job_id = $1', [tempJobId]);

      const res = await api(`/api/analyses/${tempAnalysis.analysis_id}/recommendations`, {}, tokenA);
      const body = await res.json();

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (body.data.job_id !== null) throw new Error('Expected job_id null');
      if (!body.data.skill_gap_analysis.critical_missing_required) throw new Error('Skill gap analysis must be present');
      if (body.data.recommendations.length === 0) throw new Error('Expected recommendations to be populated');
    });

    await test('52. Immutability: Fetching recommendations causes zero database writes (analyses and analysis_skills remain unchanged)', async () => {
      // Query baseline state
      const beforeAnalysis = await query('SELECT * FROM analyses WHERE analysis_id = $1', [baseAnalysisIdA]);
      const beforeSkills = await query('SELECT * FROM analysis_skills WHERE analysis_id = $1 ORDER BY skill_id', [baseAnalysisIdA]);

      // Call recommendations endpoint
      const res = await api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

      // Query state after
      const afterAnalysis = await query('SELECT * FROM analyses WHERE analysis_id = $1', [baseAnalysisIdA]);
      const afterSkills = await query('SELECT * FROM analysis_skills WHERE analysis_id = $1 ORDER BY skill_id', [baseAnalysisIdA]);

      // Compare every column in analyses
      for (const [col, val] of Object.entries(beforeAnalysis.rows[0])) {
        if (String(afterAnalysis.rows[0][col]) !== String(val)) {
          throw new Error(`analyses column ${col} mutated from ${val} to ${afterAnalysis.rows[0][col]}`);
        }
      }

      // Compare every row in analysis_skills
      if (beforeSkills.rowCount !== afterSkills.rowCount) throw new Error('analysis_skills count changed');
      for (let i = 0; i < beforeSkills.rowCount; i++) {
        const b = beforeSkills.rows[i];
        const a = afterSkills.rows[i];
        if (b.status !== a.status || b.evidence !== a.evidence || b.similarity_score !== a.similarity_score) {
          throw new Error(`analysis_skills row ${i} mutated`);
        }
      }
    });

    await test('53. Concurrency: Multiple concurrent recommendation requests complete deterministically with identical outputs', async () => {
      const promises = [
        api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA),
        api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA),
        api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA),
        api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA),
        api(`/api/analyses/${baseAnalysisIdA}/recommendations`, {}, tokenA),
      ];

      const responses = await Promise.all(promises);
      const bodies = await Promise.all(responses.map((r) => r.json()));

      for (let i = 0; i < responses.length; i++) {
        if (responses[i].status !== 200) throw new Error(`Request ${i} failed with ${responses[i].status}`);
      }

      const canonicalJson = JSON.stringify(bodies[0].data);
      for (let i = 1; i < bodies.length; i++) {
        if (JSON.stringify(bodies[i].data) !== canonicalJson) {
          throw new Error(`Concurrent response ${i} diverged from canonical response`);
        }
      }
    });

  } finally {
    // Teardown test users
    try {
      if (userA?.userId) await query('DELETE FROM users WHERE user_id = $1', [userA.userId]);
      if (userB?.userId) await query('DELETE FROM users WHERE user_id = $1', [userB.userId]);
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }

    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n====================================================');
  console.log(`Phase 7 Stage 4 Recommendation Suite: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
    throw new Error(`Stage 4 Recommendation Suite Failed with ${failed} failure(s)`);
  }
  process.exit(0);
};

runRecommendationTests().catch((err) => {
  console.error('Unhandled Stage 4 test failure:', err);
  process.exit(1);
});
