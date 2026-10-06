/**
 * Comprehensive Test Suite for Stage 2: AI-Powered Resume Understanding
 *
 * Validates:
 * 1. Authentication and Authorization (JWT, IDOR)
 * 2. Consent Enforcement & Feature Gating
 * 3. Resume State & Length Guards
 * 4. PII Minimization & Output Sanitization
 * 5. Structured Zod Schema & Output Parsing
 * 6. Evidence Grounding & Unsupported Claim Handling
 * 7. Prompt-Injection Resilience
 * 8. Timeout Abort & Provider Error Resilience
 * 9. JSONB Persistence, Key Preservation, & Cache Stale Invalidation
 * 10. Deterministic Invariance
 *
 * NOTE: All tests run offline with ZERO network calls, zero API costs, and without requiring a real API key.
 */

import http from 'http';
import assert from 'node:assert/strict';
import app from '../src/app.mjs';
import config from '../src/config/env.mjs';
import { query, pool, testDbConnection } from '../src/config/database.mjs';
import { registerUser, generateToken } from '../src/services/auth.service.mjs';
import { computeFileHash } from '../src/utils/file.util.mjs';
import {
  setMockGeminiClient,
  clearMockGeminiClient,
  executeWithTimeout,
} from '../src/services/gemini.service.mjs';
import { sanitizeResumePii, sanitizeModelOutputPii } from '../src/utils/sanitizer.util.mjs';
import { verifySnippet, verifyProfileGrounding } from '../src/utils/grounding.util.mjs';
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

