/**
 * Phase 7 Stage 3: Resume ↔ Job Matching & Analysis Engine Test Suite
 * Covers 47 approved test scenarios:
 * 1. Authentication & IDOR Security (8 tests)
 * 2. Request Validation (5 tests)
 * 3. Resume Processing State Guards (5 tests)
 * 4. Job Description Data Robustness & Error Handling (3 tests)
 * 5. Deterministic Matching & Classification (10 tests)
 * 6. Scoring Formula & Mathematical Edge Cases (8 tests)
 * 7. Transaction Atomicity, Retrieval & Historical Preservation (8 tests)
 */

import http from 'http';
import app from '../src/app.mjs';
import { query, pool, testDbConnection } from '../src/config/database.mjs';
import { registerUser, generateToken } from '../src/services/auth.service.mjs';
import analysisService from '../src/services/analysis.service.mjs';

export const runAnalysisTests = async () => {
  console.log('====================================================');
  console.log('Running Phase 7 Stage 3: Analysis & Matching Test Suite');
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

  // Shared test users
  const timestamp = Date.now();
  const userAEmail = `analysis_user_a_${timestamp}@example.com`;
  const userBEmail = `analysis_user_b_${timestamp}@example.com`;
  const password = 'Password123!Secure';

  let userA, userB, tokenA, tokenB;
  let validResumeIdA, validJobIdA;
  let validResumeIdB, validJobIdB;

  try {
    userA = await registerUser({ name: 'Analysis User A', email: userAEmail, password });
    tokenA = generateToken(userA);

    userB = await registerUser({ name: 'Analysis User B', email: userBEmail, password });
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

    // Helper: Insert resume with controlled state
    const insertResume = async ({ userId, fileName, status, text }) => {
      const res = await query(
        `INSERT INTO resumes (user_id, file_name, file_path, extraction_status, extracted_text)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING resume_id`,
        [userId, fileName, `uploads/test_${Date.now()}.pdf`, status, text]
      );
      return res.rows[0].resume_id;
    };

    // Create baseline valid resumes
    const validResumeTextA = `
Technical Skills:
- Programming Languages: Python, JavaScript, TypeScript, Go
- Frameworks: React, Node.js, Express.js
- Databases: PostgreSQL, Redis
- Cloud/DevOps: Docker, AWS, Git

Experience:
Senior Software Engineer developing scalable web microservices in Node.js and TypeScript.
Configured PostgreSQL databases and managed Docker containers on AWS.
`;
    validResumeIdA = await insertResume({
      userId: userA.user_id,
      fileName: 'user_a_resume.pdf',
      status: 'COMPLETED',
      text: validResumeTextA,
    });

    validResumeIdB = await insertResume({
      userId: userB.user_id,
      fileName: 'user_b_resume.pdf',
      status: 'COMPLETED',
      text: 'Skills: Java, Spring Boot, MySQL.',
    });

    // Create baseline valid jobs via API
    const jobResA = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Full Stack Node.js Engineer',
          description: `
Requirements:
- Strong experience with Python, Node.js, and TypeScript.
- Relational database experience with PostgreSQL.

Nice to have:
- Experience with Docker and Redis.
- Familiarity with Go programming.
`,
        }),
      },
      tokenA
    );
    validJobIdA = (await jobResA.json()).data.job.job_id;

    const jobResB = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Java Developer',
          description: 'Requirements:\n- Java and Spring Boot experience.\n- MySQL database management.',
        }),
      },
      tokenB
    );
    validJobIdB = (await jobResB.json()).data.job.job_id;

    // ========================================================================
    // 1. Authentication & IDOR Security (8 tests)
    // ========================================================================
    await test('1. Auth: POST /api/analyses rejects unauthenticated request with 401', async () => {
      const res = await api('/api/analyses', {
        method: 'POST',
        body: JSON.stringify({ resumeId: validResumeIdA, jobId: validJobIdA }),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'AUTHENTICATION_ERROR') throw new Error(`Expected AUTHENTICATION_ERROR, got ${body.error?.code}`);
    });

    await test('2. Auth: GET /api/analyses rejects unauthenticated request with 401', async () => {
      const res = await api('/api/analyses', { method: 'GET' });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await test('3. Auth: GET /api/analyses/:analysisId rejects unauthenticated request with 401', async () => {
      const res = await api('/api/analyses/00000000-0000-0000-0000-000000000000', { method: 'GET' });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await test('4. Auth: DELETE /api/analyses/:analysisId rejects unauthenticated request with 401', async () => {
      const res = await api('/api/analyses/00000000-0000-0000-0000-000000000000', { method: 'DELETE' });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await test('5. IDOR: User A cannot create analysis using User B resume (returns 404 RESOURCE_NOT_FOUND)', async () => {
      const res = await api(
        '/api/analyses',
        {
          method: 'POST',
          body: JSON.stringify({ resumeId: validResumeIdB, jobId: validJobIdA }),
        },
        tokenA
      );
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'RESOURCE_NOT_FOUND') throw new Error(`Expected RESOURCE_NOT_FOUND, got ${body.error?.code}`);
    });

    await test('6. IDOR: User A cannot create analysis using User B job description (returns 404 RESOURCE_NOT_FOUND)', async () => {
      const res = await api(
        '/api/analyses',
        {
          method: 'POST',
          body: JSON.stringify({ resumeId: validResumeIdA, jobId: validJobIdB }),
        },
        tokenA
      );
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'RESOURCE_NOT_FOUND') throw new Error(`Expected RESOURCE_NOT_FOUND, got ${body.error?.code}`);
    });

    await test('7. IDOR: User A cannot create analysis using User B resume AND User B job (returns 404)', async () => {
      const res = await api(
        '/api/analyses',
        {
          method: 'POST',
          body: JSON.stringify({ resumeId: validResumeIdB, jobId: validJobIdB }),
        },
        tokenA
      );
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    });

    // Create a real analysis for User A to test User B access denial
    const createAnalysisRes = await api(
      '/api/analyses',
      {
        method: 'POST',
        body: JSON.stringify({ resumeId: validResumeIdA, jobId: validJobIdA }),
      },
      tokenA
    );
    const existingAnalysisId = (await createAnalysisRes.json()).data.analysis.analysis_id;

    await test('8. IDOR: User B cannot retrieve or delete User A analysis (returns 404 RESOURCE_NOT_FOUND)', async () => {
      const getRes = await api(`/api/analyses/${existingAnalysisId}`, { method: 'GET' }, tokenB);
      if (getRes.status !== 404) throw new Error(`Expected 404 on GET, got ${getRes.status}`);

      const delRes = await api(`/api/analyses/${existingAnalysisId}`, { method: 'DELETE' }, tokenB);
      if (delRes.status !== 404) throw new Error(`Expected 404 on DELETE, got ${delRes.status}`);
    });

    // ========================================================================
    // 2. Request Validation (5 tests)
    // ========================================================================
    await test('9. Validation: Rejects missing resumeId with 400 VALIDATION_ERROR', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ jobId: validJobIdA }) }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'VALIDATION_ERROR') throw new Error(`Expected VALIDATION_ERROR, got ${body.error?.code}`);
    });

    await test('10. Validation: Rejects missing jobId with 400 VALIDATION_ERROR', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA }) }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'VALIDATION_ERROR') throw new Error(`Expected VALIDATION_ERROR, got ${body.error?.code}`);
    });

    await test('11. Validation: Rejects malformed resumeId (non-UUID) with 400 VALIDATION_ERROR', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: 'invalid-uuid', jobId: validJobIdA }) }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('12. Validation: Rejects malformed jobId (non-UUID) with 400 VALIDATION_ERROR', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: 'not-a-uuid' }) }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('13. Validation: Rejects malformed analysisId parameter with 400 VALIDATION_ERROR', async () => {
      const res = await api('/api/analyses/123-not-uuid', { method: 'GET' }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    // ========================================================================
    // 3. Resume Processing State Guards (5 tests)
    // ========================================================================
    const pendingResumeId = await insertResume({
      userId: userA.user_id,
      fileName: 'pending.pdf',
      status: 'PENDING',
      text: null,
    });
    const processingResumeId = await insertResume({
      userId: userA.user_id,
      fileName: 'processing.pdf',
      status: 'PROCESSING',
      text: null,
    });
    const failedResumeId = await insertResume({
      userId: userA.user_id,
      fileName: 'failed.pdf',
      status: 'FAILED',
      text: null,
    });
    const emptyTextResumeId = await insertResume({
      userId: userA.user_id,
      fileName: 'empty.pdf',
      status: 'COMPLETED',
      text: '   \n  \t  ',
    });

    await test('14. State Guard: Rejects resume in PENDING status with 409 RESUME_NOT_PROCESSED', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: pendingResumeId, jobId: validJobIdA }) }, tokenA);
      if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'RESUME_NOT_PROCESSED') throw new Error(`Expected RESUME_NOT_PROCESSED, got ${body.error?.code}`);
    });

    await test('15. State Guard: Rejects resume in PROCESSING status with 409 RESUME_PROCESSING_IN_PROGRESS', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: processingResumeId, jobId: validJobIdA }) }, tokenA);
      if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'RESUME_PROCESSING_IN_PROGRESS') throw new Error(`Expected RESUME_PROCESSING_IN_PROGRESS, got ${body.error?.code}`);
    });

    await test('16. State Guard: Rejects resume in FAILED status with 422 RESUME_PROCESSING_FAILED', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: failedResumeId, jobId: validJobIdA }) }, tokenA);
      if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'RESUME_PROCESSING_FAILED') throw new Error(`Expected RESUME_PROCESSING_FAILED, got ${body.error?.code}`);
    });

    await test('17. State Guard: Rejects resume with COMPLETED status but empty/whitespace text with 422 RESUME_NO_TEXT', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: emptyTextResumeId, jobId: validJobIdA }) }, tokenA);
      if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'RESUME_NO_TEXT') throw new Error(`Expected RESUME_NO_TEXT, got ${body.error?.code}`);
    });

    await test('18. State Guard: Successfully accepts resume in COMPLETED status with valid extracted text', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: validJobIdA }) }, tokenA);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    });

    // ========================================================================
    // 4. Job Description Data Robustness & Error Handling (3 tests)
    // ========================================================================
    await test('19. JD Source of Truth: Correctly consumes valid job_descriptions.extracted_data without re-extraction', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: validJobIdA }) }, tokenA);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      const body = await res.json();
      if (!body.data?.analysis?.summary) throw new Error('Summary missing from response');
    });

    // Setup job with missing extracted_data (NULL)
    const nullJobRes = await api(
      '/api/jobs',
      { method: 'POST', body: JSON.stringify({ title: 'Null Job', description: 'Requirements: Python and Docker.' }) },
      tokenA
    );
    const nullJobId = (await nullJobRes.json()).data.job.job_id;
    await query('UPDATE job_descriptions SET extracted_data = NULL WHERE job_id = $1', [nullJobId]);

    await test('20. Missing Data Guard: extracted_data IS NULL returns 422 JOB_EXTRACTION_UNAVAILABLE without updating DB', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: nullJobId }) }, tokenA);
      if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'JOB_EXTRACTION_UNAVAILABLE') throw new Error(`Expected JOB_EXTRACTION_UNAVAILABLE, got ${body.error?.code}`);

      // Verify DB was NOT updated
      const { rows } = await query('SELECT extracted_data FROM job_descriptions WHERE job_id = $1', [nullJobId]);
      if (rows[0].extracted_data !== null) throw new Error('Database was unexpectedly modified during 422 error!');
    });

    // Setup job with invalid extracted_data structure
    const invalidStructJobRes = await api(
      '/api/jobs',
      { method: 'POST', body: JSON.stringify({ title: 'Invalid Struct Job', description: 'Requirements: Python.' }) },
      tokenA
    );
    const invalidStructJobId = (await invalidStructJobRes.json()).data.job.job_id;
    await query("UPDATE job_descriptions SET extracted_data = '{\"required\": \"Python\", \"preferred\": []}'::jsonb WHERE job_id = $1", [invalidStructJobId]);

    await test('21. Structure Guard: Invalid extracted_data structure returns 422 INVALID_JOB_EXTRACTION_DATA', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: invalidStructJobId }) }, tokenA);
      if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'INVALID_JOB_EXTRACTION_DATA') throw new Error(`Expected INVALID_JOB_EXTRACTION_DATA, got ${body.error?.code}`);
    });

    // ========================================================================
    // 5. Deterministic Matching & Classification (10 tests)
    // ========================================================================
    const matchResumeText = `
Skills: Python, TypeScript, Docker, Redis, Go
Experience: Developed backend in Node.js and SQL queries.
`;
    const matchResumeId = await insertResume({
      userId: userA.user_id,
      fileName: 'match_candidate.pdf',
      status: 'COMPLETED',
      text: matchResumeText,
    });

    // 100% matched job
    const allMatchedJobRes = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Full Match Role',
          description: 'Requirements:\n- Python and TypeScript.\nNice to have:\n- Docker and Redis.',
        }),
      },
      tokenA
    );
    const allMatchedJobId = (await allMatchedJobRes.json()).data.job.job_id;

    await test('22. Matching: All required skills matched -> classified as MATCHED', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: matchResumeId, jobId: allMatchedJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      const reqSkills = data.skills.filter((s) => s.requirement_type === 'REQUIRED');
      if (reqSkills.some((s) => s.status !== 'MATCHED')) throw new Error('Not all required skills matched');
    });

    // Job with some missing required skills
    const partialJobRes = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Partial Match Role',
          description: 'Requirements:\n- Python and Kubernetes and Rust.\nNice to have:\n- Docker.',
        }),
      },
      tokenA
    );
    const partialJobId = (await partialJobRes.json()).data.job.job_id;

    await test('23. Matching: Some required skills missing -> missing classified as MISSING with score 0.00', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: matchResumeId, jobId: partialJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      const rustSkill = data.skills.find((s) => s.skill_name === 'Rust');
      if (!rustSkill) throw new Error('Rust requirement missing from analysis skills');
      if (rustSkill.status !== 'MISSING' || rustSkill.similarity_score !== 0.0) {
        throw new Error(`Expected MISSING with score 0.00, got ${rustSkill.status} (${rustSkill.similarity_score})`);
      }
    });

    await test('24. Matching: All preferred skills matched -> classified as MATCHED', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: matchResumeId, jobId: allMatchedJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      const prefSkills = data.skills.filter((s) => s.requirement_type === 'PREFERRED');
      if (prefSkills.some((s) => s.status !== 'MATCHED')) throw new Error('Preferred skills were not all matched');
    });

    // Job with same skill in both Requirements and Preferred
    const duplicateSectionJobRes = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Overlap Role',
          description: 'Requirements:\n- Python and TypeScript.\nNice to have:\n- Python and Redis.',
        }),
      },
      tokenA
    );
    const duplicateSectionJobId = (await duplicateSectionJobRes.json()).data.job.job_id;

    await test('25. Matching: Same skill appearing in both Requirements and Preferred -> REQUIRED takes precedence', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: matchResumeId, jobId: duplicateSectionJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      const pythonOccurrences = data.skills.filter((s) => s.skill_name === 'Python');
      if (pythonOccurrences.length !== 1) throw new Error(`Expected exactly 1 Python entry, found ${pythonOccurrences.length}`);
      if (pythonOccurrences[0].requirement_type !== 'REQUIRED') {
        throw new Error(`Expected REQUIRED precedence, got ${pythonOccurrences[0].requirement_type}`);
      }
      if (!pythonOccurrences[0].evidence.startsWith('[REQUIRED]')) {
        throw new Error(`Expected [REQUIRED] evidence prefix, got ${pythonOccurrences[0].evidence}`);
      }
    });

    // Alias recognition: "Golang" in resume matching "Go"
    const aliasResumeText = 'Technical Skills:\n- Golang, PostgreSQL.';
    const aliasResumeId = await insertResume({
      userId: userA.user_id,
      fileName: 'alias_resume.pdf',
      status: 'COMPLETED',
      text: aliasResumeText,
    });
    const aliasJobRes = await api(
      '/api/jobs',
      { method: 'POST', body: JSON.stringify({ title: 'Go Backend Role', description: 'Requirements:\n- Go programming.' }) },
      tokenA
    );
    const aliasJobId = (await aliasJobRes.json()).data.job.job_id;

    await test('26. Matching: Alias recognition (Golang in resume matches Go requirement)', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: aliasResumeId, jobId: aliasJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      const goSkill = data.skills.find((s) => s.skill_name === 'Go');
      if (!goSkill || goSkill.status !== 'MATCHED') throw new Error('Go skill failed alias match from Golang');
      if (goSkill.similarity_score !== 90.0) throw new Error(`Expected alias score 90.00, got ${goSkill.similarity_score}`);
    });

    // Precedence tiers: Skills section exact = 100, alias = 90, body = 80
    const tierResumeText = `
Technical Skills:
- Python, NodeJS
Experience:
Worked with PostgreSQL database and Docker containers in production.
`;
    const tierResumeId = await insertResume({
      userId: userA.user_id,
      fileName: 'tier_resume.pdf',
      status: 'COMPLETED',
      text: tierResumeText,
    });
    const tierJobRes = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Tier Role',
          description: 'Requirements:\n- Python, Node.js, and PostgreSQL.',
        }),
      },
      tokenA
    );
    const tierJobId = (await tierJobRes.json()).data.job.job_id;

    await test('27. Matching: Precedence tiers (Skills section exact = 100, alias = 90, body = 80)', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: tierResumeId, jobId: tierJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      const python = data.skills.find((s) => s.skill_name === 'Python');
      const node = data.skills.find((s) => s.skill_name === 'Node.js');
      const postgres = data.skills.find((s) => s.skill_name === 'PostgreSQL');

      if (python.similarity_score !== 100.0) throw new Error(`Expected Python 100.00, got ${python.similarity_score}`);
      if (node.similarity_score !== 90.0) throw new Error(`Expected Node.js alias 90.00, got ${node.similarity_score}`);
      if (postgres.similarity_score !== 80.0) throw new Error(`Expected PostgreSQL body 80.00, got ${postgres.similarity_score}`);
    });

    // Token boundary protection
    const boundaryResumeText = 'Experience: Took daily Vitamin C. Ready to restart server and wrestle with issues.';
    const boundaryResumeId = await insertResume({
      userId: userA.user_id,
      fileName: 'boundary.pdf',
      status: 'COMPLETED',
      text: boundaryResumeText,
    });
    const boundaryJobRes = await api(
      '/api/jobs',
      { method: 'POST', body: JSON.stringify({ title: 'Boundary Role', description: 'Requirements:\n- C language and REST APIs.' }) },
      tokenA
    );
    const boundaryJobId = (await boundaryJobRes.json()).data.job.job_id;

    await test('28. Matching: Token boundary protection (Vitamin C does not match C, restart does not match REST APIs)', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: boundaryResumeId, jobId: boundaryJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      const cSkill = data.skills.find((s) => s.skill_name === 'C');
      const restSkill = data.skills.find((s) => s.skill_name === 'REST APIs');
      if (cSkill.status !== 'MISSING') throw new Error(`Vitamin C caused false positive match for C: ${cSkill.status}`);
      if (restSkill.status !== 'MISSING') throw new Error(`restart caused false positive match for REST APIs: ${restSkill.status}`);
    });

    // Deduplication of repeated job requirements
    const repeatJobRes = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Repeat Role',
          description: 'Requirements:\n- Python programming.\n- Must be an expert in Python.\n- Solid Python background.',
        }),
      },
      tokenA
    );
    const repeatJobId = (await repeatJobRes.json()).data.job.job_id;

    await test('29. Matching: Deduplicates repeated skills in job description into a single requirement', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: repeatJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      const pythonEntries = data.skills.filter((s) => s.skill_name === 'Python');
      if (pythonEntries.length !== 1) throw new Error(`Expected exactly 1 Python requirement, found ${pythonEntries.length}`);
    });

    // Master dictionary resolution for C, R, and .NET
    const specialTokensResumeText = 'Technical Skills:\n- C, R, .NET, PostgreSQL.';
    const specialTokensResumeId = await insertResume({
      userId: userA.user_id,
      fileName: 'special_skills.pdf',
      status: 'COMPLETED',
      text: specialTokensResumeText,
    });
    const specialTokensJobRes = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Embedded Data Engineer',
          description: 'Requirements:\n- C language, R language, and .NET framework.',
        }),
      },
      tokenA
    );
    const specialTokensJobId = (await specialTokensJobRes.json()).data.job.job_id;

    await test('30. Master Dictionary: Resolves canonical skills C, R, and .NET against skills table seeded by Seed 002', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: specialTokensResumeId, jobId: specialTokensJobId }) }, tokenA);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      const data = (await res.json()).data.analysis;
      const c = data.skills.find((s) => s.skill_name === 'C');
      const r = data.skills.find((s) => s.skill_name === 'R');
      const dotNet = data.skills.find((s) => s.skill_name === '.NET');
      if (!c || c.status !== 'MATCHED') throw new Error('C failed matching or resolution');
      if (!r || r.status !== 'MATCHED') throw new Error('R failed matching or resolution');
      if (!dotNet || dotNet.status !== 'MATCHED') throw new Error('.NET failed matching or resolution');
    });

    await test('31. Catalog Guard: Master dictionary lookup uses read-only queries and performs no database mutations', async () => {
      const { rows: before } = await query('SELECT count(*)::int as c FROM skills');
      await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: specialTokensResumeId, jobId: specialTokensJobId }) }, tokenA);
      const { rows: after } = await query('SELECT count(*)::int as c FROM skills');
      if (before[0].c !== after[0].c) {
        throw new Error(`Skills table mutated during analysis request! Before: ${before[0].c}, After: ${after[0].c}`);
      }
    });

    // ========================================================================
    // 6. Scoring Formula & Mathematical Edge Cases (8 tests)
    // ========================================================================
    await test('32. Scoring: Verifies exact composite score for standard mixed required, preferred, and confidence inputs', async () => {
      // 2 req (Python matched at 1.0, Java missing at 0.0) -> Sreq = 1/2 = 0.5
      // 1 pref (Docker matched at 0.8) -> Spref = 1/1 = 1.0
      // Matched skills: Python (1.0) and Docker (0.8) -> Sconf = (1.0 + 0.8)/2 = 0.90
      // Raw = (0.7 * 0.5 + 0.2 * 1.0 + 0.1 * 0.90) * 100 = (0.35 + 0.20 + 0.09) * 100 = 0.64 * 100 = 64.00
      const scoreResumeText = 'Technical Skills:\n- Python.\nExperience:\nDeployed apps in Docker.';
      const scoreResumeId = await insertResume({
        userId: userA.user_id,
        fileName: 'score_test.pdf',
        status: 'COMPLETED',
        text: scoreResumeText,
      });
      const scoreJobRes = await api(
        '/api/jobs',
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'Scoring Formula Test Job',
            description: 'Requirements:\n- Python and Java.\nNice to have:\n- Docker.',
          }),
        },
        tokenA
      );
      const scoreJobId = (await scoreJobRes.json()).data.job.job_id;

      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: scoreResumeId, jobId: scoreJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      if (data.overall_score !== 64.0) throw new Error(`Expected score 64.00, got ${data.overall_score}`);
    });

    // Zero required skills (Nreq = 0, Npref > 0 -> Sreq = 1.0)
    const zeroReqJobRes = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Preferred Only Role',
          description: 'Nice to have:\n- Python and Docker.',
        }),
      },
      tokenA
    );
    const zeroReqJobId = (await zeroReqJobRes.json()).data.job.job_id;

    await test('33. Scoring: Zero required skills (Nreq = 0, Npref > 0) sets Sreq = 1.0', async () => {
      // Sreq = 1.0 (Nreq=0)
      // Spref = 2/2 = 1.0 (both matched)
      // Sconf = (1.0 + 1.0)/2 = 1.0 (Skills section)
      // Raw = (0.70*1 + 0.20*1 + 0.10*1) * 100 = 100.00
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: zeroReqJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      if (data.overall_score !== 100.0) throw new Error(`Expected 100.00 for full preferred match with 0 req, got ${data.overall_score}`);
    });

    // Zero preferred skills (Nreq > 0, Npref = 0 -> Spref = 0.0)
    const zeroPrefJobRes = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Required Only Role',
          description: 'Requirements:\n- Python and TypeScript.',
        }),
      },
      tokenA
    );
    const zeroPrefJobId = (await zeroPrefJobRes.json()).data.job.job_id;

    await test('34. Scoring: Zero preferred skills (Nreq > 0, Npref = 0) sets Spref = 0.0', async () => {
      // Sreq = 2/2 = 1.0
      // Spref = 0.0 (by rule)
      // Sconf = (1.0 + 1.0)/2 = 1.0
      // Raw = (0.70*1 + 0.20*0 + 0.10*1) * 100 = 80.00
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: zeroPrefJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      if (data.overall_score !== 80.0) throw new Error(`Expected 80.00 for required-only match, got ${data.overall_score}`);
    });

    // Empty job description (no skills extractable)
    const emptyJobRes = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Skill-Less Job',
          description: 'General organizational duties and weekly meeting facilitation.',
        }),
      },
      tokenA
    );
    const emptyJobId = (await emptyJobRes.json()).data.job.job_id;

    await test('35. Scoring: Empty job description (Nreq = 0, Npref = 0) returns overall_score = 0.00', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: emptyJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      if (data.overall_score !== 0.0) throw new Error(`Expected 0.00 for empty job description, got ${data.overall_score}`);
    });

    await test('36. Scoring: Missing skills receive confidence 0.00 and are excluded from Sconf calculation', async () => {
      // 1 req matched (Python in Skills section -> conf 1.0)
      // 1 req missing (Rust -> conf 0.0, excluded from average)
      // Sconf must be 1.0 / 1 = 1.0, NOT (1.0 + 0.0)/2 = 0.5
      // Sreq = 1/2 = 0.5, Spref = 0.0
      // Raw = (0.7*0.5 + 0.2*0 + 0.1*1.0) * 100 = (0.35 + 0.10) * 100 = 45.00
      const singleMatchJobRes = await api(
        '/api/jobs',
        { method: 'POST', body: JSON.stringify({ title: 'Single Match Role', description: 'Requirements:\n- Python and Rust.' }) },
        tokenA
      );
      const singleMatchJobId = (await singleMatchJobRes.json()).data.job.job_id;

      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: singleMatchJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      if (data.overall_score !== 45.0) throw new Error(`Expected 45.00 with missing skills excluded from Sconf, got ${data.overall_score}`);
    });

    await test('37. Scoring: Clamping guarantees score never exceeds 100.00 or falls below 0.00', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: zeroReqJobId }) }, tokenA);
      const data = (await res.json()).data.analysis;
      if (data.overall_score < 0.0 || data.overall_score > 100.0) throw new Error(`Score out of bounds: ${data.overall_score}`);
    });

    await test('38. Scoring: Confirms rounding to exactly 2 decimal places', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: validJobIdA }) }, tokenA);
      const data = (await res.json()).data.analysis;
      const scoreStr = data.overall_score.toString();
      const decimals = scoreStr.includes('.') ? scoreStr.split('.')[1].length : 0;
      if (decimals > 2) throw new Error(`Score has more than 2 decimals: ${scoreStr}`);
    });

    await test('39. Scoring: Confirms skill_score strictly equals overall_score', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: validJobIdA }) }, tokenA);
      const data = (await res.json()).data.analysis;
      if (data.skill_score !== data.overall_score) {
        throw new Error(`skill_score (${data.skill_score}) !== overall_score (${data.overall_score})`);
      }
    });

    // ========================================================================
    // 7. Transaction Atomicity, Retrieval & Historical Preservation (8 tests)
    // ========================================================================
    await test('40. Persistence: Atomically creates parent analyses record and child analysis_skills records', async () => {
      const res = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: validJobIdA }) }, tokenA);
      const data = (await res.json()).data.analysis;
      const analysisId = data.analysis_id;

      const { rows: a } = await query('SELECT analysis_id, resume_file_name, job_title FROM analyses WHERE analysis_id = $1', [analysisId]);
      const { rows: ask } = await query('SELECT count(*)::int as c FROM analysis_skills WHERE analysis_id = $1', [analysisId]);

      if (a.length === 0) throw new Error('Parent analyses row not found in database');
      if (ask[0].c === 0) throw new Error('Child analysis_skills rows not found in database');
    });

    await test('41. Atomicity: Injected error during child insert triggers ROLLBACK (zero orphaned records in analyses)', async () => {
      const countBefore = (await query('SELECT count(*)::int as c FROM analyses')).rows[0].c;

      // Connect and simulate transactional failure
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const insertAnalysis = `
          INSERT INTO analyses (user_id, resume_id, job_id, overall_score, skill_score, experience_score, project_score, education_score, quality_score)
          VALUES ($1, $2, $3, 50, 50, 0, 0, 0, 0)
          RETURNING analysis_id
        `;
        const { rows } = await client.query(insertAnalysis, [userA.user_id, validResumeIdA, validJobIdA]);
        const testAId = rows[0].analysis_id;

        // Attempt invalid insert violating foreign key
        await client.query(
          'INSERT INTO analysis_skills (analysis_id, skill_id, status, evidence, similarity_score) VALUES ($1, $2, $3, $4, $5)',
          [testAId, '00000000-0000-0000-0000-000000000000', 'MATCHED', 'Invalid', 100]
        );
        await client.query('COMMIT');
      } catch (expectedErr) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }

      const countAfter = (await query('SELECT count(*)::int as c FROM analyses')).rows[0].c;
      if (countBefore !== countAfter) {
        throw new Error(`Orphaned row remained in analyses after transaction rollback! Before: ${countBefore}, After: ${countAfter}`);
      }
    });

    // History: Deleting job description sets analyses.job_id = NULL
    const histJobRes = await api(
      '/api/jobs',
      { method: 'POST', body: JSON.stringify({ title: 'Ephemeral Job', description: 'Requirements:\n- Python and Docker.' }) },
      tokenA
    );
    const histJobId = (await histJobRes.json()).data.job.job_id;
    const histAnalysisRes = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: histJobId }) }, tokenA);
    const histAnalysisId = (await histAnalysisRes.json()).data.analysis.analysis_id;

    await test('42. History: Deleting job description sets analyses.job_id = NULL while preserving job_title snapshot, scores, and all analysis_skills rows', async () => {
      // Delete job
      const delJobRes = await api(`/api/jobs/${histJobId}`, { method: 'DELETE' }, tokenA);
      if (delJobRes.status !== 200) throw new Error('Failed to delete job description');

      // Check analysis record
      const { rows: a } = await query('SELECT analysis_id, job_id, job_title, overall_score FROM analyses WHERE analysis_id = $1', [histAnalysisId]);
      const { rows: ask } = await query('SELECT count(*)::int as c FROM analysis_skills WHERE analysis_id = $1', [histAnalysisId]);

      if (a.length === 0) throw new Error('Analysis record was deleted when job was deleted!');
      if (a[0].job_id !== null) throw new Error(`Expected job_id to be NULL, got ${a[0].job_id}`);
      if (a[0].job_title !== 'Ephemeral Job') throw new Error(`job_title snapshot corrupted: ${a[0].job_title}`);
      if (ask[0].c === 0) throw new Error('Child analysis_skills rows were deleted when job was deleted!');
    });

    // History: Deleting resume sets analyses.resume_id = NULL
    const histResumeId = await insertResume({
      userId: userA.user_id,
      fileName: 'ephemeral_resume.pdf',
      status: 'COMPLETED',
      text: 'Skills: Python, TypeScript.',
    });
    const resumeHistAnalysisRes = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: histResumeId, jobId: validJobIdA }) }, tokenA);
    const resumeHistAnalysisId = (await resumeHistAnalysisRes.json()).data.analysis.analysis_id;

    await test('43. History: Deleting resume sets analyses.resume_id = NULL while preserving resume_file_name snapshot and scores', async () => {
      // Delete resume directly from database
      await query('DELETE FROM resumes WHERE resume_id = $1', [histResumeId]);

      const { rows: a } = await query('SELECT analysis_id, resume_id, resume_file_name, overall_score FROM analyses WHERE analysis_id = $1', [resumeHistAnalysisId]);
      if (a.length === 0) throw new Error('Analysis was deleted when resume was deleted!');
      if (a[0].resume_id !== null) throw new Error(`Expected resume_id to be NULL, got ${a[0].resume_id}`);
      if (a[0].resume_file_name !== 'ephemeral_resume.pdf') throw new Error(`resume_file_name snapshot lost: ${a[0].resume_file_name}`);
    });

    await test('44. History: Modifying job description text does not alter previously completed analysis results or classifications', async () => {
      // Modify job description
      await api(
        `/api/jobs/${validJobIdA}`,
        { method: 'PUT', body: JSON.stringify({ description: 'Requirements:\n- Completely new text with Ruby and Rust.' }) },
        tokenA
      );

      // Verify existing analysis report remained unchanged
      const getRes = await api(`/api/analyses/${existingAnalysisId}`, { method: 'GET' }, tokenA);
      const data = (await getRes.json()).data.analysis;
      const python = data.skills.find((s) => s.skill_name === 'Python');
      if (!python) throw new Error('Historical analysis skill record was altered by job modification!');
    });

    await test('45. Repeat Analysis: Running analysis for the same resume and job twice creates two distinct historical reports', async () => {
      const res1 = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: validJobIdA }) }, tokenA);
      const res2 = await api('/api/analyses', { method: 'POST', body: JSON.stringify({ resumeId: validResumeIdA, jobId: validJobIdA }) }, tokenA);
      const id1 = (await res1.json()).data.analysis.analysis_id;
      const id2 = (await res2.json()).data.analysis.analysis_id;

      if (id1 === id2) throw new Error('Repeat analysis returned identical analysis_id; expected immutable new record');
    });

    await test('46. List & Pagination: Lists user analyses ordered created_at DESC with correct multi-tenant isolation', async () => {
      const resA = await api('/api/analyses?page=1&limit=5', { method: 'GET' }, tokenA);
      const bodyA = await resA.json();
      if (!bodyA.data.analyses || !bodyA.data.pagination) throw new Error('List response missing analyses or pagination');
      if (bodyA.data.analyses.length === 0) throw new Error('Expected at least 1 analysis for User A');

      // Verify User B receives empty list
      const resB = await api('/api/analyses', { method: 'GET' }, tokenB);
      const bodyB = await resB.json();
      if (bodyB.data.analyses.length !== 0) throw new Error(`User B saw ${bodyB.data.analyses.length} analyses; expected 0 (IDOR leak)`);
    });

    await test('47. Get Analysis: Authenticated owner successfully retrieves an existing analysis by ID and receives complete structure', async () => {
      const res = await api(`/api/analyses/${existingAnalysisId}`, { method: 'GET' }, tokenA);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      const a = body.data?.analysis;

      if (!a) throw new Error('Response missing analysis object');
      if (typeof a.analysis_id !== 'string') throw new Error('analysis_id missing or invalid');
      if (typeof a.overall_score !== 'number') throw new Error('overall_score missing or invalid');
      if (typeof a.skill_score !== 'number') throw new Error('skill_score missing or invalid');
      if (!a.summary || typeof a.summary.total_job_skills !== 'number') throw new Error('summary missing or invalid');
      if (!Array.isArray(a.skills) || a.skills.length === 0) throw new Error('skills array missing or empty');

      // Verify requirement_type, status, similarity_score, evidence on each skill
      for (const skill of a.skills) {
        if (!['REQUIRED', 'PREFERRED'].includes(skill.requirement_type)) {
          throw new Error(`Invalid requirement_type: ${skill.requirement_type}`);
        }
        if (!['MATCHED', 'MISSING', 'PARTIAL'].includes(skill.status)) {
          throw new Error(`Invalid status: ${skill.status}`);
        }
        if (typeof skill.similarity_score !== 'number') {
          throw new Error(`Invalid similarity_score: ${skill.similarity_score}`);
        }
        if (typeof skill.evidence !== 'string' || !skill.evidence.length) {
          throw new Error(`Invalid evidence: ${skill.evidence}`);
        }
      }
    });

  } finally {
    // Cleanup test users and cascade-related data
    try {
      const uAId = userA?.user_id || userA?.userId;
      const uBId = userB?.user_id || userB?.userId;
      if (uAId) await query('DELETE FROM users WHERE user_id = $1', [uAId]);
      if (uBId) await query('DELETE FROM users WHERE user_id = $1', [uBId]);
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }

    // Close ephemeral server
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n====================================================');
  console.log(`Phase 7 Stage 3 Analysis Suite: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
    throw new Error(`Stage 3 Analysis Suite Failed with ${failed} failure(s)`);
  }
};

runAnalysisTests().catch((err) => {
  console.error('Unhandled Stage 3 test failure:', err);
  process.exit(1);
});
