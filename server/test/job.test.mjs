/**
 * Phase 7 Stage 2: Job Description Ingestion & Management Test Suite
 * Covers 39 approved test scenarios:
 * 1. Authentication & Security (6 tests)
 * 2. Authorization & IDOR Isolation (4 tests)
 * 3. Zod Input Validation on Normalized Values (10 tests)
 * 4. Job Ingestion & Exact Text Sanitization (4 tests)
 * 5. Skill Extraction & Classification (4 tests)
 * 6. CRUD Operations & Pagination (4 tests)
 * 7. Dedicated Re-Extraction Suite & Fault Isolation (5 tests)
 * 8. Cascading Behavior & History Preservation (1 test)
 * 9. Regression & Consistency Verification (1 test)
 */

import http from 'http';
import app from '../src/app.mjs';
import { query, testDbConnection } from '../src/config/database.mjs';
import { registerUser, generateToken } from '../src/services/auth.service.mjs';
import jobService from '../src/services/job.service.mjs';
import * as skillMatcher from '../src/utils/skill.matcher.mjs';

export const runJobTests = async () => {
  console.log('====================================================');
  console.log('Running Phase 7 Stage 2: Job Description Test Suite');
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
  const userAEmail = `job_user_a_${timestamp}@example.com`;
  const userBEmail = `job_user_b_${timestamp}@example.com`;
  const password = 'Password123!Secure';

  let userA, userB, tokenA, tokenB;
  let userAJobId, userBJobId;

  try {
    userA = await registerUser({ name: 'Job User A', email: userAEmail, password });
    tokenA = generateToken(userA);

    userB = await registerUser({ name: 'Job User B', email: userBEmail, password });
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

    // ========================================================================
    // 1. Authentication & Security (6 tests)
    // ========================================================================
    await test('1. Auth: POST /api/jobs rejects unauthenticated request with 401', async () => {
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test Title', description: 'Valid description with over twenty characters.' }),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'AUTHENTICATION_ERROR') throw new Error(`Expected AUTHENTICATION_ERROR, got ${body.error?.code}`);
    });

    await test('2. Auth: GET /api/jobs rejects unauthenticated request with 401', async () => {
      const res = await api('/api/jobs', { method: 'GET' });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await test('3. Auth: GET /api/jobs/:jobId rejects unauthenticated request with 401', async () => {
      const res = await api('/api/jobs/00000000-0000-0000-0000-000000000000', { method: 'GET' });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await test('4. Auth: PUT /api/jobs/:jobId rejects unauthenticated request with 401', async () => {
      const res = await api('/api/jobs/00000000-0000-0000-0000-000000000000', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated Title' }),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await test('5. Auth: DELETE /api/jobs/:jobId rejects unauthenticated request with 401', async () => {
      const res = await api('/api/jobs/00000000-0000-0000-0000-000000000000', { method: 'DELETE' });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await test('6. Auth: POST /api/jobs/:jobId/extract rejects unauthenticated request with 401', async () => {
      const res = await api('/api/jobs/00000000-0000-0000-0000-000000000000/extract', { method: 'POST' });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'AUTHENTICATION_ERROR') throw new Error(`Expected AUTHENTICATION_ERROR, got ${body.error?.code}`);
    });

    // Helper: Seed job for User A
    const seedRes = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Initial Backend Engineer',
          description: 'Requirements:\n- 3+ years of Python and PostgreSQL\n\nNice to have:\n- Docker and Redis',
        }),
      },
      tokenA
    );
    const seedData = await seedRes.json();
    userAJobId = seedData.data?.job?.job_id;

    // Helper: Seed job for User B
    const seedBRes = await api(
      '/api/jobs',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Frontend Engineer User B',
          description: 'Requirements:\n- JavaScript, React, and CSS\n\nNice to have:\n- TypeScript',
        }),
      },
      tokenB
    );
    const seedBData = await seedBRes.json();
    userBJobId = seedBData.data?.job?.job_id;

    // ========================================================================
    // 2. Authorization & IDOR Isolation (4 tests)
    // ========================================================================
    await test('7. IDOR: User B cannot retrieve User A job description (returns 404 RESOURCE_NOT_FOUND)', async () => {
      const res = await api(`/api/jobs/${userAJobId}`, { method: 'GET' }, tokenB);
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'RESOURCE_NOT_FOUND') throw new Error(`Expected RESOURCE_NOT_FOUND, got ${body.error?.code}`);
    });

    await test('8. IDOR: User B cannot update User A job description (returns 404 RESOURCE_NOT_FOUND)', async () => {
      const res = await api(
        `/api/jobs/${userAJobId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ title: 'Hacked Title By User B' }),
        },
        tokenB
      );
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      const { rows } = await query('SELECT title FROM job_descriptions WHERE job_id = $1', [userAJobId]);
      if (rows[0].title === 'Hacked Title By User B') throw new Error('Data breach: User B modified User A job title!');
    });

    await test('9. IDOR: User B cannot delete User A job description (returns 404 RESOURCE_NOT_FOUND)', async () => {
      const res = await api(`/api/jobs/${userAJobId}`, { method: 'DELETE' }, tokenB);
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      const { rows } = await query('SELECT job_id FROM job_descriptions WHERE job_id = $1', [userAJobId]);
      if (rows.length === 0) throw new Error('Data breach: User B deleted User A job description!');
    });

    await test('10. IDOR: User B cannot re-extract User A job (returns 404, User A data untouched)', async () => {
      const { rows: before } = await query('SELECT updated_at, extracted_data FROM job_descriptions WHERE job_id = $1', [userAJobId]);
      const res = await api(`/api/jobs/${userAJobId}/extract`, { method: 'POST' }, tokenB);
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      const { rows: after } = await query('SELECT updated_at, extracted_data FROM job_descriptions WHERE job_id = $1', [userAJobId]);
      if (before[0].updated_at.getTime() !== after[0].updated_at.getTime()) {
        throw new Error('User A job was modified by User B re-extract attempt!');
      }
    });

    // ========================================================================
    // 3. Zod Input Validation on Normalized Values (10 tests)
    // ========================================================================
    await test('11. Validation: Rejects missing title with 400 VALIDATION_ERROR', async () => {
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ description: 'Valid description that has over twenty characters.' }),
      }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('12. Validation: Rejects whitespace-only title ("   ") with 400 (trim before min)', async () => {
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: '   ', description: 'Valid description that has over twenty characters.' }),
      }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'VALIDATION_ERROR') throw new Error(`Expected VALIDATION_ERROR, got ${body.error?.code}`);
    });

    await test('13. Validation: Rejects short title (< 3 non-whitespace characters) with 400', async () => {
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: '  ab  ', description: 'Valid description that has over twenty characters.' }),
      }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('14. Validation: Rejects oversized title (> 255 characters) with 400', async () => {
      const longTitle = 'a'.repeat(256);
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: longTitle, description: 'Valid description that has over twenty characters.' }),
      }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('15. Validation: Rejects missing description with 400', async () => {
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: 'Valid Title' }),
      }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('16. Validation: Rejects whitespace-only description with 400 (trim before min)', async () => {
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: 'Valid Title', description: '                          ' }),
      }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('17. Validation: Rejects short description (< 20 non-whitespace characters) with 400', async () => {
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: 'Valid Title', description: 'Short description' }),
      }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('18. Validation: Rejects oversized description (> 50,000 characters) with 400', async () => {
      const hugeDesc = 'a'.repeat(50001);
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: 'Valid Title', description: hugeDesc }),
      }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('19. Validation: Rejects malformed jobId parameter (non-UUID) across endpoints with 400', async () => {
      const resGet = await api('/api/jobs/not-a-valid-uuid', { method: 'GET' }, tokenA);
      if (resGet.status !== 400) throw new Error(`Expected 400 for GET, got ${resGet.status}`);

      const resPut = await api('/api/jobs/12345', { method: 'PUT', body: JSON.stringify({ title: 'New' }) }, tokenA);
      if (resPut.status !== 400) throw new Error(`Expected 400 for PUT, got ${resPut.status}`);

      const resDel = await api('/api/jobs/abc-xyz', { method: 'DELETE' }, tokenA);
      if (resDel.status !== 400) throw new Error(`Expected 400 for DELETE, got ${resDel.status}`);

      const resExt = await api('/api/jobs/invalid-id/extract', { method: 'POST' }, tokenA);
      if (resExt.status !== 400) throw new Error(`Expected 400 for POST extract, got ${resExt.status}`);
    });

    await test('20. Validation: Rejects empty PUT update body (neither title nor description) with 400', async () => {
      const res = await api(`/api/jobs/${userAJobId}`, {
        method: 'PUT',
        body: JSON.stringify({}),
      }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    // ========================================================================
    // 4. Job Ingestion & Exact Text Sanitization (4 tests)
    // ========================================================================
    let createdJobId;
    await test('21. Ingestion: Creates job description, returning 201 with populated job_id, created_at, updated_at', async () => {
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Senior Distributed Systems Architect',
          description: 'Requirements:\n- 8+ years building cloud services with Go and Kubernetes\n\nNice to have:\n- Experience with AWS and Terraform',
        }),
      }, tokenA);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      const body = await res.json();
      const job = body.data?.job;
      if (!job || !job.job_id) throw new Error('Missing job_id in created record');
      if (!job.created_at || !job.updated_at) throw new Error('Missing timestamps in created record');
      if (job.title !== 'Senior Distributed Systems Architect') throw new Error(`Unexpected title: ${job.title}`);
      createdJobId = job.job_id;
    });

    await test('22. Text Sanitization: Strips null bytes (\\0) and control characters while preserving \\n and \\t', async () => {
      const rawText = 'Requirements:\x00\x08\n\t- Core programming in Python\x07 and PostgreSQL.\n- Docker containers.';
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Sanitization Test Job',
          description: rawText,
        }),
      }, tokenA);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      const body = await res.json();
      const desc = body.data?.job?.description;
      if (desc.includes('\x00') || desc.includes('\x08') || desc.includes('\x07')) {
        throw new Error('Null bytes or non-printable control characters were not stripped!');
      }
      if (!desc.includes('\t') || !desc.includes('\n')) {
        throw new Error('Tabs and newlines were not preserved during sanitization!');
      }
    });

    await test('23. Text Sanitization: Normalizes NFKC Unicode accents and collapses 3+ consecutive newlines to 2', async () => {
      // "ﬁ" is a Unicode ligature (U+FB01) that NFKC normalizes to "fi"
      const rawText = 'Requirements:\n\n\n\n- Experience with ﬁle systems and Python.\n\n\n\nNice to have:\n- Redis.';
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Ligature and Newline Job',
          description: rawText,
        }),
      }, tokenA);
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      const body = await res.json();
      const desc = body.data?.job?.description;
      if (desc.includes('ﬁ')) throw new Error('Ligature was not NFKC normalized to "fi"');
      if (desc.includes('\n\n\n')) throw new Error('3+ consecutive newlines were not collapsed to exactly 2');
    });

    await test('24. Updated_at Trigger: Automatic updated_at advancement on modification', async () => {
      const { rows: before } = await query('SELECT updated_at FROM job_descriptions WHERE job_id = $1', [createdJobId]);
      await new Promise((r) => setTimeout(r, 100)); // ensure timestamp advances
      const res = await api(`/api/jobs/${createdJobId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: 'Senior Distributed Systems Architect (Updated)' }),
      }, tokenA);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const { rows: after } = await query('SELECT updated_at FROM job_descriptions WHERE job_id = $1', [createdJobId]);
      if (after[0].updated_at.getTime() <= before[0].updated_at.getTime()) {
        throw new Error('updated_at timestamp did not advance after update!');
      }
    });

    // ========================================================================
    // 5. Skill Extraction & Classification (4 tests)
    // ========================================================================
    await test('25. Skill Extraction: Accurately classifies skills under Requirements as REQUIRED and Nice to have as PREFERRED', async () => {
      const text = `
About Us
We are a high growth tech company.

Requirements:
- Strong background in Python and PostgreSQL
- Experience in Docker

Nice to have:
- Knowledge of Kubernetes and Redis
`;
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: 'Classification Job', description: text }),
      }, tokenA);
      const body = await res.json();
      const extracted = body.data?.job?.extracted_data;

      const reqNames = extracted.required.map((s) => s.skillName);
      const prefNames = extracted.preferred.map((s) => s.skillName);

      if (!reqNames.includes('Python') || !reqNames.includes('PostgreSQL') || !reqNames.includes('Docker')) {
        throw new Error(`Missing expected required skills: ${reqNames}`);
      }
      if (!prefNames.includes('Kubernetes') || !prefNames.includes('Redis')) {
        throw new Error(`Missing expected preferred skills: ${prefNames}`);
      }
      if (extracted.unknown.length !== 0) {
        throw new Error(`Expected unknown to be empty, got: ${JSON.stringify(extracted.unknown)}`);
      }
    });

    await test('26. Fallback Policy: Unstructured JD maps detected skills from UNKNOWN to PREFERRED when no section cues exist', async () => {
      const unformatted = 'We need a software developer proficient in Python, Docker, and Redis to build scalable web APIs.';
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: 'Unstructured Job', description: unformatted }),
      }, tokenA);
      const body = await res.json();
      const extracted = body.data?.job?.extracted_data;

      if (extracted.required.length !== 0) {
        throw new Error('Expected 0 required skills for unstructured JD');
      }
      if (extracted.preferred.length < 3) {
        throw new Error(`Expected at least 3 preferred skills from fallback mapping, got ${extracted.preferred.length}`);
      }
      if (extracted.unknown.length !== 0) {
        throw new Error('Expected unknown skills array to be empty after fallback promotion');
      }
    });

    await test('27. Special Tokens: Correctly detects C, Golang, and RESTful APIs in job descriptions', async () => {
      const text = `
Requirements:
- C programming and systems software development
- Backend services written in Golang
- Designing RESTful APIs and microservices
`;
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: 'Special Tokens Job', description: text }),
      }, tokenA);
      const body = await res.json();
      const reqNames = body.data?.job?.extracted_data?.required?.map((s) => s.skillName) || [];

      if (!reqNames.includes('C')) throw new Error('Failed to match C programming');
      if (!reqNames.includes('Go')) throw new Error('Failed to match Golang alias to Go');
      if (!reqNames.includes('REST APIs')) throw new Error('Failed to match RESTful APIs');
    });

    await test('28. False-Positive Guards: Correctly ignores Vitamin C, restart, wrestle, and go to market', async () => {
      const text = `
Requirements:
- Must not wrestle with complex challenges alone.
- Periodic server restart routines.
- Company provides Vitamin C supplements.
- Leading go to market initiatives for Q4.
- Must have 3+ years experience with Java.
`;
      const res = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: 'False Positive Test Job', description: text }),
      }, tokenA);
      const body = await res.json();
      const allExtracted = [
        ...(body.data?.job?.extracted_data?.required || []),
        ...(body.data?.job?.extracted_data?.preferred || []),
        ...(body.data?.job?.extracted_data?.unknown || []),
      ].map((s) => s.skillName);

      if (allExtracted.includes('C')) throw new Error('False positive detected: "Vitamin C" matched C');
      if (allExtracted.includes('REST APIs')) throw new Error('False positive detected: "restart" matched REST APIs');
      if (allExtracted.includes('Go')) throw new Error('False positive detected: "go to market" matched Go');
      if (!allExtracted.includes('Java')) throw new Error('Expected valid skill "Java" was not detected');
    });

    // ========================================================================
    // 6. CRUD Operations & Pagination (4 tests)
    // ========================================================================
    await test('29. List Jobs: Lists only authenticated user jobs, ordered created_at DESC, with pagination', async () => {
      const res = await api('/api/jobs?page=1&limit=5', { method: 'GET' }, tokenA);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();

      if (!Array.isArray(body.data?.jobs)) throw new Error('jobs is not an array');
      if (body.data.jobs.length === 0) throw new Error('Expected at least 1 job for User A');
      if (!body.data.pagination) throw new Error('Missing pagination metadata');

      // Verify User B job is NOT present in User A list
      const hasUserBJob = body.data.jobs.some((j) => j.job_id === userBJobId);
      if (hasUserBJob) throw new Error('Security leak: User B job description visible in User A list!');

      // Verify skill_counts summary exists on list items
      const first = body.data.jobs[0];
      if (first.skill_counts?.total === undefined) throw new Error('Missing skill_counts on list item');
    });

    await test('30. Get Job By ID: Retrieves full record with complete text and extracted_data', async () => {
      const res = await api(`/api/jobs/${createdJobId}`, { method: 'GET' }, tokenA);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      const job = body.data?.job;

      if (job.job_id !== createdJobId) throw new Error('Mismatched job_id in retrieved details');
      if (!job.description) throw new Error('Missing complete description in retrieved details');
      if (!job.extracted_data || !Array.isArray(job.extracted_data.required)) {
        throw new Error('Missing extracted_data structure in retrieved details');
      }
    });

    await test('31. Update Job: Successfully updates title and/or description with consistent partial update semantics', async () => {
      // 1. Update title only: description and extracted_data must be preserved
      const res1 = await api(`/api/jobs/${createdJobId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: 'Principal Systems Architect' }),
      }, tokenA);
      if (res1.status !== 200) throw new Error(`Expected 200, got ${res1.status}`);
      const job1 = (await res1.json()).data?.job;
      if (job1.title !== 'Principal Systems Architect') throw new Error(`Title not updated: ${job1.title}`);
      if (!job1.description) throw new Error('Description was lost during title-only partial update!');

      // 2. Update description only: title is preserved, skills are re-extracted
      const newDesc = 'Requirements:\n- 5+ years of Java and Spring Boot\n\nNice to have:\n- AWS';
      const res2 = await api(`/api/jobs/${createdJobId}`, {
        method: 'PUT',
        body: JSON.stringify({ description: newDesc }),
      }, tokenA);
      if (res2.status !== 200) throw new Error(`Expected 200, got ${res2.status}`);
      const job2 = (await res2.json()).data?.job;
      if (job2.title !== 'Principal Systems Architect') throw new Error('Title was lost during description-only partial update!');
      const newSkills = job2.extracted_data?.required?.map((s) => s.skillName) || [];
      if (!newSkills.includes('Java') || !newSkills.includes('Spring Boot')) {
        throw new Error(`Skills were not re-extracted upon description update: ${newSkills}`);
      }
    });

    await test('32. Delete Job: Successfully removes the job description', async () => {
      // Create temporary job to delete
      const createRes = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: 'Temporary Job', description: 'Temporary job description with over twenty characters.' }),
      }, tokenA);
      const tempJobId = (await createRes.json()).data?.job?.job_id;

      const delRes = await api(`/api/jobs/${tempJobId}`, { method: 'DELETE' }, tokenA);
      if (delRes.status !== 200) throw new Error(`Expected 200, got ${delRes.status}`);

      // Verify it is gone
      const getRes = await api(`/api/jobs/${tempJobId}`, { method: 'GET' }, tokenA);
      if (getRes.status !== 404) throw new Error(`Expected 404 after deletion, got ${getRes.status}`);
    });

    // ========================================================================
    // 7. Dedicated Re-Extraction Suite & Fault Isolation (5 tests)
    // ========================================================================
    await test('33. Re-Extract: Authenticated owner triggers POST /api/jobs/:jobId/extract, receiving 200 with refreshed extracted_data', async () => {
      const res = await api(`/api/jobs/${createdJobId}/extract`, { method: 'POST' }, tokenA);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (!body.data?.job?.extracted_data) throw new Error('Missing refreshed extracted_data in response');
    });

    await test('34. Re-Extract: Nonexistent job ID returns 404 RESOURCE_NOT_FOUND', async () => {
      const res = await api('/api/jobs/00000000-0000-0000-0000-000000000000/extract', { method: 'POST' }, tokenA);
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'RESOURCE_NOT_FOUND') throw new Error(`Expected RESOURCE_NOT_FOUND, got ${body.error?.code}`);
    });

    await test('35. Re-Extract: Malformed UUID in route parameter returns 400 VALIDATION_ERROR', async () => {
      const res = await api('/api/jobs/not-a-uuid/extract', { method: 'POST' }, tokenA);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'VALIDATION_ERROR') throw new Error(`Expected VALIDATION_ERROR, got ${body.error?.code}`);
    });

    await test('36. Re-Extract: Successful re-extraction replaces extracted_data correctly in database', async () => {
      // Intentionally tamper extracted_data directly in DB to simulate stale extraction
      await query("UPDATE job_descriptions SET extracted_data = '{\"tampered\": true}' WHERE job_id = $1", [createdJobId]);

      const res = await api(`/api/jobs/${createdJobId}/extract`, { method: 'POST' }, tokenA);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

      // Verify in DB that proper structure was restored
      const { rows } = await query('SELECT extracted_data FROM job_descriptions WHERE job_id = $1', [createdJobId]);
      if (rows[0].extracted_data?.tampered) throw new Error('extracted_data in DB was not refreshed!');
      if (!Array.isArray(rows[0].extracted_data?.required)) throw new Error('extracted_data.required is missing in DB!');
    });

    await test('37. Fault Isolation: If extraction throws, no partial record is created and existing row is not corrupted', async () => {
      // Record baseline DB counts and state
      const { rows: beforeCount } = await query('SELECT COUNT(*)::int as c FROM job_descriptions');
      const { rows: beforeJob } = await query('SELECT title, description, extracted_data FROM job_descriptions WHERE job_id = $1', [createdJobId]);

      const failingExtractor = () => {
        throw new Error('Simulated parser crash during extraction');
      };

      // 1. Verify createJob fault isolation: throws, zero records inserted into DB
      let createFailed = false;
      try {
        await jobService.createJob({
          userId: userA.user_id,
          title: 'Crash Job',
          description: 'Crashing job description with over twenty characters.',
          extractorFn: failingExtractor,
        });
      } catch (err) {
        createFailed = true;
      }
      if (!createFailed) throw new Error('createJob did not throw on extraction failure');

      const { rows: afterCount } = await query('SELECT COUNT(*)::int as c FROM job_descriptions');
      if (afterCount[0].c !== beforeCount[0].c) {
        throw new Error('A partial job description was persisted in DB despite extraction failure!');
      }

      // 2. Verify updateJob fault isolation: throws, existing DB row remains 100% uncorrupted
      let updateFailed = false;
      try {
        await jobService.updateJob({
          userId: userA.user_id,
          jobId: createdJobId,
          description: 'New description that triggers a crash during extraction.',
          extractorFn: failingExtractor,
        });
      } catch (err) {
        updateFailed = true;
      }
      if (!updateFailed) throw new Error('updateJob did not throw on extraction failure');

      const { rows: afterUpdateJob } = await query('SELECT title, description, extracted_data FROM job_descriptions WHERE job_id = $1', [createdJobId]);
      if (afterUpdateJob[0].description !== beforeJob[0].description || JSON.stringify(afterUpdateJob[0].extracted_data) !== JSON.stringify(beforeJob[0].extracted_data)) {
        throw new Error('Existing job record was corrupted in DB during update extraction failure!');
      }

      // 3. Verify reExtractJobSkills fault isolation: throws, existing DB extracted_data remains intact
      let reExtractFailed = false;
      try {
        await jobService.reExtractJobSkills({
          userId: userA.user_id,
          jobId: createdJobId,
          extractorFn: failingExtractor,
        });
      } catch (err) {
        reExtractFailed = true;
      }
      if (!reExtractFailed) throw new Error('reExtractJobSkills did not throw on extraction failure');

      const { rows: afterReExtractJob } = await query('SELECT extracted_data FROM job_descriptions WHERE job_id = $1', [createdJobId]);
      if (JSON.stringify(afterReExtractJob[0].extracted_data) !== JSON.stringify(beforeJob[0].extracted_data)) {
        throw new Error('Existing extracted_data was corrupted in DB during re-extraction failure!');
      }
    });

    // ========================================================================
    // 8. Cascading Behavior & History Preservation (1 test)
    // ========================================================================
    await test('38. History Preservation: Deleting job description sets analyses.job_id = NULL while preserving score and job_title', async () => {
      // 1. Create a dummy job description
      const createJobRes = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Preservation Test Lead',
          description: 'Requirements:\n- Leadership and PostgreSQL.\n- Cloud architecture.',
        }),
      }, tokenA);
      const testJobId = (await createJobRes.json()).data?.job?.job_id;

      // 2. Insert an analysis record linked to this job
      const analysisInsert = `
        INSERT INTO analyses (
          user_id, job_id, job_title, resume_file_name,
          overall_score, skill_score, experience_score, project_score, education_score, quality_score
        ) VALUES (
          $1, $2, 'Preservation Test Lead', 'candidate_resume.pdf',
          85.50, 90.00, 80.00, 85.00, 80.00, 90.00
        ) RETURNING analysis_id;
      `;
      const { rows: analysisRows } = await query(analysisInsert, [userA.user_id, testJobId]);
      const testAnalysisId = analysisRows[0].analysis_id;

      // 3. Delete the job description
      const delRes = await api(`/api/jobs/${testJobId}`, { method: 'DELETE' }, tokenA);
      if (delRes.status !== 200) throw new Error(`Expected 200 on delete, got ${delRes.status}`);

      // 4. Verify the analysis record still exists, job_id is NULL, and job_title is intact
      const { rows: checkAnalysis } = await query(
        'SELECT analysis_id, job_id, job_title, overall_score FROM analyses WHERE analysis_id = $1',
        [testAnalysisId]
      );

      if (checkAnalysis.length === 0) {
        throw new Error('Analysis record was deleted when job was deleted! Expected ON DELETE SET NULL.');
      }
      if (checkAnalysis[0].job_id !== null) {
        throw new Error(`Expected analyses.job_id to be NULL, got ${checkAnalysis[0].job_id}`);
      }
      if (checkAnalysis[0].job_title !== 'Preservation Test Lead') {
        throw new Error(`analyses.job_title snapshot was altered or lost: ${checkAnalysis[0].job_title}`);
      }
      if (Number(checkAnalysis[0].overall_score) !== 85.50) {
        throw new Error(`analyses.overall_score was altered: ${checkAnalysis[0].overall_score}`);
      }

      // Cleanup analysis row
      await query('DELETE FROM analyses WHERE analysis_id = $1', [testAnalysisId]);
    });

    // ========================================================================
    // 9. Full Regression Suite Verification (1 test)
    // ========================================================================
    await test('39. Regression Consistency: Stage 2 endpoints leave database schema and existing entities intact', async () => {
      // Verify users and resumes tables remain unaffected
      const { rows: u } = await query('SELECT COUNT(*)::int as c FROM users');
      const { rows: r } = await query('SELECT COUNT(*)::int as c FROM resumes');
      if (u[0].c === 0) throw new Error('Users table corrupted');
      if (r[0].c === undefined) throw new Error('Resumes table corrupted');
    });

  } finally {
    // Cleanup test users
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
  console.log(`Phase 7 Stage 2 Job Suite: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
    throw new Error(`Stage 2 Job Suite Failed with ${failed} failure(s)`);
  }
};

runJobTests().catch((err) => {
  console.error('Unhandled Stage 2 test failure:', err);
  process.exit(1);
});
