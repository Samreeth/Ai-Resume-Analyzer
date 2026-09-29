/**
 * Comprehensive Test Suite for Phase 6 Stage 3:
 * Secure Resume Processing & Text Extraction Pipeline
 */

import http from 'http';
import app from '../src/app.mjs';
import config from '../src/config/env.mjs';
import { pool, query } from '../src/config/database.mjs';
import { generateToken, registerUser } from '../src/services/auth.service.mjs';
import processingService, {
  calculateCooldownSeconds,
  runStartupRecovery,
  runStaleRecovery,
  finalizeAttempt,
} from '../src/services/processing.service.mjs';
import { ExtractionSemaphore } from '../src/utils/semaphore.util.mjs';
import {
  createValidResumePdf,
  createValidResumeDocx,
} from './fixtures.mjs';

export const runProcessingTests = async () => {
  console.log('====================================================');
  console.log('Running Phase 6 Stage 3: Processing & Extraction Tests');
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

  // Start dedicated HTTP test server on an ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const timestamp = Date.now();
  const userAEmail = `proc_user_a_${timestamp}@example.com`;
  const userBEmail = `proc_user_b_${timestamp}@example.com`;
  const password = 'Password123!Secure';

  let userA, userB, tokenA, tokenB;
  let userAPdfResumeId, userADocxResumeId;

  try {
    userA = await registerUser({ name: 'Processing User A', email: userAEmail, password });
    tokenA = generateToken(userA);

    userB = await registerUser({ name: 'Processing User B', email: userBEmail, password });
    tokenB = generateToken(userB);

    // Helper for multipart resume upload
    const uploadFile = async (token, fileName, buffer, mimeType) => {
      const formData = new FormData();
      formData.append('resume', new Blob([buffer], { type: mimeType }), fileName);

      return fetch(`${baseUrl}/api/resumes`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: formData,
      });
    };

    // Helper to call process endpoint
    const callProcess = async (token, resumeId, body = {}) => {
      return fetch(`${baseUrl}/api/resumes/${resumeId}/process`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    };

    // Helper to call status endpoint
    const callStatus = async (token, resumeId) => {
      return fetch(`${baseUrl}/api/resumes/${resumeId}/status`, {
        method: 'GET',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
    };

    // Upload base test resumes
    const pdfRes = await uploadFile(tokenA, 'valid_resume.pdf', createValidResumePdf(), 'application/pdf');
    const pdfData = await pdfRes.json();
    userAPdfResumeId = pdfData.data.resume.resume_id;

    const docxRes = await uploadFile(tokenA, 'valid_resume.docx', createValidResumeDocx(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const docxData = await docxRes.json();
    userADocxResumeId = docxData.data.resume.resume_id;

    // ========================================================================
    // 1. Authorization & IDOR Tests
    // ========================================================================
    await test('IDOR: Rejects unauthenticated processing request with 401', async () => {
      const res = await callProcess(null, userAPdfResumeId);
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await test('IDOR: Rejects nonexistent resume with 404 RESUME_NOT_FOUND', async () => {
      const res = await callProcess(tokenA, '00000000-0000-0000-0000-000000000000');
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      const body = await res.json();
      if (body.code !== 'RESUME_NOT_FOUND') throw new Error(`Expected RESUME_NOT_FOUND, got ${body.code}`);
    });

    await test('IDOR: User B cannot process User A resume (returns 404 without leaking existence)', async () => {
      const res = await callProcess(tokenB, userAPdfResumeId);
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      const body = await res.json();
      if (body.code !== 'RESUME_NOT_FOUND') throw new Error(`Expected RESUME_NOT_FOUND, got ${body.code}`);
    });

    await test('IDOR: User B cannot retrieve processing status of User A resume (returns 404)', async () => {
      const res = await callStatus(tokenB, userAPdfResumeId);
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      const body = await res.json();
      if (body.code !== 'RESUME_NOT_FOUND') throw new Error(`Expected RESUME_NOT_FOUND, got ${body.code}`);
    });

    // ========================================================================
    // 2. Successful Processing Tests
    // ========================================================================
    await test('Processing: Successfully extracts and persists text from valid PDF resume', async () => {
      const res = await callProcess(tokenA, userAPdfResumeId);
      if (res.status !== 200) {
        const body = await res.text();
        throw new Error(`Expected 200, got ${res.status}: ${body}`);
      }

      const body = await res.json();
      if (body.status !== 'success') throw new Error('Expected status: success');
      if (body.data.extractionStatus !== 'COMPLETED') throw new Error('Expected extractionStatus COMPLETED');
      if (!body.data.extractedText || body.data.extractedText.length < 20) {
        throw new Error('Extracted text missing or too short');
      }
      if (body.data.characterCount < 20) throw new Error('Expected characterCount >= 20');
      if (body.data.wordCount < 5) throw new Error('Expected wordCount >= 5');
      if (body.data.processingAttempts !== 1) throw new Error('Expected attempts 1');

      // Verify database state: token is cleared, extracted_text is persisted
      const { rows } = await query(
        'SELECT extraction_status, processing_token, extracted_text FROM resumes WHERE resume_id = $1',
        [userAPdfResumeId]
      );
      if (rows[0].extraction_status !== 'COMPLETED') throw new Error('DB status not COMPLETED');
      if (rows[0].processing_token !== null) throw new Error('DB processing_token was not cleared');
      if (!rows[0].extracted_text) throw new Error('DB extracted_text is empty');
    });

    await test('Processing: Successfully extracts and persists text from valid DOCX resume', async () => {
      const res = await callProcess(tokenA, userADocxResumeId);
      if (res.status !== 200) {
        const body = await res.text();
        throw new Error(`Expected 200, got ${res.status}: ${body}`);
      }

      const body = await res.json();
      if (body.status !== 'success') throw new Error('Expected status: success');
      if (body.data.extractionStatus !== 'COMPLETED') throw new Error('Expected extractionStatus COMPLETED');
      if (!body.data.extractedText.includes('JavaScript\t8 Years')) {
        throw new Error('Table formatting tabs were not preserved in extracted text');
      }
    });

    await test('Processing: Rejects already completed resume with 400 RESUME_ALREADY_COMPLETED', async () => {
      const res = await callProcess(tokenA, userAPdfResumeId);
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      const body = await res.json();
      if (body.code !== 'RESUME_ALREADY_COMPLETED') throw new Error(`Expected RESUME_ALREADY_COMPLETED, got ${body.code}`);
      if (body.details?.canRetry !== false) throw new Error('Expected canRetry: false');
    });

    await test('Status Endpoint: Retrieves lightweight status metadata without full text', async () => {
      const res = await callStatus(tokenA, userAPdfResumeId);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (body.data.extractionStatus !== 'COMPLETED') throw new Error('Expected COMPLETED');
      if (body.data.hasExtractedText !== true) throw new Error('Expected hasExtractedText true');
      if (body.data.canRetry !== false) throw new Error('Expected canRetry false for completed resume');
      if (body.data.extractedText !== undefined) throw new Error('Status endpoint should not leak full extractedText');
    });

    // ========================================================================
    // 3. Concurrency, Race Condition, & Semaphore Tests
    // ========================================================================
    await test('Concurrent Claims: Two simultaneous process requests result in exactly one 200 and one 409', async () => {
      // Upload a new resume for testing concurrent claim
      const uploadRes = await uploadFile(tokenA, 'concurrent.pdf', createValidResumePdf(), 'application/pdf');
      const uploadBody = await uploadRes.json();
      const concResumeId = uploadBody.data.resume.resume_id;

      const [res1, res2] = await Promise.all([
        callProcess(tokenA, concResumeId, { options: { extractionDelayMs: 60 } }),
        callProcess(tokenA, concResumeId),
      ]);

      const statuses = [res1.status, res2.status].sort();
      if (statuses[0] !== 200 || statuses[1] !== 409) {
        throw new Error(`Expected [200, 409], got [${res1.status}, ${res2.status}]`);
      }

      const conflictRes = res1.status === 409 ? res1 : res2;
      const conflictBody = await conflictRes.json();
      if (conflictBody.code !== 'RESUME_ALREADY_PROCESSING') {
        throw new Error(`Expected RESUME_ALREADY_PROCESSING, got ${conflictBody.code}`);
      }
    });

    await test('Capacity Failure: Rejection at semaphore does not increment processing_attempts', async () => {
      const uploadRes = await uploadFile(tokenA, 'capacity.pdf', createValidResumePdf(), 'application/pdf');
      const uploadBody = await uploadRes.json();
      const capResumeId = uploadBody.data.resume.resume_id;

      // Mock semaphore with 0 capacity
      const mockFullSemaphore = new ExtractionSemaphore(0);

      // Attempt processing with full semaphore
      let caughtError = null;
      try {
        await processingService.processResume({
          userId: userA.user_id,
          resumeId: capResumeId,
          options: { semaphore: mockFullSemaphore },
        });
      } catch (err) {
        caughtError = err;
      }

      if (!caughtError || caughtError.code !== 'EXTRACTION_CONCURRENCY_EXCEEDED') {
        throw new Error(`Expected EXTRACTION_CONCURRENCY_EXCEEDED, got ${caughtError?.code}`);
      }
      if (caughtError.statusCode !== 503) {
        throw new Error(`Expected statusCode 503, got ${caughtError.statusCode}`);
      }

      // Verify DB row: attempts MUST remain 0, status must remain PENDING
      const { rows } = await query(
        'SELECT extraction_status, processing_attempts FROM resumes WHERE resume_id = $1',
        [capResumeId]
      );
      if (rows[0].processing_attempts !== 0) {
        throw new Error(`Expected attempts 0, got ${rows[0].processing_attempts}`);
      }
      if (rows[0].extraction_status !== 'PENDING') {
        throw new Error(`Expected status PENDING, got ${rows[0].extraction_status}`);
      }
    });

    await test('Claim Race: Acquired permit is released before fallback re-query and double release is prevented', async () => {
      const uploadRes = await uploadFile(tokenA, 'claim_race.pdf', createValidResumePdf(), 'application/pdf');
      const uploadBody = await uploadRes.json();
      const raceResumeId = uploadBody.data.resume.resume_id;

      const semaphore = new ExtractionSemaphore(2);

      // Step 1: Acquire a semaphore permit
      const permitHandle = semaphore.tryAcquire(raceResumeId);
      if (semaphore.activePermits !== 1) throw new Error('Expected 1 active permit after acquire');

      // Step 2: Force the atomic claim to return zero rows
      // Simulate another worker claiming the resume concurrently
      await query(
        `UPDATE resumes SET extraction_status = 'PROCESSING', processing_token = gen_random_uuid() WHERE resume_id = $1`,
        [raceResumeId]
      );

      // Attempt atomic claim query - returns 0 rows because status is already 'PROCESSING'
      const claimQuery = `
        UPDATE resumes
        SET extraction_status = 'PROCESSING',
            processing_token = gen_random_uuid(),
            processing_started_at = CURRENT_TIMESTAMP,
            processing_attempts = processing_attempts + 1
        WHERE resume_id = $1
          AND user_id = $2
          AND extraction_status IN ('PENDING', 'FAILED')
          AND processing_attempts < 3
        RETURNING processing_token, processing_attempts;
      `;
      const claimResult = await query(claimQuery, [raceResumeId, userA.user_id]);
      if (claimResult.rowCount !== 0) throw new Error('Expected atomic claim to return 0 rows');

      // Step 3: Release the permit before the fallback re-query
      const released = permitHandle.releasePermit('CLAIM_RACE_FAILURE');
      if (!released) throw new Error('Expected releasePermit to return true');

      // Step 5a: Confirm activePermits returns to expected value (0) BEFORE fallback query
      if (semaphore.activePermits !== 0) {
        throw new Error(`Expected activePermits 0 before fallback query, got ${semaphore.activePermits}`);
      }

      // Step 4: Perform fallback state classification
      const fallbackResult = await query(
        'SELECT extraction_status, processing_attempts FROM resumes WHERE resume_id = $1 AND user_id = $2',
        [raceResumeId, userA.user_id]
      );
      if (fallbackResult.rows[0].extraction_status !== 'PROCESSING') {
        throw new Error('Fallback classification failed');
      }

      // Step 5b: Confirm activePermits remains 0 after fallback query
      if (semaphore.activePermits !== 0) {
        throw new Error(`Expected activePermits 0 after fallback query, got ${semaphore.activePermits}`);
      }

      // Step 6: Confirms duplicate release cannot decrement the permit twice
      const duplicateRelease = permitHandle.releasePermit('REDUNDANT');
      if (duplicateRelease !== false) {
        throw new Error('Duplicate release should return false');
      }
      if (semaphore.activePermits !== 0) {
        throw new Error(`Duplicate release corrupted activePermits to ${semaphore.activePermits}`);
      }

      // Task settlement also must not decrement permit below 0
      permitHandle.settleTask();
      if (semaphore.activePermits !== 0) {
        throw new Error(`Task settlement corrupted activePermits to ${semaphore.activePermits}`);
      }
    });

    await test('Semaphore: Exactly-once permit release prevents double-release and underflow', () => {
      const semaphore = new ExtractionSemaphore(3, 100);
      const permitHandle = semaphore.tryAcquire('task_1');

      if (semaphore.activePermits !== 1 || semaphore.unsettledTasks !== 1) {
        throw new Error('Initial acquire state inaccurate');
      }

      // First release
      const first = permitHandle.releasePermit('NORMAL');
      if (!first || semaphore.activePermits !== 0) throw new Error('First release failed');

      // Second redundant release
      const second = permitHandle.releasePermit('REDUNDANT');
      if (second !== false || semaphore.activePermits !== 0) {
        throw new Error('Second release was not ignored or caused negative permit count');
      }

      // settleTask after release
      permitHandle.settleTask();
      if (semaphore.unsettledTasks !== 0 || semaphore.activePermits !== 0) {
        throw new Error('Task settlement failed or caused permit underflow');
      }
    });

    await test('Semaphore: Emergency release after deadline allows permit reuse while task remains unsettled', async () => {
      // Create semaphore with short 20ms emergency timeout
      const semaphore = new ExtractionSemaphore(1, 20);
      const permitHandle = semaphore.tryAcquire('hanging_task');

      if (semaphore.activePermits !== 1) throw new Error('Expected 1 active permit');

      // Wait for emergency timer (30ms)
      await new Promise((r) => setTimeout(r, 30));

      // After emergency release: activePermits drops to 0, but unsettledTasks remains 1
      const metricsAfterEmergency = semaphore.getMetrics();
      if (metricsAfterEmergency.activePermits !== 0) {
        throw new Error(`Expected 0 active permits after emergency release, got ${metricsAfterEmergency.activePermits}`);
      }
      if (metricsAfterEmergency.unsettledTasks !== 1) {
        throw new Error(`Expected 1 unsettled task, got ${metricsAfterEmergency.unsettledTasks}`);
      }
      if (metricsAfterEmergency.emergencyReleasedTasks !== 1) {
        throw new Error(`Expected 1 emergency released task, got ${metricsAfterEmergency.emergencyReleasedTasks}`);
      }

      // New task can acquire the newly available permit
      const secondPermit = semaphore.tryAcquire('new_task');
      if (!secondPermit || semaphore.activePermits !== 1) {
        throw new Error('Failed to acquire permit after emergency release');
      }

      // Hanging task finally settles late
      permitHandle.settleTask();
      const metricsAfterLateSettle = semaphore.getMetrics();
      if (metricsAfterLateSettle.emergencyReleasedTasks !== 0) {
        throw new Error('emergencyReleasedTasks was not decremented on late settle');
      }
      if (metricsAfterLateSettle.activePermits !== 1) {
        throw new Error('activePermits corrupted by late settle of emergency-released task');
      }

      secondPermit.settleTask();
    });

    // ========================================================================
    // 4. Timeout, Cooldown, and Attempt Boundary Tests
    // ========================================================================
    let timedOutResumeId;

    await test('Timeout: Forces EXTRACTION_TIMEOUT and sets status FAILED with token cleared', async () => {
      const uploadRes = await uploadFile(tokenA, 'timeout.pdf', createValidResumePdf(), 'application/pdf');
      const uploadBody = await uploadRes.json();
      timedOutResumeId = uploadBody.data.resume.resume_id;

      // Pass timeoutMs: 0 to force immediate timeout
      const res = await callProcess(tokenA, timedOutResumeId, { options: { timeoutMs: 0 } });
      if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}`);

      const body = await res.json();
      if (body.code !== 'EXTRACTION_TIMEOUT') throw new Error(`Expected EXTRACTION_TIMEOUT, got ${body.code}`);
      if (body.details.canRetry !== true) throw new Error('Expected canRetry: true');
      if (body.details.processingAttempts !== 1) throw new Error('Expected attempts: 1');

      // Verify database row
      const { rows } = await query(
        'SELECT extraction_status, processing_token, processing_error_code, processing_completed_at FROM resumes WHERE resume_id = $1',
        [timedOutResumeId]
      );
      if (rows[0].extraction_status !== 'FAILED') throw new Error('Expected status FAILED');
      if (rows[0].processing_token !== null) throw new Error('Expected processing_token NULL');
      if (rows[0].processing_error_code !== 'EXTRACTION_TIMEOUT') throw new Error('Expected error code EXTRACTION_TIMEOUT');
      if (!rows[0].processing_completed_at) throw new Error('Expected processing_completed_at timestamp');
    });

    await test('Cooldown: Immediate retry within 10s returns 429 RETRY_COOLDOWN_ACTIVE with Retry-After header', async () => {
      const res = await callProcess(tokenA, timedOutResumeId);
      if (res.status !== 429) throw new Error(`Expected 429, got ${res.status}`);

      const retryAfterHeader = res.headers.get('Retry-After');
      if (!retryAfterHeader || parseInt(retryAfterHeader, 10) <= 0) {
        throw new Error(`Invalid or missing Retry-After header: ${retryAfterHeader}`);
      }

      const body = await res.json();
      if (body.code !== 'RETRY_COOLDOWN_ACTIVE') throw new Error(`Expected RETRY_COOLDOWN_ACTIVE, got ${body.code}`);
      if (body.details.retryAfterSeconds !== parseInt(retryAfterHeader, 10)) {
        throw new Error('Header Retry-After does not match body details.retryAfterSeconds');
      }

      // Verify attempts was NOT incremented by cooldown rejection
      const { rows } = await query('SELECT processing_attempts FROM resumes WHERE resume_id = $1', [timedOutResumeId]);
      if (rows[0].processing_attempts !== 1) {
        throw new Error(`Cooldown rejection incremented attempts to ${rows[0].processing_attempts}`);
      }
    });

    await test('Cooldown Unit: Deterministic calculation across all boundary values', () => {
      const now = 1700000000000;

      // 0ms elapsed -> 10s
      if (calculateCooldownSeconds(new Date(now), now, 10) !== 10) throw new Error('Failed at 0ms elapsed');

      // 4800ms elapsed (5.2s remaining) -> Math.ceil(5.2) = 6s
      if (calculateCooldownSeconds(new Date(now - 4800), now, 10) !== 6) throw new Error('Failed at 5.2s remaining');

      // 9000ms elapsed (1.0s remaining) -> 1s
      if (calculateCooldownSeconds(new Date(now - 9000), now, 10) !== 1) throw new Error('Failed at 1.0s remaining');

      // 9750ms elapsed (250ms remaining) -> Math.ceil(0.25) = 1s
      if (calculateCooldownSeconds(new Date(now - 9750), now, 10) !== 1) throw new Error('Failed at 250ms remaining');

      // 10001ms elapsed -> 0s (expired)
      if (calculateCooldownSeconds(new Date(now - 10001), now, 10) !== 0) throw new Error('Failed at expired');

      // Null timestamp -> 0s
      if (calculateCooldownSeconds(null, now, 10) !== 0) throw new Error('Failed on null timestamp');

      // Invalid timestamp -> 0s
      if (calculateCooldownSeconds('invalid-date', now, 10) !== 0) throw new Error('Failed on invalid timestamp');
    });

    await test('Cooldown Expiry: Allows retry when clock passes 10s cooldown window', async () => {
      // Simulate timestamp 11 seconds in the past using injected currentTimeMs
      const simulatedFutureTime = Date.now() + 15000;

      const res = await callProcess(tokenA, timedOutResumeId, {
        options: { currentTimeMs: simulatedFutureTime },
      });

      if (res.status !== 200) {
        const body = await res.text();
        throw new Error(`Expected 200 after cooldown expiry, got ${res.status}: ${body}`);
      }

      const body = await res.json();
      if (body.data.extractionStatus !== 'COMPLETED') throw new Error('Expected COMPLETED after retry');
      if (body.data.processingAttempts !== 2) throw new Error(`Expected attempts 2, got ${body.data.processingAttempts}`);
    });

    await test('Max Attempts: Resume reaching 3 attempts permanently locks with 422 MAX_PROCESSING_ATTEMPTS_EXCEEDED', async () => {
      const uploadRes = await uploadFile(tokenA, 'max_attempts.pdf', createValidResumePdf(), 'application/pdf');
      const uploadBody = await uploadRes.json();
      const maxResumeId = uploadBody.data.resume.resume_id;

      // Force row to 3 attempts in DB
      await query(
        `UPDATE resumes
         SET processing_attempts = 3,
             extraction_status = 'FAILED',
             processing_error_code = 'EXTRACTION_TIMEOUT',
             processing_completed_at = CURRENT_TIMESTAMP
         WHERE resume_id = $1`,
        [maxResumeId]
      );

      // Attempt to process: max attempts takes precedence over cooldown
      const res = await callProcess(tokenA, maxResumeId);
      if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}`);

      const body = await res.json();
      if (body.code !== 'MAX_PROCESSING_ATTEMPTS_EXCEEDED') {
        throw new Error(`Expected MAX_PROCESSING_ATTEMPTS_EXCEEDED, got ${body.code}`);
      }
      if (body.details.canRetry !== false) throw new Error('Expected canRetry: false');
    });

    // ========================================================================
    // 5. Finalization Token-Fencing & Recovery Tests
    // ========================================================================
    await test('Token Fencing: Late success from obsolete token returns rowCount 0 without overwriting state', async () => {
      const uploadRes = await uploadFile(tokenA, 'fenced.pdf', createValidResumePdf(), 'application/pdf');
      const uploadBody = await uploadRes.json();
      const fencedResumeId = uploadBody.data.resume.resume_id;

      // Set resume to PROCESSING with Token 2
      const activeToken = '22222222-2222-2222-2222-222222222222';
      const obsoleteToken = '11111111-1111-1111-1111-111111111111';

      await query(
        `UPDATE resumes
         SET extraction_status = 'PROCESSING', processing_token = $1
         WHERE resume_id = $2`,
        [activeToken, fencedResumeId]
      );

      // Late worker with obsolete token attempts write
      const lateResult = await finalizeAttempt({
        resumeId: fencedResumeId,
        token: obsoleteToken,
        status: 'COMPLETED',
        text: 'Late text that should be rejected',
      });

      if (lateResult.rowCount !== 0 || lateResult.success !== false) {
        throw new Error('Late finalization write was not rejected');
      }

      // Verify DB row still has activeToken and text is NULL
      const { rows } = await query('SELECT processing_token, extracted_text FROM resumes WHERE resume_id = $1', [fencedResumeId]);
      if (rows[0].processing_token !== activeToken) throw new Error('Active token was corrupted');
      if (rows[0].extracted_text !== null) throw new Error('Extracted text was overwritten by late write');
    });

    await test('Token Fencing: Late failure from obsolete token returns rowCount 0 without modifying state', async () => {
      const uploadRes = await uploadFile(tokenA, 'fenced_fail.pdf', createValidResumePdf(), 'application/pdf');
      const uploadBody = await uploadRes.json();
      const fencedFailResumeId = uploadBody.data.resume.resume_id;

      const activeToken = '44444444-4444-4444-4444-444444444444';
      const obsoleteToken = '55555555-5555-5555-5555-555555555555';

      await query(
        `UPDATE resumes SET extraction_status = 'PROCESSING', processing_token = $1 WHERE resume_id = $2`,
        [activeToken, fencedFailResumeId]
      );

      // Late failure write with obsolete token
      const lateFailResult = await finalizeAttempt({
        resumeId: fencedFailResumeId,
        token: obsoleteToken,
        status: 'FAILED',
        errorCode: 'LATE_ERROR',
        errorMessage: 'Should be dropped',
      });

      if (lateFailResult.rowCount !== 0 || lateFailResult.success !== false) {
        throw new Error('Late failure write was not rejected');
      }

      // Verify activeToken still in place
      const { rows } = await query('SELECT processing_token, extraction_status FROM resumes WHERE resume_id = $1', [fencedFailResumeId]);
      if (rows[0].processing_token !== activeToken) throw new Error('Active token was corrupted');
      if (rows[0].extraction_status !== 'PROCESSING') throw new Error('Status was corrupted by late failure');
    });

    await test('Finalization Uncertainty: Verifies indirect commit if retry returns rowCount 0', async () => {
      const uploadRes = await uploadFile(tokenA, 'uncertain.pdf', createValidResumePdf(), 'application/pdf');
      const uploadBody = await uploadRes.json();
      const uncResumeId = uploadBody.data.resume.resume_id;

      const testToken = '33333333-3333-3333-3333-333333333333';

      // Set to PROCESSING with testToken
      await query(
        `UPDATE resumes SET extraction_status = 'PROCESSING', processing_token = $1 WHERE resume_id = $2`,
        [testToken, uncResumeId]
      );

      // Create a mock queryFn that commits Query 1, then throws an error simulating a network disruption
      let callCount = 0;
      const mockQueryFn = async (sql, params) => {
        callCount++;
        if (callCount === 1) {
          // Perform the actual update so it commits
          await query(sql, params);
          // Now throw network error as if connection dropped right as commit succeeded
          throw new Error('ECONNRESET: socket hang up after commit');
        }
        // Second call (retry): executes against DB, which now returns rowCount = 0 because token was cleared by call 1
        return query(sql, params);
      };

      const finalResult = await finalizeAttempt({
        resumeId: uncResumeId,
        token: testToken,
        status: 'COMPLETED',
        text: 'Committed Text',
        queryFn: mockQueryFn,
      });

      if (finalResult.success !== true || !finalResult.verifiedIndirectly) {
        throw new Error('Uncertain finalization did not verify indirect commit');
      }

      // 1. Verify the actual state committed in live PostgreSQL
      const { rows } = await query(
        'SELECT extraction_status, processing_token, extracted_text FROM resumes WHERE resume_id = $1',
        [uncResumeId]
      );
      if (rows[0].extraction_status !== 'COMPLETED') throw new Error('Live DB status is not COMPLETED');
      if (rows[0].processing_token !== null) throw new Error('Live DB processing_token was not cleared');
      if (rows[0].extracted_text !== 'Committed Text') throw new Error('Live DB extracted_text was not saved');

      // 2. Negative verification: Mismatched status must NOT be treated as successful finalization
      const mismatchResult = await finalizeAttempt({
        resumeId: uncResumeId,
        token: testToken,
        status: 'FAILED', // Mismatch: asking for FAILED, but live DB row is COMPLETED
        queryFn: async (sql, params) => query(sql, params),
      });
      if (mismatchResult.success !== false || mismatchResult.rowCount !== 0) {
        throw new Error('Status mismatch was incorrectly treated as success');
      }
    });

    await test('Finalization Failure: Persistent database failure triggers retry, logs CRITICAL, sanitizes error, and row remains recoverable', async () => {
      const uploadRes = await uploadFile(tokenA, 'persist_fail.pdf', createValidResumePdf(), 'application/pdf');
      const uploadBody = await uploadRes.json();
      const failResumeId = uploadBody.data.resume.resume_id;

      // 1. Valid UUID token
      const validToken = '88888888-8888-8888-8888-888888888888';

      // Seed row in database in PROCESSING state started 10 minutes ago
      await query(
        `UPDATE resumes
         SET extraction_status = 'PROCESSING',
             processing_token = $1,
             processing_started_at = NOW() - INTERVAL '10 minutes'
         WHERE resume_id = $2`,
        [validToken, failResumeId]
      );

      // 2. Mock genuine database connection failure on both finalization attempts
      let queryCallCount = 0;
      const failingQueryFn = async (sql, params) => {
        queryCallCount++;
        throw new Error('connection closed by remote peer (simulated network failure)');
      };

      // 3. Spy on console.error to verify structured critical logging
      const errorLogs = [];
      const originalConsoleError = console.error;
      console.error = (...args) => {
        errorLogs.push(args.join(' '));
        originalConsoleError(...args);
      };

      let caughtErr = null;
      try {
        await finalizeAttempt({
          resumeId: failResumeId,
          token: validToken,
          status: 'COMPLETED',
          text: 'Some extracted text',
          queryFn: failingQueryFn,
        });
      } catch (err) {
        caughtErr = err;
      } finally {
        console.error = originalConsoleError;
      }

      // Assertions:
      // a. Exactly 2 query attempts occurred (attempt 1 + 1 retry)
      if (queryCallCount !== 2) {
        throw new Error(`Expected exactly 2 finalization attempts, got ${queryCallCount}`);
      }

      // b. Verify structured critical error was logged
      const criticalLog = errorLogs.find((l) =>
        l.includes(`[PROCESSOR] [CRITICAL] Persistent database failure during finalization for resume ${failResumeId}`)
      );
      if (!criticalLog) {
        throw new Error('Structured [CRITICAL] log was not emitted');
      }

      // c. Verify client-facing error is sanitized
      if (!caughtErr) throw new Error('Expected finalizeAttempt to throw');
      if (caughtErr.statusCode !== 500) {
        throw new Error(`Expected status 500, got ${caughtErr.statusCode}`);
      }
      if (caughtErr.code !== 'INTERNAL_SERVER_ERROR') {
        throw new Error(`Expected code INTERNAL_SERVER_ERROR, got ${caughtErr.code}`);
      }
      if (caughtErr.message.includes('password') || caughtErr.message.includes('resumes') || caughtErr.message.includes('UPDATE')) {
        throw new Error('Raw SQL or schema leaked in error message');
      }

      // d. Verify row is NOT marked as finalized in database
      const { rows: dbRows } = await query(
        'SELECT extraction_status, processing_token, extracted_text FROM resumes WHERE resume_id = $1',
        [failResumeId]
      );
      if (dbRows[0].extraction_status !== 'PROCESSING') {
        throw new Error(`Row was marked as ${dbRows[0].extraction_status} instead of PROCESSING`);
      }
      if (dbRows[0].processing_token !== validToken) {
        throw new Error('Processing token was unexpectedly cleared');
      }
      if (dbRows[0].extracted_text !== null) {
        throw new Error('Extracted text was saved despite persistent failure');
      }

      // e. Verify row remains recoverable by stale recovery
      const recResult = await runStaleRecovery();
      if (recResult.recoveredCount < 1) {
        throw new Error('Stale recovery failed to reclaim row with persistent DB failure');
      }

      const { rows: recoveredRows } = await query(
        'SELECT extraction_status, processing_token, processing_error_code FROM resumes WHERE resume_id = $1',
        [failResumeId]
      );
      if (recoveredRows[0].extraction_status !== 'FAILED') {
        throw new Error(`Expected status FAILED after recovery, got ${recoveredRows[0].extraction_status}`);
      }
      if (recoveredRows[0].processing_token !== null) {
        throw new Error('Processing token not cleared after recovery');
      }
      if (recoveredRows[0].processing_error_code !== 'STALE_PROCESSING_TIMEOUT') {
        throw new Error(`Expected STALE_PROCESSING_TIMEOUT, got ${recoveredRows[0].processing_error_code}`);
      }
    });

    await test('Data Clearing: Starting a new attempt clears old error metadata and text', async () => {
      const uploadRes = await uploadFile(tokenA, 'dataclear.pdf', createValidResumePdf(), 'application/pdf');
      const uploadBody = await uploadRes.json();
      const clearResumeId = uploadBody.data.resume.resume_id;

      // Seed row with old error code and error message
      await query(
        `UPDATE resumes
         SET extraction_status = 'FAILED',
             processing_error_code = 'OLD_ERROR',
             processing_error_message = 'Old error message',
             extracted_text = 'Old text'
         WHERE resume_id = $1`,
        [clearResumeId]
      );

      // Start attempt 2
      const res = await callProcess(tokenA, clearResumeId);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

      // Verify DB row: error code, message are cleared
      const { rows } = await query(
        'SELECT processing_error_code, processing_error_message, extraction_status FROM resumes WHERE resume_id = $1',
        [clearResumeId]
      );
      if (rows[0].processing_error_code !== null) throw new Error('error_code was not cleared');
      if (rows[0].processing_error_message !== null) throw new Error('error_message was not cleared');
      if (rows[0].extraction_status !== 'COMPLETED') throw new Error('Status not COMPLETED');
    });

    await test('Startup Recovery: Resets orphaned PROCESSING rows to FAILED with SERVER_RESTARTED', async () => {
      const uploadRes = await uploadFile(tokenA, 'startup_rec.pdf', createValidResumePdf(), 'application/pdf');
      const uploadBody = await uploadRes.json();
      const startResumeId = uploadBody.data.resume.resume_id;

      // Simulate orphaned PROCESSING state from prior server process
      await query(
        `UPDATE resumes
         SET extraction_status = 'PROCESSING', processing_token = gen_random_uuid(), processing_started_at = CURRENT_TIMESTAMP
         WHERE resume_id = $1`,
        [startResumeId]
      );

      const recoveryResult = await runStartupRecovery();
      if (recoveryResult.recoveredCount < 1) throw new Error('Expected at least 1 recovered row');

      const { rows } = await query(
        'SELECT extraction_status, processing_token, processing_error_code FROM resumes WHERE resume_id = $1',
        [startResumeId]
      );
      if (rows[0].extraction_status !== 'FAILED') throw new Error('Expected status FAILED');
      if (rows[0].processing_token !== null) throw new Error('Expected processing_token NULL');
      if (rows[0].processing_error_code !== 'SERVER_RESTARTED') {
        throw new Error(`Expected SERVER_RESTARTED, got ${rows[0].processing_error_code}`);
      }
    });

    await test('Periodic Stale Recovery: Reclaims tasks running for > 5 minutes with STALE_PROCESSING_TIMEOUT', async () => {
      const uploadRes = await uploadFile(tokenA, 'stale_rec.pdf', createValidResumePdf(), 'application/pdf');
      const uploadBody = await uploadRes.json();
      const staleResumeId = uploadBody.data.resume.resume_id;

      // Simulate task started 10 minutes ago
      await query(
        `UPDATE resumes
         SET extraction_status = 'PROCESSING',
             processing_token = gen_random_uuid(),
             processing_started_at = NOW() - INTERVAL '10 minutes'
         WHERE resume_id = $1`,
        [staleResumeId]
      );

      const staleResult = await runStaleRecovery();
      if (staleResult.recoveredCount < 1) throw new Error('Expected at least 1 recovered stale row');

      const { rows } = await query(
        'SELECT extraction_status, processing_token, processing_error_code FROM resumes WHERE resume_id = $1',
        [staleResumeId]
      );
      if (rows[0].extraction_status !== 'FAILED') throw new Error('Expected status FAILED');
      if (rows[0].processing_token !== null) throw new Error('Expected processing_token NULL');
      if (rows[0].processing_error_code !== 'STALE_PROCESSING_TIMEOUT') {
        throw new Error(`Expected STALE_PROCESSING_TIMEOUT, got ${rows[0].processing_error_code}`);
      }
    });

    await test('Periodic Stale Recovery: Overlap guard prevents concurrent sweep execution', async () => {
      const [res1, res2] = await Promise.all([
        runStaleRecovery(),
        runStaleRecovery(),
      ]);

      // Exactly one should execute and one may be skipped if simultaneous
      if (!res1 || !res2) throw new Error('Expected recovery results');
    });

    await test('Sanitized Parser Errors: Malformed PDF returns user-safe CORRUPTED_DOCUMENT without leaking stack trace', async () => {
      // Upload a fake corrupted file disguised as PDF
      const fakePdf = Buffer.from('%PDF-1.4\ncorrupted content that fails parsing');
      const uploadRes = await uploadFile(tokenA, 'corrupt.pdf', fakePdf, 'application/pdf');
      const uploadBody = await uploadRes.json();
      const corruptResumeId = uploadBody.data.resume.resume_id;

      const res = await callProcess(tokenA, corruptResumeId);
      if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}`);

      const body = await res.json();
      if (body.code !== 'CORRUPTED_DOCUMENT') throw new Error(`Expected CORRUPTED_DOCUMENT, got ${body.code}`);
      if (body.stack !== undefined) throw new Error('Security leak: stack trace returned');
      if (body.message?.includes('pdfjs') || body.message?.includes('Error:')) {
        throw new Error('Raw parser error leaked to client');
      }
    });

  } finally {
    // Clean up test database users and resumes
    try {
      if (userA?.user_id) {
        await query('DELETE FROM users WHERE user_id = $1', [userA.user_id]);
      }
      if (userB?.user_id) {
        await query('DELETE FROM users WHERE user_id = $1', [userB.user_id]);
      }
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr.message);
    }

    // Close test HTTP server
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n====================================================');
  console.log(`Phase 6 Stage 3 Processing Suite: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
    throw new Error(`Stage 3 Processing Test Suite Failed with ${failed} failure(s)`);
  }
};

runProcessingTests().catch((err) => {
  console.error('Unhandled processing test suite failure:', err);
  process.exit(1);
});
