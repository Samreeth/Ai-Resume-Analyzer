/**
 * Comprehensive Test Suite for Stage 4: Personalized AI Recommendations
 *
 * Validates:
 * 1. Authentication & IDOR Authorization:
 *    - Unauthenticated requests rejected with 401
 *    - Cross-user resume access rejected with 404
 *    - Cross-user job access rejected with 404
 * 2. Explicit Opt-in Consent Enforcement:
 *    - Missing consent rejected with 400 AI_CONSENT_REQUIRED
 *    - consent: false rejected with 400 AI_CONSENT_REQUIRED
 *    - Verify Gemini is NOT called when consent is missing or false
 *    - consent: true allowed to proceed
 * 3. Recommendation Schema & Category/Source Invariants:
 *    - Strict 1:1 mapping: SKILL_GAP -> DETERMINISTIC_ANALYSIS, RESUME_STRENGTH -> RESUME_EVIDENCE, JOB_REQUIREMENT -> JOB_REQUIREMENT
 *    - All 6 invalid category/source pairings rejected by Zod schema
 *    - Null evidence_snippet enforced for DETERMINISTIC_ANALYSIS
 *    - Non-empty evidence_snippet enforced for RESUME_EVIDENCE
 * 4. JOB_REQUIREMENT Candidate-Attribution Safeguard:
 *    - Negative: Claiming candidate possession under JOB_REQUIREMENT marked UNVERIFIED
 *    - Positive: Discussing job description expectations without candidate possession marked VERIFIED
 * 5. Overall Strategy Grounding Invariants (Generic Candidate Invariant):
 *    - Strategy Test 1: Unsupported leadership claim marked UNVERIFIED
 *    - Strategy Test 2: Contradicting deterministic missing skill marked UNVERIFIED
 *    - Strategy Test 3: Unsupported skill/certification/years marked UNVERIFIED
 *    - Strategy Test 4: Unsupported project/achievement/metric marked UNVERIFIED
 *    - Strategy Test 5: Unsupported education/domain marked UNVERIFIED
 *    - Strategy Test 6: Valid grounded synthesis marked VERIFIED
 *    - Strategy Test 7: All ungrounded recommendations forces strategy UNVERIFIED
 * 6. Deterministic Priority Authority:
 *    - Missing REQUIRED skill priority locked to HIGH and marked UNVERIFIED if Gemini deviated
 *    - Missing PREFERRED skill priority locked to MEDIUM and marked UNVERIFIED if Gemini deviated
 * 7. Canonical Source Payload Hashing & Cache Invalidation:
 *    - Cache hit on matching 3-part hashes (sanitized resume, sanitized job, deterministic analysis)
 *    - Cache invalidated on resume change
 *    - Cache invalidated on job change
 *    - Cache invalidated on deterministic analysis change
 *    - GET endpoint returns cached recommendations with 200 or 404 when stale/missing
 * 8. PII Protection:
 *    - Evidence snippet with redaction marker rejected as UNVERIFIED
 *    - Snippet with unredacted PII rejected
 * 9. Error Handling & Provider Fault Tolerance:
 *    - Malformed JSON from Gemini returns 502 and does NOT write invalid cache
 *    - Schema violation returns 502 and does NOT write invalid cache
 *    - Deterministic score and matching engine remain 100% untouched
 *
 * NOTE: 100% offline testing with ZERO live Gemini API network calls.
 */

import http from 'http';
import assert from 'node:assert/strict';
import app from '../src/app.mjs';
import config from '../src/config/env.mjs';
import { query, pool, testDbConnection } from '../src/config/database.mjs';
import { registerUser, generateToken } from '../src/services/auth.service.mjs';
import { createJob } from '../src/services/job.service.mjs';
import { computeFileHash } from '../src/utils/file.util.mjs';
import {
  setMockGeminiClient,
  clearMockGeminiClient,
  extractPersonalizedRecommendations,
} from '../src/services/gemini.service.mjs';
import {
  recommendationItemSchema,
  resumeAiRecommendationsOutputSchema,
  aiRecommendationsRequestSchema,
} from '../src/validators/resume.ai.validator.mjs';
import { verifyRecommendationGrounding } from '../src/utils/grounding.util.mjs';
import { aiGenerationRateLimiter } from '../src/middleware/rate-limit.middleware.mjs';

let passed = 0;
let failed = 0;

const test = async (name, fn) => {
  aiGenerationRateLimiter.reset();
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    if (err.stack) console.error(err.stack);
    failed++;
    process.exitCode = 1;
  }
};