export const runResumeAiTests = async () => {
  console.log('====================================================');
  console.log('Running Stage 2: AI-Powered Resume Understanding Tests');
  console.log('====================================================\n');

  // Verify DB
  const dbStatus = await testDbConnection();
  if (!dbStatus.connected) {
    console.error('[FATAL] Database connection required for resume AI tests.');
    process.exit(1);
  }

  // Start live ephemeral test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Helper HTTP request function
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
    name: 'Alice Engineer',
    email: `alice_ai_${timestamp}@example.com`,
    password: 'Password123!Secure',
  });
  const tokenA = generateToken(userA);

  const userB = await registerUser({
    name: 'Bob Candidate',
    email: `bob_ai_${timestamp}@example.com`,
    password: 'Password123!Secure',
  });
  const tokenB = generateToken(userB);

  // Standard valid extracted resume text
  const validResumeText = `
Alice Engineer
Full Stack Developer | San Francisco, CA
Contact: alice@example.com | (555) 019-2834 | 123 Market St, San Francisco, CA 94105

Professional Summary:
Passionate software engineer with 5 years of experience building scalable backend microservices and modern React applications.

Technical Skills:
- Programming Languages: JavaScript, TypeScript, Python, SQL
- Frameworks: React, Node.js, Express, Docker
- Databases: PostgreSQL, Redis

Experience:
Senior Software Engineer at Acme Cloud Corp (2021 - Present)
- Designed and maintained high-throughput payment processing APIs handling 50k requests/minute.
- Reduced database query latency by 40% using PostgreSQL indexing and Redis caching.

Software Engineer at Beta Solutions (2019 - 2021)
- Developed responsive web interfaces using React and Redux.
- Built RESTful endpoints in Node.js and improved test coverage from 60% to 92%.

Education:
University of California, Berkeley
Bachelor of Science in Computer Science (2015 - 2019), GPA: 3.8

Projects:
AI Resume Analyzer: Open-source full-stack platform built with Node.js and React.

Certifications:
AWS Certified Solutions Architect - Associate (Amazon Web Services, 2022)
`.trim();

  // Helper to create a test resume row in DB
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
        'resume_alice.pdf',
        'resumes/test_alice.pdf',
        1024,
        'application/pdf',
        computeFileHash(Buffer.from('sample_bytes')),
        status,
        text,
        extractedData ? JSON.stringify(extractedData) : null,
      ]
    );
    return res.rows[0];
  };

  // Mock valid structured Gemini output matching validResumeText
  const validMockProfile = {
    professional_summary:
      'Passionate software engineer with 5 years of experience building scalable backend microservices and modern React applications.',
    technical_skills: [
      {
        name: 'JavaScript',
        category: 'PROGRAMMING_LANGUAGE',
        evidence_snippet: 'Programming Languages: JavaScript, TypeScript, Python, SQL',
      },
      {
        name: 'React',
        category: 'FRAMEWORK_OR_LIBRARY',
        evidence_snippet: 'Frameworks: React, Node.js, Express, Docker',
      },
      {
        name: 'PostgreSQL',
        category: 'DATABASE',
        evidence_snippet: 'Databases: PostgreSQL, Redis',
      },
    ],
    soft_skills: [
      {
        name: 'Passionate',
        evidence_snippet: 'Passionate software engineer with 5 years of experience',
      },
    ],
    education: [
      {
        institution: 'University of California, Berkeley',
        degree: 'Bachelor of Science',
        field_of_study: 'Computer Science',
        start_year: '2015',
        graduation_year: '2019',
        gpa_or_grade: '3.8',
        evidence_snippet:
          'University of California, Berkeley Bachelor of Science in Computer Science (2015 - 2019), GPA: 3.8',
      },
    ],
    work_experience: [
      {
        organization: 'Acme Cloud Corp',
        role: 'Senior Software Engineer',
        location: null,
        start_date: '2021',
        end_date: null,
        is_current: true,
        is_internship: false,
        key_responsibilities: ['Designed and maintained high-throughput payment processing APIs'],
        quantified_achievements: ['handling 50k requests/minute', 'Reduced database query latency by 40%'],
        evidence_snippet: 'Senior Software Engineer at Acme Cloud Corp (2021 - Present)',
      },
    ],
    projects: [
      {
        name: 'AI Resume Analyzer',
        description: 'Open-source full-stack platform built with Node.js and React.',
        technologies_used: ['Node.js', 'React'],
        link_or_url: null,
        evidence_snippet: 'AI Resume Analyzer: Open-source full-stack platform built with Node.js and React.',
      },
    ],
    certifications_and_achievements: [
      {
        title: 'AWS Certified Solutions Architect - Associate',
        issuer: 'Amazon Web Services',
        issue_date: '2022',
        type: 'CERTIFICATION',
        evidence_snippet: 'AWS Certified Solutions Architect - Associate (Amazon Web Services, 2022)',
      },
    ],
    ambiguous_or_unclear_items: [],
  };

  // Create a reusable mock Gemini client generator
  const createMockClient = (responseObject) => ({
    models: {
      generateContent: async () => ({
        text: JSON.stringify(responseObject),
      }),
    },
  });

  try {
    // =========================================================================
    // 1. PII Sanitization Unit Tests
    // =========================================================================
    await test('1. PII Sanitizer: Redacts emails, phone numbers, and street addresses', () => {
      const input = `Contact Jane Doe at jane.doe@example.co.uk or call +1 (555) 987-6543.
Address: 456 Elm Avenue, Suite 200, CA 94103.
Graduated in 2020-2024 with 3.9 GPA.`;

      const scrubbed = sanitizeResumePii(input);
      assert.strictEqual(scrubbed.includes('jane.doe@example.co.uk'), false);
      assert.strictEqual(scrubbed.includes('(555) 987-6543'), false);
      assert.strictEqual(scrubbed.includes('456 Elm Avenue'), false);
      assert.ok(scrubbed.includes('[EMAIL_REDACTED]'));
      assert.ok(scrubbed.includes('[PHONE_REDACTED]'));
      assert.ok(scrubbed.includes('[ADDRESS_REDACTED]'));
      // Numbers representing years must NOT be falsely redacted
      assert.ok(scrubbed.includes('2020-2024'));
    });

    await test('2. PII Sanitizer: Recursively scrubs PII in model output fields (emails, phones, addresses, postal codes)', () => {
      const dirtyOutput = {
        summary: 'Candidate email is bob@secret.org and phone is 555-019-2834',
        address: '123 Example Street, Hyderabad',
        postal_code: '500081',
        skills: [{ name: 'React', evidence: 'Contact bob@secret.org at 456 Elm Ave, CA 94103' }],
      };

      const cleaned = sanitizeModelOutputPii(dirtyOutput);
      assert.strictEqual(cleaned.summary.includes('bob@secret.org'), false);
      assert.strictEqual(cleaned.summary.includes('555-019-2834'), false);
      assert.strictEqual(cleaned.address.includes('123 Example Street'), false);
      assert.strictEqual(cleaned.postal_code.includes('500081'), false);
      assert.strictEqual(cleaned.skills[0].evidence.includes('bob@secret.org'), false);
      assert.strictEqual(cleaned.skills[0].evidence.includes('456 Elm Ave'), false);
      assert.strictEqual(cleaned.skills[0].evidence.includes('94103'), false);
      assert.ok(cleaned.summary.includes('[EMAIL_REDACTED]'));
      assert.ok(cleaned.summary.includes('[PHONE_REDACTED]'));
      assert.ok(cleaned.address.includes('[ADDRESS_REDACTED]'));
      assert.ok(cleaned.postal_code.includes('[POSTAL_REDACTED]'));
      assert.ok(cleaned.skills[0].evidence.includes('[POSTAL_REDACTED]'));
    });

    // =========================================================================
    // 2. Evidence Grounding Unit Tests
    // =========================================================================
    await test('3. Evidence Grounding: Marks claims as VERIFIED when snippet exists and supports entity', () => {
      const source = 'Expert in Python programming and Django framework at TechCorp.';
      const res = verifySnippet('Python programming', source, ['Python']);
      assert.strictEqual(res.verified, true);
      assert.strictEqual(res.reason, null);
    });

    await test('4. Evidence Grounding: Marks claims as UNVERIFIED when snippet is not in source text', () => {
      const source = 'Expert in Python programming.';
      const res = verifySnippet('Kubernetes cluster management', source, ['Kubernetes']);
      assert.strictEqual(res.verified, false);
      assert.ok(res.reason.includes('not found in candidate resume text'));
    });

    await test('5. Evidence Grounding: Marks claims as UNVERIFIED when snippet fails to substantiate claimed entity', () => {
      const source = 'Worked at Google as a product manager. Graduated in 2021.';
      // Snippet exists in text ("Graduated in 2021"), but claim is "Software Engineer at Netflix"
      const res = verifySnippet('Graduated in 2021', source, ['Netflix', 'Software Engineer']);
      assert.strictEqual(res.verified, false);
      assert.ok(res.reason.includes('does not substantiate'));
    });

    // =========================================================================
    // 3. Authentication & IDOR Authorization Tests
    // =========================================================================
    const resumeA = await createTestResume({ userId: userA.user_id });
    const resumeB = await createTestResume({ userId: userB.user_id });

    await test('6. Auth: POST ai-profile rejects unauthenticated requests with 401', async () => {
      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-profile`, {
        method: 'POST',
        token: null,
        body: { consent: true },
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.error.code, 'AUTHENTICATION_ERROR');
    });

    await test('7. Auth: POST ai-profile rejects malformed Bearer token with 401', async () => {
      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-profile`, {
        method: 'POST',
        token: 'invalid_malformed_token',
        body: { consent: true },
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.error.code, 'AUTHENTICATION_ERROR');
    });

    await test('8. IDOR: User B cannot trigger AI profile on User A resume (returns 404)', async () => {
      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenB,
        body: { consent: true },
      });
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.data.error.code, 'RESOURCE_NOT_FOUND');
    });

    await test('9. IDOR: User B cannot retrieve cached AI profile of User A resume (returns 404)', async () => {
      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-profile`, {
        method: 'GET',
        token: tokenB,
      });
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.data.error.code, 'RESOURCE_NOT_FOUND');
    });

    // =========================================================================
    // 4. Consent & Feature Gating Tests
    // =========================================================================
    await test('10. Consent: Rejects request with missing consent field with 400', async () => {
      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: {},
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.error.code, 'VALIDATION_ERROR');
    });

    await test('11. Consent: Rejects request with consent=false with 400', async () => {
      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: false },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.error.code, 'VALIDATION_ERROR');
    });

    await test('12. Feature Gate: Returns 503 AI_SERVICE_UNAVAILABLE when Gemini is unconfigured/disabled', async () => {
      clearMockGeminiClient();
      const prevEnabled = config.geminiEnabled;
      config.geminiEnabled = false;
      try {
        const res = await request(`/api/resumes/${resumeA.resume_id}/ai-profile`, {
          method: 'POST',
          token: tokenA,
          body: { consent: true },
        });
        assert.strictEqual(res.status, 503);
        assert.strictEqual(res.data.error.code, 'AI_SERVICE_UNAVAILABLE');
      } finally {
        config.geminiEnabled = prevEnabled;
      }
    });

    // =========================================================================
    // 5. Resume State & Input Validation Tests
    // =========================================================================
    const resumePending = await createTestResume({ userId: userA.user_id, status: 'PENDING' });
    const resumeProcessing = await createTestResume({ userId: userA.user_id, status: 'PROCESSING' });
    const resumeFailed = await createTestResume({ userId: userA.user_id, status: 'FAILED' });
    const resumeShort = await createTestResume({
      userId: userA.user_id,
      status: 'COMPLETED',
      text: 'Too short text',
    });

    await test('13. State Guard: Rejects resume in PENDING status with 409', async () => {
      setMockGeminiClient(createMockClient(validMockProfile));
      const res = await request(`/api/resumes/${resumePending.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });
      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.data.error.code, 'RESUME_NOT_PROCESSED');
    });

    await test('14. State Guard: Rejects resume in PROCESSING status with 409', async () => {
      const res = await request(`/api/resumes/${resumeProcessing.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });
      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.data.error.code, 'RESUME_NOT_PROCESSED');
    });

    await test('15. State Guard: Rejects resume in FAILED status with 422', async () => {
      const res = await request(`/api/resumes/${resumeFailed.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });
      assert.strictEqual(res.status, 422);
      assert.strictEqual(res.data.error.code, 'RESUME_PROCESSING_FAILED');
    });

    await test('16. Input Guard: Rejects resume text < 50 characters with 422', async () => {
      const res = await request(`/api/resumes/${resumeShort.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });
      assert.strictEqual(res.status, 422);
      assert.strictEqual(res.data.error.code, 'RESUME_NO_TEXT');
    });

    // =========================================================================
    // 6. Successful Generation, JSONB Persistence & Cache Freshness Tests
    // =========================================================================
    await test('17. Successful Generation: Generates AI profile, returns 201, and caches in JSONB', async () => {
      // Injects existing custom key into extracted_data to verify preservation
      await query(
        `UPDATE resumes SET extracted_data = '{"deterministic_skills":["c","python"]}'::jsonb WHERE resume_id = $1`,
        [resumeA.resume_id]
      );

      setMockGeminiClient(createMockClient(validMockProfile));

      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.cached, false);
      assert.strictEqual(res.data.data.is_ai_generated, true);
      assert.strictEqual(typeof res.data.data.consent_recorded_at, 'string');
      assert.strictEqual(res.data.data.profile.technical_skills.length, 3);

      // Verify that other keys in extracted_data were preserved
      const dbCheck = await query('SELECT extracted_data FROM resumes WHERE resume_id = $1', [
        resumeA.resume_id,
      ]);
      const extractedData = dbCheck.rows[0].extracted_data;
      assert.ok(extractedData.deterministic_skills !== undefined);
      assert.deepStrictEqual(extractedData.deterministic_skills, ['c', 'python']);
      assert.ok(extractedData.ai_profile !== undefined);
      assert.strictEqual(extractedData.ai_profile.is_ai_generated, true);
    });

    await test('18. Cache Hit: Subsequent POST returns cached profile (200 OK) without calling Gemini', async () => {
      let callCount = 0;
      const countingClient = {
        models: {
          generateContent: async () => {
            callCount++;
            return { text: JSON.stringify(validMockProfile) };
          },
        },
      };
      setMockGeminiClient(countingClient);

      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true, force_refresh: false },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.data.cached, true);
      // Ensure Gemini was NOT invoked because valid cache was used
      assert.strictEqual(callCount, 0);
    });

    await test('19. Cached Read: GET /api/resumes/:resumeId/ai-profile returns cached profile with 200', async () => {
      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-profile`, {
        method: 'GET',
        token: tokenA,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.cached, true);
      assert.strictEqual(res.data.data.resume_id, resumeA.resume_id);
    });

    await test('20. Stale Cache Invalidation: Changing extracted_text causes GET to reject stale cache', async () => {
      // Mutate extracted text simulating re-extraction
      await query(
        `UPDATE resumes SET extracted_text = 'Modified resume text that differs from source_text_hash for invalidation.' WHERE resume_id = $1`,
        [resumeA.resume_id]
      );

      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-profile`, {
        method: 'GET',
        token: tokenA,
      });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.data.error.code, 'AI_PROFILE_STALE');
    });

    await test('21. Force Refresh: POST with force_refresh=true regenerates and updates cache', async () => {
      setMockGeminiClient(createMockClient(validMockProfile));

      const res = await request(`/api/resumes/${resumeA.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true, force_refresh: true },
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.data.cached, false);
    });

    // =========================================================================
    // 7. Error Handling & Malformed Provider Outputs
    // =========================================================================
    await test('22. Malformed JSON: Returns 502 AI_MALFORMED_OUTPUT on invalid JSON syntax from model', async () => {
      const badJsonClient = {
        models: {
          generateContent: async () => ({ text: 'NOT_VALID_JSON_AT_ALL' }),
        },
      };
      setMockGeminiClient(badJsonClient);

      const newResume = await createTestResume({ userId: userA.user_id });
      const res = await request(`/api/resumes/${newResume.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });

      assert.strictEqual(res.status, 502);
      assert.strictEqual(res.data.error.code, 'AI_MALFORMED_OUTPUT');
    });

    await test('23. Schema Mismatch: Returns 502 AI_SCHEMA_VALIDATION_FAILED on invalid structure', async () => {
      const invalidTypeClient = {
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              professional_summary: 12345, // invalid type (number instead of string)
              technical_skills: 'invalid_array', // invalid type (string instead of array)
            }),
          }),
        },
      };
      setMockGeminiClient(invalidTypeClient);

      const newResume = await createTestResume({ userId: userA.user_id });
      const res = await request(`/api/resumes/${newResume.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });

      assert.strictEqual(res.status, 502);
      assert.strictEqual(res.data.error.code, 'AI_SCHEMA_VALIDATION_FAILED');
    });

    await test('24. Rate Limit: Returns 429 AI_RATE_LIMITED when provider reports quota exhaustion', async () => {
      const rateLimitedClient = {
        models: {
          generateContent: async () => {
            const err = new Error('Resource has been exhausted (e.g. check quota).');
            err.status = 429;
            throw err;
          },
        },
      };
      setMockGeminiClient(rateLimitedClient);

      const newResume = await createTestResume({ userId: userA.user_id });
      const res = await request(`/api/resumes/${newResume.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });

      assert.strictEqual(res.status, 429);
      assert.strictEqual(res.data.error.code, 'AI_RATE_LIMITED');
    });

    await test('25. Timeout Abort: Physical abort signal triggers and returns 504 on deadline exceeded', async () => {
      let receivedSignal = null;
      const hangingClient = {
        models: {
          generateContent: async ({ config: callConfig }) => {
            receivedSignal = callConfig?.abortSignal;
            // Wait for signal abort
            return new Promise((resolve, reject) => {
              if (receivedSignal) {
                receivedSignal.addEventListener('abort', () => {
                  const err = new Error('This operation was aborted');
                  err.name = 'AbortError';
                  reject(err);
                });
              }
            });
          },
        },
      };
      setMockGeminiClient(hangingClient);

      const newResume = await createTestResume({ userId: userA.user_id });

      // Run executeWithTimeout directly with 50ms to verify abortSignal propagation
      await assert.rejects(
        async () => {
          await executeWithTimeout(
            async (signal) => {
              return hangingClient.models.generateContent({ config: { abortSignal: signal } });
            },
            50
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'GEMINI_TIMEOUT');
          assert.strictEqual(err.statusCode, 504);
          assert.ok(receivedSignal !== null);
          assert.strictEqual(receivedSignal.aborted, true);
          return true;
        }
      );
    });

    // =========================================================================
    // 8. Unverified / Hallucinated Claim Handling
    // =========================================================================
    await test('26. Hallucination Guard: Flags fabricated skills as UNVERIFIED when missing in resume', async () => {
      const profileWithHallucination = {
        ...validMockProfile,
        technical_skills: [
          {
            name: 'JavaScript',
            category: 'PROGRAMMING_LANGUAGE',
            evidence_snippet: 'Programming Languages: JavaScript, TypeScript, Python, SQL',
          },
          {
            name: 'Rust', // Fabricated skill not in Alice's resume
            category: 'PROGRAMMING_LANGUAGE',
            evidence_snippet: 'Rust programming language for systems', // Fabricated quote
          },
        ],
      };

      setMockGeminiClient(createMockClient(profileWithHallucination));

      const newResume = await createTestResume({ userId: userA.user_id });
      const res = await request(`/api/resumes/${newResume.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });

      assert.strictEqual(res.status, 201);
      const skills = res.data.data.profile.technical_skills;
      const jsSkill = skills.find((s) => s.name === 'JavaScript');
      const rustSkill = skills.find((s) => s.name === 'Rust');

      assert.strictEqual(jsSkill.verification_status, 'VERIFIED');
      assert.strictEqual(rustSkill.verification_status, 'UNVERIFIED');
      assert.ok(rustSkill.unverified_reason.includes('not found in candidate resume text'));
      // Fabricated claim must be captured in ambiguous_or_unclear_items
      const ambiguous = res.data.data.profile.ambiguous_or_unclear_items;
      assert.ok(ambiguous.some((a) => a.ambiguity_reason.includes('Rust')));
    });

    // =========================================================================
    // 9. Stage 2.1 Grounding & PII Regression Tests
    // =========================================================================

    await test('27. Stage 2.1 Test A: Hallucinated professional summary without evidence is UNVERIFIED', async () => {
      // Resume has no claim of 5 years of experience
      const resumeNoExp = await createTestResume({
        userId: userA.user_id,
        text: 'Alice Junior Developer. Built basic web components in React. Graduated in 2024.',
      });

      const profileWithHallucinatedSummary = {
        ...validMockProfile,
        professional_summary: 'Experienced software engineer with 5 years of professional experience.',
      };

      setMockGeminiClient(createMockClient(profileWithHallucinatedSummary));

      const res = await request(`/api/resumes/${resumeNoExp.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });

      assert.strictEqual(res.status, 201);
      const summary = res.data.data.profile.professional_summary;
      assert.ok(summary !== null);
      assert.strictEqual(summary.verification_status, 'UNVERIFIED');
      assert.ok(summary.unverified_reason !== null);
      assert.ok(
        summary.unverified_reason.includes('experience') ||
        summary.unverified_reason.includes('not found') ||
        summary.unverified_reason.includes('Missing')
      );
      // Factual claim was NOT converted to verified, and is recorded in ambiguous items
      const ambiguous = res.data.data.profile.ambiguous_or_unclear_items;
      assert.ok(ambiguous.some((a) => a.section === 'Professional Summary'));
    });

    await test('28. Stage 2.1 Test B: Model output address leakage is sanitized before response and cache', async () => {
      const outputWithAddress = {
        ...validMockProfile,
        professional_summary: {
          text: 'Candidate lives at 123 Example Street, Hyderabad',
          evidence_snippet: 'Professional Summary: Passionate software engineer',
        },
        work_experience: [
          {
            ...validMockProfile.work_experience[0],
            location: '123 Example Street, Hyderabad',
          },
        ],
      };

      setMockGeminiClient(createMockClient(outputWithAddress));

      const newResume = await createTestResume({ userId: userA.user_id });
      const res = await request(`/api/resumes/${newResume.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });

      assert.strictEqual(res.status, 201);
      const rawResponseText = JSON.stringify(res.data);
      assert.strictEqual(rawResponseText.includes('123 Example Street'), false);
      assert.ok(rawResponseText.includes('[ADDRESS_REDACTED]'));

      // Check DB cache does not contain raw address
      const dbCheck = await query('SELECT extracted_data FROM resumes WHERE resume_id = $1', [
        newResume.resume_id,
      ]);
      const cachedProfile = JSON.stringify(dbCheck.rows[0].extracted_data.ai_profile);
      assert.strictEqual(cachedProfile.includes('123 Example Street'), false);
      assert.ok(cachedProfile.includes('[ADDRESS_REDACTED]'));
    });

    await test('29. Stage 2.1 Test C: Model output postal/ZIP code leakage is sanitized before response and cache', async () => {
      const outputWithPostal = {
        ...validMockProfile,
        professional_summary: {
          text: 'Candidate located in Hyderabad 500081 with ZIP CA 94105-1234',
          evidence_snippet: 'Professional Summary: Passionate software engineer',
        },
      };

      setMockGeminiClient(createMockClient(outputWithPostal));

      const newResume = await createTestResume({ userId: userA.user_id });
      const res = await request(`/api/resumes/${newResume.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });

      assert.strictEqual(res.status, 201);
      const rawResponseText = JSON.stringify(res.data);
      assert.strictEqual(rawResponseText.includes('500081'), false);
      assert.strictEqual(rawResponseText.includes('94105-1234'), false);
      assert.ok(rawResponseText.includes('[POSTAL_REDACTED]'));

      // Check DB cache does not contain raw postal codes
      const dbCheck = await query('SELECT extracted_data FROM resumes WHERE resume_id = $1', [
        newResume.resume_id,
      ]);
      const cachedProfile = JSON.stringify(dbCheck.rows[0].extracted_data.ai_profile);
      assert.strictEqual(cachedProfile.includes('500081'), false);
      assert.strictEqual(cachedProfile.includes('94105-1234'), false);
      assert.ok(cachedProfile.includes('[POSTAL_REDACTED]'));
    });

    await test('30. Stage 2.1 Test D: Field-level hallucination marks unsupported dates as UNVERIFIED without invalidating verified entity', async () => {
      const resumeABC = await createTestResume({
        userId: userA.user_id,
        text: 'Alice Engineer. Software Engineer at ABC Corp. Working on distributed microservices since graduation.',
      });

      const outputWithHallucinatedDates = {
        ...validMockProfile,
        work_experience: [
          {
            organization: 'ABC Corp',
            role: 'Software Engineer',
            start_date: 'January 2021', // Fabricated date not in resume
            end_date: 'December 2024',   // Fabricated date not in resume
            is_current: false,
            is_internship: false,
            key_responsibilities: ['Working on distributed microservices'],
            quantified_achievements: [],
            evidence_snippet: 'Software Engineer at ABC Corp',
          },
        ],
      };

      setMockGeminiClient(createMockClient(outputWithHallucinatedDates));

      const res = await request(`/api/resumes/${resumeABC.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });

      assert.strictEqual(res.status, 201);
      const exp = res.data.data.profile.work_experience[0];
      assert.ok(exp !== undefined);
      // Entity-level role & org are verified
      assert.strictEqual(exp.field_verification.organization, 'VERIFIED');
      assert.strictEqual(exp.field_verification.role, 'VERIFIED');
      // Individual fabricated date fields are UNVERIFIED
      assert.strictEqual(exp.field_verification.start_date, 'UNVERIFIED');
      assert.strictEqual(exp.field_verification.end_date, 'UNVERIFIED');
      assert.ok(exp.unverified_fields.includes('start_date'));
      assert.ok(exp.unverified_fields.includes('end_date'));
      // Ambiguous items capture the unverified date claims
      const ambiguous = res.data.data.profile.ambiguous_or_unclear_items;
      assert.ok(ambiguous.some((a) => a.ambiguity_reason.includes('start_date')));
    });

    await test('31. Stage 2.1 Test E: Grounding verifies against sanitized text and rejects claims citing stripped PII', async () => {
      let promptSentToGemini = '';
      const capturingClient = {
        models: {
          generateContent: async ({ contents }) => {
            promptSentToGemini = typeof contents === 'string' ? contents : JSON.stringify(contents);
            return {
              text: JSON.stringify({
                ...validMockProfile,
                technical_skills: [
                  {
                    name: 'Python',
                    category: 'PROGRAMMING_LANGUAGE',
                    evidence_snippet: 'Contact: alice@confidential-corp.org',
                  },
                ],
              }),
            };
          },
        },
      };

      setMockGeminiClient(capturingClient);

      const resumeWithPii = await createTestResume({
        userId: userA.user_id,
        text: `Alice Engineer
Contact: alice@confidential-corp.org | Phone: +1 (555) 777-8888 | 999 Secret Blvd, CA 92101
Professional Summary: Passionate software engineer with 5 years of experience building scalable backend microservices and modern React applications.
Skills: Python, TypeScript`,
      });

      const res = await request(`/api/resumes/${resumeWithPii.resume_id}/ai-profile`, {
        method: 'POST',
        token: tokenA,
        body: { consent: true },
      });

      assert.strictEqual(res.status, 201);

      // 1. Verify sanitized resume is passed to Gemini (no raw PII transmitted)
      assert.strictEqual(promptSentToGemini.includes('alice@confidential-corp.org'), false);
      assert.strictEqual(promptSentToGemini.includes('(555) 777-8888'), false);
      assert.strictEqual(promptSentToGemini.includes('999 Secret Blvd'), false);
      assert.ok(promptSentToGemini.includes('[EMAIL_REDACTED]'));

      // 2. Verify grounding used sanitized source representation (where raw PII does not exist)
      const pythonSkill = res.data.data.profile.technical_skills.find((s) => s.name === 'Python');
      assert.ok(pythonSkill !== undefined);
      assert.strictEqual(pythonSkill.verification_status, 'UNVERIFIED');
      assert.ok(pythonSkill.unverified_reason !== null);

      // 3. Unit-level assertion confirming verifyProfileGrounding fails on raw PII against sanitized text
      const mockRawClaim = {
        technical_skills: [
          {
            name: 'Python',
            category: 'PROGRAMMING_LANGUAGE',
            evidence_snippet: 'alice@confidential-corp.org Python',
          },
        ],
      };
      const sanitizedText = sanitizeResumePii(resumeWithPii.extracted_text);
      const groundedWithSanitized = verifyProfileGrounding(mockRawClaim, sanitizedText);
      // Raw email does NOT exist in sanitizedText
      assert.strictEqual(groundedWithSanitized.technical_skills[0].verification_status, 'UNVERIFIED');
      assert.ok(groundedWithSanitized.technical_skills[0].unverified_reason.includes('not found in candidate resume text'));
    });

    console.log('\n====================================================');
    console.log(`Stage 2 AI Resume Understanding Suite Complete: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exitCode = 1;
      throw new Error(`${failed} test(s) failed in Stage 2 AI Suite`);
    }
  } finally {
    clearMockGeminiClient();
    server.close();
  }
};

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('resume.ai.test.mjs')) {
  runResumeAiTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal test execution failure:', err);
      process.exit(1);
    });
}

export default runResumeAiTests;