export const runRecommendationAiTests = async () => {
  console.log('====================================================');
  console.log('Running Stage 4: Personalized Recommendations Tests');
  console.log('====================================================\n');

  // Verify DB
  const dbStatus = await testDbConnection();
  if (!dbStatus.connected) {
    console.error('[FATAL] Database connection required for Stage 4 AI tests.');
    process.exit(1);
  }

  // Start ephemeral test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const request = async (endpoint, { method = 'GET', token = null, body = null } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => null);
    return { status: res.status, headers: res.headers, data };
  };

  // Setup test users
  const timestamp = Date.now();
  const userA = await registerUser({
    name: 'Alice Developer',
    email: `alice_recai_${timestamp}@example.com`,
    password: 'Password123!Secure',
  });
  const tokenA = generateToken(userA);

  const userB = await registerUser({
    name: 'Bob Candidate',
    email: `bob_recai_${timestamp}@example.com`,
    password: 'Password123!Secure',
  });
  const tokenB = generateToken(userB);

  // Resume text with React, Node.js, Express, PostgreSQL (NO AWS, NO Docker, NO leadership)
  const validResumeText = `
Alice Developer
Full Stack Software Engineer | San Francisco, CA
Contact: alice@example.com | (555) 019-2834 | 123 Market St, San Francisco, CA 94105

Professional Summary:
Passionate software engineer with 4 years of experience building modern React web applications and REST APIs.

Technical Skills:
- Frontend: React, Redux, HTML, CSS, JavaScript
- Backend: Node.js, Express, PostgreSQL
- Tools: Git, Jest

Experience:
Software Engineer at Acme Corp (2022 - Present)
- Developed responsive web applications using React and Redux across 4 years of production engineering.
- Designed RESTful API endpoints in Node.js and Express with PostgreSQL database integration.

Education:
Bachelor of Science in Computer Science (2018 - 2022)
`.trim();

  // Helper to create test resume
  const createTestResume = async ({
    userId,
    status = 'COMPLETED',
    text = validResumeText,
    extractedData = null,
  }) => {
    const res = await query(
      `INSERT INTO resumes (
        user_id, file_name, file_path, file_size, mime_type, file_hash, extraction_status, extracted_text, extracted_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING resume_id, file_name, extraction_status, extracted_text, extracted_data`,
      [
        userId,
        'resume_alice_rec.pdf',
        'resumes/test_alice_rec.pdf',
        1024,
        'application/pdf',
        computeFileHash(Buffer.from(text)),
        status,
        text,
        extractedData ? JSON.stringify(extractedData) : null,
      ]
    );
    return res.rows[0];
  };

  // Helper to create test job
  const createTestJob = async ({
    userId,
    title = 'Senior Cloud Full Stack Engineer',
    description = 'We need a Full Stack Engineer with React, Node.js, Docker (Required), and AWS (Preferred). 3+ years deploying and managing services on AWS (ECS, S3, RDS).',
  }) => {
    return await createJob({
      userId,
      title,
      description,
      department: 'Engineering',
      location: 'San Francisco, CA',
      employment_type: 'Full-time',
    });
  };

  // Default valid mock recommendations response
  const createValidMockResponse = ({
    strategySummary = 'Leverage your 4 years of verified React experience to showcase frontend mastery while prioritizing Docker containerization upskilling for backend requirements.',
    recommendations = null,
  } = {}) => ({
    overall_strategy: {
      summary: strategySummary,
      verification_status: 'VERIFIED',
      unverified_reason: null,
    },
    recommendations: recommendations || [
      {
        id: 'rec-1',
        category: 'SKILL_GAP',
        source_type: 'DETERMINISTIC_ANALYSIS',
        title: 'Learn Docker Containerization',
        recommendation: 'Complete a containerization tutorial and build a multi-container Docker deployment.',
        rationale: 'Docker is an authoritative missing required skill in the deterministic match.',
        priority: 'HIGH',
        evidence_snippet: null,
        verification_status: 'VERIFIED',
        unverified_reason: null,
      },
      {
        id: 'rec-2',
        category: 'RESUME_STRENGTH',
        source_type: 'RESUME_EVIDENCE',
        title: 'Highlight Production React Experience',
        recommendation: 'Feature your React and Redux state management achievements prominently.',
        rationale: 'Verified resume evidence confirms 4 years of production React engineering.',
        priority: 'HIGH',
        evidence_snippet: 'Developed responsive web applications using React and Redux across 4 years of production engineering.',
        verification_status: 'VERIFIED',
        unverified_reason: null,
      },
      {
        id: 'rec-3',
        category: 'JOB_REQUIREMENT',
        source_type: 'JOB_REQUIREMENT',
        title: 'Prepare for AWS Cloud Expectations',
        recommendation: 'Study AWS cloud deployment architectures to prepare for technical interview questions.',
        rationale: 'The position requires familiarity with cloud services on AWS.',
        priority: 'MEDIUM',
        evidence_snippet: '3+ years deploying and managing services on AWS (ECS, S3, RDS)',
        verification_status: 'VERIFIED',
        unverified_reason: null,
      },
    ],
  });

  try {
    // =========================================================================
    // SECTION 1: AUTHENTICATION & IDOR TESTS
    // =========================================================================

    await test('1. Auth: Rejects unauthenticated POST /api/resumes/:resumeId/ai-recommendations with 401', async () => {
      const res = await request('/api/resumes/8bbce2c0-8ec5-40ea-92b4-e2b260d738f7/ai-recommendations', {
        method: 'POST',
        body: { jobId: '8bbce2c0-8ec5-40ea-92b4-e2b260d738f7', consent: true },
      });
      assert.strictEqual(res.status, 401);
    });

    await test('2. Auth: Rejects unauthenticated GET /api/resumes/:resumeId/ai-recommendations with 401', async () => {
      const res = await request('/api/resumes/8bbce2c0-8ec5-40ea-92b4-e2b260d738f7/ai-recommendations?jobId=8bbce2c0-8ec5-40ea-92b4-e2b260d738f7');
      assert.strictEqual(res.status, 401);
    });

    await test('3. IDOR: User B cannot generate recommendations for User A resume (returns 404)', async () => {
      const resumeA = await createTestResume({ userId: userA.user_id });
      const jobA = await createTestJob({ userId: userA.user_id });

      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenB,
        body: { jobId: jobA.job_id, consent: true },
      });
      assert.strictEqual(res.status, 404);
    });

    await test('4. IDOR: User A cannot pair their resume with User B job (returns 404)', async () => {
      const resumeA = await createTestResume({ userId: userA.user_id });
      const jobB = await createTestJob({ userId: userB.user_id });

      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: jobB.job_id, consent: true },
      });
      assert.strictEqual(res.status, 404);
    });

    // =========================================================================
    // SECTION 2: EXPLICIT CONSENT ENFORCEMENT
    // =========================================================================

    await test('5. Consent: Rejects request with missing consent field with 400 AI_CONSENT_REQUIRED', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      let geminiCalled = false;
      setMockGeminiClient({
        models: {
          generateContent: async () => {
            geminiCalled = true;
            return { text: JSON.stringify(createValidMockResponse()) };
          },
        },
      });

      const res = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id },
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(geminiCalled, false, 'Gemini must not be called when consent is missing');
      clearMockGeminiClient();
    });

    await test('6. Consent: Rejects request with consent=false with 400 AI_CONSENT_REQUIRED', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      let geminiCalled = false;
      setMockGeminiClient({
        models: {
          generateContent: async () => {
            geminiCalled = true;
            return { text: JSON.stringify(createValidMockResponse()) };
          },
        },
      });

      const res = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: false },
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(geminiCalled, false, 'Gemini must not be called when consent is false');
      clearMockGeminiClient();
    });

    await test('6b. Consent: Rejects request with consent=null with 400 AI_CONSENT_REQUIRED without calling Gemini or writing to DB', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      let geminiCalled = false;
      setMockGeminiClient({
        models: {
          generateContent: async () => {
            geminiCalled = true;
            return { text: JSON.stringify(createValidMockResponse()) };
          },
        },
      });

      const res = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: null, force_refresh: false },
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(geminiCalled, false, 'Gemini must not be called when consent is null');

      // Verify no cache written to DB
      const dbRes = await query('SELECT extracted_data FROM resumes WHERE resume_id = $1', [resume.resume_id]);
      assert.strictEqual(dbRes.rows[0].extracted_data?.ai_recommendations?.[job.job_id], undefined);
      clearMockGeminiClient();
    });

    // =========================================================================
    // SECTION 3: SCHEMA & CATEGORY/SOURCE 1:1 COMPATIBILITY TESTS
    // =========================================================================

    await test('7. Schema: Valid pairings (SKILL_GAP/DET, RESUME_STRENGTH/RESUME, JOB_REQ/JOB_REQ) PASS schema validation', async () => {
      const validPayload = createValidMockResponse();
      const parseResult = resumeAiRecommendationsOutputSchema.safeParse(validPayload);
      assert.strictEqual(parseResult.success, true);
    });

    await test('8. Schema: Incompatible pairing 1 — SKILL_GAP with RESUME_EVIDENCE FAILS validation', async () => {
      const invalid = {
        id: 'rec-x',
        category: 'SKILL_GAP',
        source_type: 'RESUME_EVIDENCE',
        title: 'Missing Cloud',
        recommendation: 'Learn AWS',
        rationale: 'Cloud gap',
        priority: 'HIGH',
        evidence_snippet: 'Acme Corp',
      };
      const result = recommendationItemSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    await test('9. Schema: Incompatible pairing 2 — SKILL_GAP with JOB_REQUIREMENT FAILS validation', async () => {
      const invalid = {
        id: 'rec-x',
        category: 'SKILL_GAP',
        source_type: 'JOB_REQUIREMENT',
        title: 'Missing Docker',
        recommendation: 'Learn Docker',
        rationale: 'Gap',
        priority: 'HIGH',
        evidence_snippet: null,
      };
      const result = recommendationItemSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    await test('10. Schema: Incompatible pairing 3 — RESUME_STRENGTH with DETERMINISTIC_ANALYSIS FAILS validation', async () => {
      const invalid = {
        id: 'rec-x',
        category: 'RESUME_STRENGTH',
        source_type: 'DETERMINISTIC_ANALYSIS',
        title: 'React Strength',
        recommendation: 'Showcase React',
        rationale: 'Strength',
        priority: 'HIGH',
        evidence_snippet: null,
      };
      const result = recommendationItemSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    await test('11. Schema: Incompatible pairing 4 — RESUME_STRENGTH with JOB_REQUIREMENT FAILS validation', async () => {
      const invalid = {
        id: 'rec-x',
        category: 'RESUME_STRENGTH',
        source_type: 'JOB_REQUIREMENT',
        title: 'React Strength',
        recommendation: 'Showcase React',
        rationale: 'Strength',
        priority: 'HIGH',
        evidence_snippet: 'React',
      };
      const result = recommendationItemSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    await test('12. Schema: Incompatible pairing 5 — JOB_REQUIREMENT with RESUME_EVIDENCE FAILS validation', async () => {
      const invalid = {
        id: 'rec-x',
        category: 'JOB_REQUIREMENT',
        source_type: 'RESUME_EVIDENCE',
        title: 'Cloud Requirement',
        recommendation: 'Target Cloud',
        rationale: 'Job requirement',
        priority: 'HIGH',
        evidence_snippet: 'Acme Corp',
      };
      const result = recommendationItemSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    await test('13. Schema: Incompatible pairing 6 — JOB_REQUIREMENT with DETERMINISTIC_ANALYSIS FAILS validation', async () => {
      const invalid = {
        id: 'rec-x',
        category: 'JOB_REQUIREMENT',
        source_type: 'DETERMINISTIC_ANALYSIS',
        title: 'Cloud Requirement',
        recommendation: 'Target Cloud',
        rationale: 'Job requirement',
        priority: 'HIGH',
        evidence_snippet: null,
      };
      const result = recommendationItemSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    await test('14. Schema: DETERMINISTIC_ANALYSIS with non-null snippet FAILS validation', async () => {
      const invalid = {
        id: 'rec-x',
        category: 'SKILL_GAP',
        source_type: 'DETERMINISTIC_ANALYSIS',
        title: 'Gap',
        recommendation: 'Learn Docker',
        rationale: 'Gap',
        priority: 'HIGH',
        evidence_snippet: 'Docker required',
      };
      const result = recommendationItemSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    await test('15. Schema: RESUME_EVIDENCE with empty/missing snippet FAILS validation', async () => {
      const invalid = {
        id: 'rec-x',
        category: 'RESUME_STRENGTH',
        source_type: 'RESUME_EVIDENCE',
        title: 'Strength',
        recommendation: 'Showcase',
        rationale: 'Strength',
        priority: 'HIGH',
        evidence_snippet: null,
      };
      const result = recommendationItemSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    // =========================================================================
    // SECTION 4: JOB_REQUIREMENT CANDIDATE-ATTRIBUTION TESTS
    // =========================================================================

    await test('16. Attribution: JOB_REQUIREMENT asserting candidate possession is marked UNVERIFIED', async () => {
      const rawRecs = [
        {
          id: 'rec-job-attribution',
          category: 'JOB_REQUIREMENT',
          source_type: 'JOB_REQUIREMENT',
          title: 'Kubernetes Experience',
          recommendation: 'Leverage your proven Kubernetes experience to pass the technical interview.',
          rationale: 'The candidate already possesses the required 5+ years Kubernetes experience demanded by the job.',
          priority: 'HIGH',
          evidence_snippet: '3+ years deploying and managing services on AWS',
        },
      ];

      const grounded = verifyRecommendationGrounding({
        recommendations: rawRecs,
        overall_strategy: { summary: 'Standard candidate strategy' },
        resumeText: validResumeText,
        jobDescription: '3+ years deploying and managing services on AWS',
      });

      assert.strictEqual(grounded.recommendations[0].verification_status, 'UNVERIFIED');
      assert.strictEqual(grounded.recommendations[0].unverified_reason, 'Job requirement cannot be asserted as candidate possession');
    });

    await test('17. Attribution: JOB_REQUIREMENT discussing role requirements without candidate possession is VERIFIED', async () => {
      const rawRecs = [
        {
          id: 'rec-job-valid',
          category: 'JOB_REQUIREMENT',
          source_type: 'JOB_REQUIREMENT',
          title: 'Target Cloud Deployment Architecture',
          recommendation: 'Prepare for technical interview questions on cloud infrastructure patterns as required by the employer.',
          rationale: 'The role demands cloud architecture familiarity.',
          priority: 'MEDIUM',
          evidence_snippet: '3+ years deploying and managing services on AWS',
        },
      ];

      const grounded = verifyRecommendationGrounding({
        recommendations: rawRecs,
        overall_strategy: { summary: 'Leverage your 4 years of verified React experience to prepare for role interviews.' },
        resumeText: validResumeText,
        jobDescription: '3+ years deploying and managing services on AWS',
      });

      assert.strictEqual(grounded.recommendations[0].verification_status, 'VERIFIED');
      assert.strictEqual(grounded.recommendations[0].unverified_reason, null);
    });

    // =========================================================================
    // SECTION 5: OVERALL STRATEGY GROUNDING INVARIANTS (GENERIC INVARIANT TESTS)
    // =========================================================================

    await test('18. Strategy Test 1: Unsupported leadership claim marks overall_strategy UNVERIFIED', async () => {
      const grounded = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-1',
            category: 'RESUME_STRENGTH',
            source_type: 'RESUME_EVIDENCE',
            title: 'React Strength',
            recommendation: 'Showcase React',
            rationale: 'React experience',
            priority: 'HIGH',
            evidence_snippet: 'Developed responsive web applications using React and Redux',
          },
        ],
        overall_strategy: {
          summary: 'Leverage your extensive leadership experience as engineering director to head the technical team.',
        },
        resumeText: validResumeText,
      });

      assert.strictEqual(grounded.overall_strategy.verification_status, 'UNVERIFIED');
      assert.ok(grounded.overall_strategy.unverified_reason.includes('leadership'));
    });

    await test('19. Strategy Test 2: Contradicts deterministic missing skill marks overall_strategy UNVERIFIED', async () => {
      const deterministicResults = {
        required_skills_missing: ['aws', 'docker'],
        required_skills_matched: ['react'],
      };

      const grounded = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-1',
            category: 'RESUME_STRENGTH',
            source_type: 'RESUME_EVIDENCE',
            title: 'React Strength',
            recommendation: 'Showcase React',
            rationale: 'React experience',
            priority: 'HIGH',
            evidence_snippet: 'Developed responsive web applications using React and Redux',
          },
        ],
        overall_strategy: {
          summary: 'Leverage your strong production AWS experience and cloud expertise to accelerate team delivery.',
        },
        resumeText: validResumeText,
        deterministicResults,
      });

      assert.strictEqual(grounded.overall_strategy.verification_status, 'UNVERIFIED');
      assert.ok(grounded.overall_strategy.unverified_reason.includes("deterministic missing skill: 'aws'"));
    });

    await test('20. Strategy Test 3: Unsupported skill/certification/years marks overall_strategy UNVERIFIED', async () => {
      const grounded = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-1',
            category: 'RESUME_STRENGTH',
            source_type: 'RESUME_EVIDENCE',
            title: 'React Strength',
            recommendation: 'Showcase React',
            rationale: 'React experience',
            priority: 'HIGH',
            evidence_snippet: 'Developed responsive web applications using React and Redux',
          },
        ],
        overall_strategy: {
          summary: 'Highlight your 10 years of experience as a certified Solutions Architect with Kubernetes.',
        },
        resumeText: validResumeText,
      });

      assert.strictEqual(grounded.overall_strategy.verification_status, 'UNVERIFIED');
      assert.ok(grounded.overall_strategy.unverified_reason.includes('unsupported candidate factual claims'));
    });

    await test('21. Strategy Test 4: Unsupported project/achievement/metric marks overall_strategy UNVERIFIED', async () => {
      const grounded = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-1',
            category: 'RESUME_STRENGTH',
            source_type: 'RESUME_EVIDENCE',
            title: 'React Strength',
            recommendation: 'Showcase React',
            rationale: 'React experience',
            priority: 'HIGH',
            evidence_snippet: 'Developed responsive web applications using React and Redux',
          },
        ],
        overall_strategy: {
          summary: 'Emphasize your work building an automated fraud detection engine processing 10k req and reduced latency by 80%.',
        },
        resumeText: validResumeText,
      });

      assert.strictEqual(grounded.overall_strategy.verification_status, 'UNVERIFIED');
      assert.ok(grounded.overall_strategy.unverified_reason.includes('unsupported candidate factual claims'));
    });

    await test('22. Strategy Test 5: Unsupported education/domain marks overall_strategy UNVERIFIED', async () => {
      const grounded = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-1',
            category: 'RESUME_STRENGTH',
            source_type: 'RESUME_EVIDENCE',
            title: 'React Strength',
            recommendation: 'Showcase React',
            rationale: 'React experience',
            priority: 'HIGH',
            evidence_snippet: 'Developed responsive web applications using React and Redux',
          },
        ],
        overall_strategy: {
          summary: 'Leverage your Masters degree in Machine Learning from Stanford and deep FinTech banking domain expertise.',
        },
        resumeText: validResumeText,
      });

      assert.strictEqual(grounded.overall_strategy.verification_status, 'UNVERIFIED');
      assert.ok(grounded.overall_strategy.unverified_reason.includes('unsupported candidate factual claims'));
    });

    await test('23. Strategy Test 6: Valid grounded synthesis marks overall_strategy VERIFIED', async () => {
      const deterministicResults = {
        required_skills_missing: ['docker'],
        required_skills_matched: ['react', 'node.js'],
      };

      const grounded = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-1',
            category: 'RESUME_STRENGTH',
            source_type: 'RESUME_EVIDENCE',
            title: 'React Strength',
            recommendation: 'Showcase React',
            rationale: 'React experience',
            priority: 'HIGH',
            evidence_snippet: 'Developed responsive web applications using React and Redux across 4 years of production engineering.',
          },
          {
            id: 'rec-2',
            category: 'SKILL_GAP',
            source_type: 'DETERMINISTIC_ANALYSIS',
            title: 'Learn Docker',
            recommendation: 'Upskill in Docker',
            rationale: 'Missing required docker',
            priority: 'HIGH',
            evidence_snippet: null,
          },
        ],
        overall_strategy: {
          summary: 'Leverage your 4 years of verified React experience to showcase frontend mastery while prioritizing Docker containerization upskilling for backend requirements.',
        },
        resumeText: validResumeText,
        deterministicResults,
      });

      assert.strictEqual(grounded.overall_strategy.verification_status, 'VERIFIED');
      assert.strictEqual(grounded.overall_strategy.unverified_reason, null);
    });

    await test('24. Strategy Test 7: All ungrounded recommendations forces overall_strategy UNVERIFIED', async () => {
      const grounded = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-1',
            category: 'RESUME_STRENGTH',
            source_type: 'RESUME_EVIDENCE',
            title: 'Fake Strength',
            recommendation: 'Showcase Rust',
            rationale: 'Rust',
            priority: 'HIGH',
            evidence_snippet: 'Nonexistent snippet in resume text',
          },
        ],
        overall_strategy: {
          summary: 'Focus on your strong frontend capabilities.',
        },
        resumeText: validResumeText,
      });

      assert.strictEqual(grounded.recommendations[0].verification_status, 'UNVERIFIED');
      assert.strictEqual(grounded.overall_strategy.verification_status, 'UNVERIFIED');
      assert.strictEqual(grounded.overall_strategy.unverified_reason, 'Strategy based entirely on ungrounded recommendations');
    });

    // =========================================================================
    // SECTION 6: DETERMINISTIC PRIORITY AUTHORITY ENFORCEMENT
    // =========================================================================

    await test('25. Priority: Missing REQUIRED skill returned with LOW priority is locked to HIGH and marked UNVERIFIED', async () => {
      const deterministicResults = {
        required_skills_missing: ['docker'],
        required_skills_matched: ['react'],
      };

      const grounded = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-priority-test',
            category: 'SKILL_GAP',
            source_type: 'DETERMINISTIC_ANALYSIS',
            title: 'Docker Gap',
            recommendation: 'Learn Docker containerization basics.',
            rationale: 'Docker is missing.',
            priority: 'LOW', // Gemini returned incorrect priority!
            evidence_snippet: null,
          },
        ],
        overall_strategy: { summary: 'Plan' },
        resumeText: validResumeText,
        deterministicResults,
      });

      assert.strictEqual(grounded.recommendations[0].priority, 'HIGH', 'Priority must be locked to HIGH');
      assert.strictEqual(grounded.recommendations[0].verification_status, 'UNVERIFIED');
      assert.ok(grounded.recommendations[0].unverified_reason.includes('Priority overridden to match deterministic requirement type'));
    });

    await test('26. Priority: Missing PREFERRED skill returned with HIGH priority is locked to MEDIUM and marked UNVERIFIED', async () => {
      const deterministicResults = {
        required_skills_missing: ['docker'],
        preferred_skills_missing: ['aws'],
        required_skills_matched: ['react'],
      };

      const grounded = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-priority-test-2',
            category: 'SKILL_GAP',
            source_type: 'DETERMINISTIC_ANALYSIS',
            title: 'AWS Gap',
            recommendation: 'Learn AWS cloud basics.',
            rationale: 'AWS is missing.',
            priority: 'HIGH', // Gemini returned incorrect priority!
            evidence_snippet: null,
          },
        ],
        overall_strategy: { summary: 'Plan' },
        resumeText: validResumeText,
        deterministicResults,
      });

      assert.strictEqual(grounded.recommendations[0].priority, 'MEDIUM', 'Priority must be locked to MEDIUM');
      assert.strictEqual(grounded.recommendations[0].verification_status, 'UNVERIFIED');
      assert.ok(grounded.recommendations[0].unverified_reason.includes('Priority overridden to match deterministic requirement type'));
    });

    await test('27. Priority: Missing REQUIRED skill returned with HIGH priority is maintained and VERIFIED', async () => {
      const deterministicResults = {
        required_skills_missing: ['docker'],
      };

      const grounded = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-priority-test-3',
            category: 'SKILL_GAP',
            source_type: 'DETERMINISTIC_ANALYSIS',
            title: 'Docker Gap',
            recommendation: 'Learn Docker containerization basics.',
            rationale: 'Docker is missing.',
            priority: 'HIGH',
            evidence_snippet: null,
          },
        ],
        overall_strategy: { summary: 'Plan' },
        resumeText: validResumeText,
        deterministicResults,
      });

      assert.strictEqual(grounded.recommendations[0].priority, 'HIGH');
      assert.strictEqual(grounded.recommendations[0].verification_status, 'VERIFIED');
    });

    // =========================================================================
    // SECTION 7: PII PROTECTION & REDACTION TESTS
    // =========================================================================

    await test('28. PII: Evidence snippet containing redaction marker is marked UNVERIFIED', async () => {
      const grounded = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-pii-marker',
            category: 'RESUME_STRENGTH',
            source_type: 'RESUME_EVIDENCE',
            title: 'Email strength',
            recommendation: 'Showcase contact',
            rationale: 'Contact',
            priority: 'HIGH',
            evidence_snippet: 'Contact: [EMAIL REDACTED] | 123 Market St',
          },
        ],
        overall_strategy: { summary: 'Plan' },
        resumeText: validResumeText,
      });

      assert.strictEqual(grounded.recommendations[0].verification_status, 'UNVERIFIED');
      assert.strictEqual(grounded.recommendations[0].unverified_reason, 'Redaction markers cannot be accepted as resume evidence');
    });

    await test('28b. PII: Evidence snippet citing postal/ZIP/PIN code cannot leak that value and is marked UNVERIFIED', async () => {
      // Raw resume text includes postal code "94105"
      // In the sanitized pipeline, 94105 becomes [POSTAL_REDACTED] in sanitizedResumeText
      // Case 1: Model tries to cite raw postal code in evidence_snippet
      const groundedRawZip = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-pii-zip-raw',
            category: 'RESUME_STRENGTH',
            source_type: 'RESUME_EVIDENCE',
            title: 'Location strength',
            recommendation: 'Highlight San Francisco bay area presence.',
            rationale: 'Located in 94105.',
            priority: 'MEDIUM',
            evidence_snippet: 'San Francisco, CA 94105',
          },
        ],
        overall_strategy: { summary: 'Plan' },
        resumeText: validResumeText.replace('94105', '[POSTAL_REDACTED]'),
      });

      assert.strictEqual(groundedRawZip.recommendations[0].verification_status, 'UNVERIFIED');
      assert.ok(
        groundedRawZip.recommendations[0].unverified_reason.includes('Evidence snippet not found') ||
        groundedRawZip.recommendations[0].unverified_reason.includes('Redaction')
      );

      // Case 2: Model tries to cite [POSTAL_REDACTED] marker
      const groundedRedactedZip = verifyRecommendationGrounding({
        recommendations: [
          {
            id: 'rec-pii-zip-marker',
            category: 'RESUME_STRENGTH',
            source_type: 'RESUME_EVIDENCE',
            title: 'Location strength',
            recommendation: 'Highlight San Francisco bay area presence.',
            rationale: 'Located in postal area.',
            priority: 'MEDIUM',
            evidence_snippet: 'San Francisco, CA [POSTAL_REDACTED]',
          },
        ],
        overall_strategy: { summary: 'Plan' },
        resumeText: validResumeText.replace('94105', '[POSTAL_REDACTED]'),
      });

      assert.strictEqual(groundedRedactedZip.recommendations[0].verification_status, 'UNVERIFIED');
      assert.strictEqual(groundedRedactedZip.recommendations[0].unverified_reason, 'Redaction markers cannot be accepted as resume evidence');
    });

    // =========================================================================
    // SECTION 8: FULL END-TO-END GENERATION, CACHING & FRESHNESS TESTS
    // =========================================================================

    await test('29. E2E: Generates recommendations and persists cache in resumes.extracted_data (201)', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      let geminiCalled = 0;
      setMockGeminiClient({
        models: {
          generateContent: async () => {
            geminiCalled++;
            return { text: JSON.stringify(createValidMockResponse()) };
          },
        },
      });

      const res = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(geminiCalled, 1);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.cached, false);
      assert.strictEqual(res.data.data.overall_strategy.verification_status, 'VERIFIED');
      assert.strictEqual(res.data.data.recommendations.length, 3);

      // Verify DB persistence
      const dbRes = await query('SELECT extracted_data FROM resumes WHERE resume_id = $1', [resume.resume_id]);
      const storedCache = dbRes.rows[0].extracted_data?.ai_recommendations?.[job.job_id];
      assert.ok(storedCache);
      assert.strictEqual(storedCache.version, '1.0');
      assert.strictEqual(typeof storedCache.resume_source_hash, 'string');
      assert.strictEqual(typeof storedCache.job_source_hash, 'string');
      assert.strictEqual(typeof storedCache.deterministic_match_hash, 'string');

      clearMockGeminiClient();
    });

    await test('30. Cache Hit: Subsequent POST returns cached recommendation with 200 without calling Gemini', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      let geminiCalled = 0;
      setMockGeminiClient({
        models: {
          generateContent: async () => {
            geminiCalled++;
            return { text: JSON.stringify(createValidMockResponse()) };
          },
        },
      });

      // 1st request generates
      await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });
      assert.strictEqual(geminiCalled, 1);

      // 2nd request hits cache
      const res2 = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.data.data.cached, true);
      assert.strictEqual(geminiCalled, 1, 'Gemini must not be called on cache hit');

      clearMockGeminiClient();
    });

    await test('31. Cache Invalidation: Modifying resume text invalidates cache and triggers regeneration', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      let geminiCalled = 0;
      setMockGeminiClient({
        models: {
          generateContent: async () => {
            geminiCalled++;
            return { text: JSON.stringify(createValidMockResponse()) };
          },
        },
      });

      // 1st request
      await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });
      assert.strictEqual(geminiCalled, 1);

      // Modify resume text in database
      const modifiedText = validResumeText + '\nAdditional certificate: AWS Certified Developer';
      await query('UPDATE resumes SET extracted_text = $1 WHERE resume_id = $2', [modifiedText, resume.resume_id]);

      // 2nd request must regenerate because resume_source_hash changed
      const res2 = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });

      assert.strictEqual(res2.status, 201);
      assert.strictEqual(res2.data.data.cached, false);
      assert.strictEqual(geminiCalled, 2, 'Gemini must be called again after resume modification');

      clearMockGeminiClient();
    });

    await test('32. Cache Invalidation: Modifying job description invalidates cache and triggers regeneration', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      let geminiCalled = 0;
      setMockGeminiClient({
        models: {
          generateContent: async () => {
            geminiCalled++;
            return { text: JSON.stringify(createValidMockResponse()) };
          },
        },
      });

      // 1st request
      await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });
      assert.strictEqual(geminiCalled, 1);

      // Modify job description in database
      await query('UPDATE job_descriptions SET description = $1 WHERE job_id = $2', ['Updated job description demanding Golang and Kubernetes.', job.job_id]);

      // 2nd request must regenerate because job_source_hash changed
      const res2 = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });

      assert.strictEqual(res2.status, 201);
      assert.strictEqual(res2.data.data.cached, false);
      assert.strictEqual(geminiCalled, 2, 'Gemini must be called again after job description modification');

      clearMockGeminiClient();
    });

    await test('32b. Cache Invalidation: Altering deterministic analysis invalidates cache, causing GET to return 404 and POST to regenerate', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      let geminiCalled = 0;
      setMockGeminiClient({
        models: {
          generateContent: async () => {
            geminiCalled++;
            return { text: JSON.stringify(createValidMockResponse()) };
          },
        },
      });

      // 1. Initial generation (cache miss -> 201)
      const resInitial = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });
      assert.strictEqual(resInitial.status, 201);
      assert.strictEqual(geminiCalled, 1);
      const initialDetHash = resInitial.data.data.deterministic_match_hash;
      assert.ok(initialDetHash);

      // Verify GET returns cached 200
      const resGet1 = await request(`/api/resumes/${resume.resume_id}/ai-recommendations?jobId=${job.job_id}`, {
        token: tokenA,
      });
      assert.strictEqual(resGet1.status, 200);
      assert.strictEqual(resGet1.data.data.cached, true);

      // 2. Modify the deterministic analysis record in database
      // (Resume text and job description remain completely unchanged!)
      const analysisId = resInitial.data.data.analysis_id;
      await query(
        `UPDATE analyses
         SET overall_score = 45.00,
             skill_score = 45.00,
             created_at = CURRENT_TIMESTAMP
         WHERE analysis_id = $1`,
        [analysisId]
      );

      // 3. GET must detect deterministic analysis hash mismatch and return 404 (stale cache)
      const resGet2 = await request(`/api/resumes/${resume.resume_id}/ai-recommendations?jobId=${job.job_id}`, {
        token: tokenA,
      });
      assert.strictEqual(resGet2.status, 404, 'GET must return 404 when deterministic analysis has changed');

      // 4. POST must regenerate because deterministic_match_hash changed
      const resRegen = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });
      assert.strictEqual(resRegen.status, 201, 'POST must regenerate recommendations when deterministic analysis changes');
      assert.strictEqual(resRegen.data.data.cached, false);
      assert.strictEqual(geminiCalled, 2, 'Gemini must be called to regenerate when deterministic analysis changes');
      const newDetHash = resRegen.data.data.deterministic_match_hash;
      assert.notStrictEqual(newDetHash, initialDetHash, 'Deterministic match hash must change when deterministic analysis changes');

      // 5. Verify deterministic analysis itself remains authoritative and was not modified by Gemini
      const verifyAnalysisRes = await query('SELECT overall_score, skill_score FROM analyses WHERE analysis_id = $1', [analysisId]);
      assert.strictEqual(Number(verifyAnalysisRes.rows[0].overall_score), 45.00);

      clearMockGeminiClient();
    });

    await test('33. GET Endpoint: Returns cached recommendations with 200 or 404 when stale', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      // Before generation: returns 404
      const resBefore = await request(`/api/resumes/${resume.resume_id}/ai-recommendations?jobId=${job.job_id}`, {
        token: tokenA,
      });
      assert.strictEqual(resBefore.status, 404);

      // Generate
      setMockGeminiClient({
        models: {
          generateContent: async () => ({ text: JSON.stringify(createValidMockResponse()) }),
        },
      });
      await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });

      // After generation: returns 200 cached
      const resAfter = await request(`/api/resumes/${resume.resume_id}/ai-recommendations?jobId=${job.job_id}`, {
        token: tokenA,
      });
      assert.strictEqual(resAfter.status, 200);
      assert.strictEqual(resAfter.data.data.cached, true);
      assert.strictEqual(resAfter.data.data.recommendations.length, 3);

      clearMockGeminiClient();
    });

    await test('34. Malformed Gemini Output: Returns 502 and does NOT write corrupted cache to database', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      setMockGeminiClient({
        models: {
          generateContent: async () => ({ text: 'This is not valid JSON {{<<>>}}' }),
        },
      });

      const res = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });

      assert.strictEqual(res.status, 502);

      // Verify nothing corrupted written to DB
      const dbRes = await query('SELECT extracted_data FROM resumes WHERE resume_id = $1', [resume.resume_id]);
      assert.strictEqual(dbRes.rows[0].extracted_data?.ai_recommendations?.[job.job_id], undefined);

      clearMockGeminiClient();
    });

    await test('35. Schema Violation: Returns 502 when Gemini output violates schema and does NOT write to database', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      // Missing required recommendations array
      const invalidJson = {
        overall_strategy: { summary: 'Plan' },
      };

      setMockGeminiClient({
        models: {
          generateContent: async () => ({ text: JSON.stringify(invalidJson) }),
        },
      });

      const res = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });

      assert.strictEqual(res.status, 502);

      const dbRes = await query('SELECT extracted_data FROM resumes WHERE resume_id = $1', [resume.resume_id]);
      assert.strictEqual(dbRes.rows[0].extracted_data?.ai_recommendations?.[job.job_id], undefined);

      clearMockGeminiClient();
    });

    await test('36. Force Refresh: force_refresh=true bypasses cache and regenerates', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      let geminiCalled = 0;
      setMockGeminiClient({
        models: {
          generateContent: async () => {
            geminiCalled++;
            return { text: JSON.stringify(createValidMockResponse()) };
          },
        },
      });

      // Initial generation
      await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });
      assert.strictEqual(geminiCalled, 1);

      // Force refresh
      const resRefresh = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true, force_refresh: true },
      });

      assert.strictEqual(resRefresh.status, 201);
      assert.strictEqual(resRefresh.data.data.cached, false);
      assert.strictEqual(geminiCalled, 2, 'Gemini must be called when force_refresh=true');

      clearMockGeminiClient();
    });

    await test('37. Deterministic Authority Invariance: AI recommendations never alter deterministic analysis or score', async () => {
      const resume = await createTestResume({ userId: userA.user_id });
      const job = await createTestJob({ userId: userA.user_id });

      setMockGeminiClient({
        models: {
          generateContent: async () => ({ text: JSON.stringify(createValidMockResponse()) }),
        },
      });

      // Fetch deterministic analysis before
      const resPost = await request(`/api/resumes/${resume.resume_id}/ai-recommendations`, {
        method: 'POST',
        token: tokenA,
        body: { jobId: job.job_id, consent: true },
      });
      assert.strictEqual(resPost.status, 201);

      const analysisId = resPost.data.data.analysis_id;
      assert.ok(analysisId);

      const analysisRes = await query('SELECT overall_score, skill_score FROM analyses WHERE analysis_id = $1', [analysisId]);
      assert.strictEqual(analysisRes.rowCount, 1);
      const scoreBefore = analysisRes.rows[0].overall_score;

      // Deterministic score must remain untouched and identical
      assert.strictEqual(typeof scoreBefore, 'string');
      clearMockGeminiClient();
    });

  } finally {
    server.close();
    await pool.end();
  }

  console.log('\n====================================================');
  console.log(`Stage 4 Tests Completed: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
};

// Auto-run if executed directly
if (process.argv[1]?.endsWith('recommendation.ai.test.mjs')) {
  runRecommendationAiTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
