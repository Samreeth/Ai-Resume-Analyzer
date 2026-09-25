import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../src/app.mjs';
import config from '../src/config/env.mjs';
import { pool, query, testDbConnection } from '../src/config/database.mjs';
import { generateToken, registerUser } from '../src/services/auth.service.mjs';
import storageService from '../src/services/storage.service.mjs';
import resumeService from '../src/services/resume.service.mjs';
import {
  detectFormatFromMagicBytes,
  validateDocxArchive,
  sanitizeDisplayName,
  resolveSecurePath,
  computeFileHash,
} from '../src/utils/file.util.mjs';
import {
  createTestPdf,
  createTestDocx,
  createInvalidDocxWithDocument2,
  createGenericZip,
  createMissingContentTypesZip,
  createCorruptedZip,
  createZipWithManyEntries,
  createZipWithLongName,
  createZipWithPathTraversal,
} from './fixtures.mjs';

export const runResumeTests = async () => {
  console.log('====================================================');
  console.log('Running Phase 5: Secure Resume Upload & Lifecycle Tests');
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
      failed++;
    }
  };

  // ==========================================================================
  // 1. Unit Tests: File Security & Format Inspection
  // ==========================================================================
  await test('Magic Bytes: Detects PDF and ZIP/DOCX signatures accurately', async () => {
    const pdf = createTestPdf();
    const docx = createTestDocx();
    const fake = Buffer.from('plain_text_file_not_binary');

    if (detectFormatFromMagicBytes(pdf) !== 'pdf') {
      throw new Error('Valid PDF magic bytes failed detection');
    }
    if (detectFormatFromMagicBytes(docx) !== 'docx') {
      throw new Error('Valid DOCX/ZIP magic bytes failed detection');
    }
    if (detectFormatFromMagicBytes(fake) !== null) {
      throw new Error('Arbitrary text was falsely recognized as valid format');
    }
  });

  await test('DOCX Validator: Accepts valid DOCX with [Content_Types].xml and word/document.xml', async () => {
    const validDocx = createTestDocx();
    const isValid = await validateDocxArchive(validDocx);
    if (!isValid) throw new Error('Valid DOCX archive was rejected');
  });

  await test('DOCX Validator: Rejects generic ZIP archives lacking word/document.xml', async () => {
    const generic = createGenericZip();
    const isValid = await validateDocxArchive(generic);
    if (isValid) throw new Error('Generic ZIP was accepted as DOCX');
  });

  await test('DOCX Validator: Strictly rejects word/document2.xml substitution', async () => {
    const docx2 = createInvalidDocxWithDocument2();
    const isValid = await validateDocxArchive(docx2);
    if (isValid) throw new Error('word/document2.xml was accepted as substitute');
  });

  await test('DOCX Validator: Rejects archive missing root [Content_Types].xml', async () => {
    const missingCt = createMissingContentTypesZip();
    const isValid = await validateDocxArchive(missingCt);
    if (isValid) throw new Error('Archive missing [Content_Types].xml was accepted');
  });

  await test('DOCX Validator: Safely handles corrupted or truncated ZIP archives', async () => {
    const corrupt = createCorruptedZip();
    const isValid = await validateDocxArchive(corrupt);
    if (isValid) throw new Error('Corrupted archive was accepted');
  });

  await test('DOCX Validator: Rejects archives exceeding 1,000 entries threshold', async () => {
    const manyEntries = createZipWithManyEntries(1005);
    const isValid = await validateDocxArchive(manyEntries);
    if (isValid) throw new Error('Archive with > 1000 entries was accepted');
  });

  await test('DOCX Validator: Rejects entry names exceeding 255 characters', async () => {
    const longNameZip = createZipWithLongName();
    const isValid = await validateDocxArchive(longNameZip);
    if (isValid) throw new Error('Archive with > 255 char entry name was accepted');
  });

  await test('DOCX Validator: Rejects path traversal and absolute entry names', async () => {
    const traversalZip = createZipWithPathTraversal();
    const isValid = await validateDocxArchive(traversalZip);
    if (isValid) throw new Error('Archive with traversal entry was accepted');
  });

  await test('Display Name Sanitizer: Strips path traversal, injection chars, and limits length', async () => {
    const malicious = '../../etc/passwd<script>alert(1)</script>.pdf';
    const clean = sanitizeDisplayName(malicious, '.pdf');

    if (clean.includes('..') || clean.includes('/') || clean.includes('<') || clean.includes('>')) {
      throw new Error(`Sanitizer failed to remove hazardous characters: ${clean}`);
    }

    const longName = 'a'.repeat(300) + '.pdf';
    const truncated = sanitizeDisplayName(longName, '.pdf');
    if (truncated.length > 255) {
      throw new Error(`Sanitizer failed to truncate length: ${truncated.length}`);
    }

    const empty = sanitizeDisplayName('', '.pdf');
    if (empty !== 'resume.pdf') {
      throw new Error(`Sanitizer fallback failed for empty input: ${empty}`);
    }
  });

  await test('Path Jail Validator: Enforces resumes/<uuid>.<ext> pattern and blocks traversal', async () => {
    const validRelative = 'resumes/12345678-1234-1234-1234-123456789abc.pdf';
    const resolved = resolveSecurePath(validRelative);
    const expectedPrefix = path.resolve(config.uploadDir, 'resumes');

    if (!resolved.startsWith(expectedPrefix + path.sep)) {
      throw new Error(`Resolved path escaped upload root: ${resolved}`);
    }

    // Traversal test
    let threwTraversal = false;
    try {
      resolveSecurePath('resumes/../../app.mjs');
    } catch (err) {
      threwTraversal = true;
    }
    if (!threwTraversal) throw new Error('Path traversal sequence was not caught');

    // Invalid format test
    let threwInvalid = false;
    try {
      resolveSecurePath('resumes/not-a-uuid.pdf');
    } catch (err) {
      threwInvalid = true;
    }
    if (!threwInvalid) throw new Error('Non-UUID path format was not rejected');
  });

  await test('Storage Failure Handling: Staged write cleans up .tmp_* file if rename fails', async () => {
    const originalRename = fs.promises.rename;
    const testBuffer = Buffer.from('test_data');
    let simulatedRenameFailed = false;

    try {
      fs.promises.rename = async () => {
        simulatedRenameFailed = true;
        const err = new Error('Simulated rename I/O failure');
        err.code = 'EIO';
        throw err;
      };

      let threw = false;
      try {
        await storageService.saveFileAtomic(testBuffer, '.pdf');
      } catch (err) {
        threw = true;
      }
      if (!threw) throw new Error('saveFileAtomic did not throw on rename failure');

      // Verify no temporary files remain in resumesDir
      const resumesDir = path.resolve(config.uploadDir, 'resumes');
      if (fs.existsSync(resumesDir)) {
        const files = await fs.promises.readdir(resumesDir);
        const tempFiles = files.filter((f) => f.startsWith('.tmp_'));
        if (tempFiles.length > 0) {
          throw new Error(`Orphaned temporary files found after rename failure: ${tempFiles.join(', ')}`);
        }
      }
    } finally {
      fs.promises.rename = originalRename;
    }
  });

  await test('Storage Failure Handling: Database rollback unlinks physical file if DB fails', async () => {
    const originalQuery = pool.query;
    const originalConnect = pool.connect;
    let savedFileRelative = null;

    try {
      // Mock pool.connect to simulate DB failure during insert
      pool.connect = async () => {
        return {
          query: async (text) => {
            if (text.includes('INSERT INTO resumes')) {
              const dbErr = new Error('Simulated DB constraint failure');
              dbErr.code = '23505';
              throw dbErr;
            }
            return { rows: [] };
          },
          release: () => {},
        };
      };

      let threw = false;
      try {
        await resumeService.createResume({
          userId: '11111111-1111-1111-1111-111111111111',
          originalName: 'rollback_test.pdf',
          buffer: createTestPdf(),
          mimeType: 'application/pdf',
        });
      } catch (err) {
        threw = true;
      }
      if (!threw) throw new Error('createResume did not throw on simulated DB failure');

      // Verify no permanent orphaned files remain in resumesDir
      const resumesDir = path.resolve(config.uploadDir, 'resumes');
      if (fs.existsSync(resumesDir)) {
        const files = await fs.promises.readdir(resumesDir);
        const tempFiles = files.filter((f) => f.startsWith('.tmp_'));
        if (tempFiles.length > 0) {
          throw new Error(`Orphaned temporary files found: ${tempFiles.join(', ')}`);
        }
      }
    } finally {
      pool.connect = originalConnect;
      pool.query = originalQuery;
    }
  });

  await test('Storage Failure Handling: Unlink failure logs CRITICAL error without throwing unhandled exception', async () => {
    const originalUnlink = fs.promises.unlink;
    let criticalErrorLogged = false;
    const originalConsoleError = console.error;

    try {
      console.error = (msg) => {
        if (typeof msg === 'string' && msg.includes('[CRITICAL STORAGE FAILURE]')) {
          criticalErrorLogged = true;
        }
      };

      fs.promises.unlink = async () => {
        const err = new Error('Permission denied');
        err.code = 'EACCES';
        throw err;
      };

      let threw = false;
      try {
        await storageService.deleteFile('resumes/12345678-1234-1234-1234-123456789abc.pdf', 'test-resume-id');
      } catch (err) {
        threw = true;
      }
      if (!threw) throw new Error('deleteFile did not rethrow OS unlink error for logging');
      if (!criticalErrorLogged) throw new Error('deleteFile did not log [CRITICAL STORAGE FAILURE]');
    } finally {
      fs.promises.unlink = originalUnlink;
      console.error = originalConsoleError;
    }
  });

  // ==========================================================================
  // 2. Integration Tests: Live HTTP Server + PostgreSQL Database
  // ==========================================================================
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
  const userAEmail = `user_a_${timestamp}@example.com`;
  const userBEmail = `user_b_${timestamp}@example.com`;
  const password = 'Password123!Secure';

  let userA, userB, tokenA, tokenB;
  let userAResumeId, userADocxResumeId;

  try {
    // Register User A
    userA = await registerUser({ name: 'User A', email: userAEmail, password });
    tokenA = generateToken(userA);

    // Register User B
    userB = await registerUser({ name: 'User B', email: userBEmail, password });
    tokenB = generateToken(userB);

    // Helper to send multipart uploads via fetch
    const uploadFile = async (token, fileName, buffer, mimeType, fieldName = 'resume') => {
      const formData = new FormData();
      formData.append(fieldName, new Blob([buffer], { type: mimeType }), fileName);

      return fetch(`${baseUrl}/api/resumes`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: formData,
      });
    };

    await test('HTTP POST /api/resumes: Valid PDF upload returns 201 with safe metadata & status PENDING', async () => {
      const pdfBuffer = createTestPdf();
      const res = await uploadFile(tokenA, 'my_resume.pdf', pdfBuffer, 'application/pdf');

      if (res.status !== 201) {
        const body = await res.text();
        throw new Error(`Expected 201, got ${res.status}: ${body}`);
      }

      const body = await res.json();
      const resume = body.data?.resume;

      if (!resume || !resume.resume_id) throw new Error('Missing resume in response data');
      if (resume.file_name !== 'my_resume.pdf') throw new Error(`Unexpected file_name: ${resume.file_name}`);
      if (resume.file_size !== pdfBuffer.length) throw new Error(`Unexpected file_size: ${resume.file_size}`);
      if (resume.mime_type !== 'application/pdf') throw new Error(`Unexpected mime_type: ${resume.mime_type}`);
      if (resume.extraction_status !== 'PENDING') throw new Error(`Unexpected status: ${resume.extraction_status}`);
      if (resume.file_path) throw new Error('Security leak: internal file_path exposed in API response');

      userAResumeId = resume.resume_id;

      // Verify physical disk file exists
      const { rows } = await query('SELECT file_path FROM resumes WHERE resume_id = $1', [userAResumeId]);
      const storedPath = rows[0]?.file_path;
      const physicalPath = path.resolve(config.uploadDir, storedPath);

      if (!fs.existsSync(physicalPath)) {
        throw new Error(`Physical file does not exist on disk at: ${physicalPath}`);
      }
    });

    await test('HTTP POST /api/resumes: Valid DOCX upload returns 201 with verified mime_type', async () => {
      const docxBuffer = createTestDocx();
      const res = await uploadFile(
        tokenA,
        'doc_resume.docx',
        docxBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      if (res.status !== 201) {
        const body = await res.text();
        throw new Error(`Expected 201, got ${res.status}: ${body}`);
      }

      const body = await res.json();
      userADocxResumeId = body.data?.resume?.resume_id;

      if (body.data?.resume?.mime_type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        throw new Error(`Unexpected mime_type: ${body.data?.resume?.mime_type}`);
      }
    });

    await test('HTTP POST /api/resumes: Rejects unauthenticated upload with HTTP 401', async () => {
      const res = await uploadFile(null, 'test.pdf', createTestPdf(), 'application/pdf');
      if (res.status !== 401) throw new Error(`Expected 401, got: ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'AUTHENTICATION_ERROR') throw new Error('Expected AUTHENTICATION_ERROR code');
    });

    await test('HTTP POST /api/resumes: Rejects generic ZIP disguised as DOCX with HTTP 415', async () => {
      const genericZip = createGenericZip();
      const res = await uploadFile(
        tokenA,
        'generic.docx',
        genericZip,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      if (res.status !== 415) {
        const body = await res.text();
        throw new Error(`Expected 415, got ${res.status}: ${body}`);
      }

      const body = await res.json();
      if (body.error?.code !== 'UNSUPPORTED_MEDIA_TYPE') throw new Error('Expected UNSUPPORTED_MEDIA_TYPE code');
    });

    await test('HTTP POST /api/resumes: Rejects DOCX with document2.xml substitution with HTTP 415', async () => {
      const docx2 = createInvalidDocxWithDocument2();
      const res = await uploadFile(
        tokenA,
        'invalid.docx',
        docx2,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      if (res.status !== 415) throw new Error(`Expected 415, got ${res.status}`);
    });

    await test('HTTP POST /api/resumes: Rejects corrupted ZIP payload with HTTP 415', async () => {
      const corrupt = createCorruptedZip();
      const res = await uploadFile(
        tokenA,
        'corrupt.docx',
        corrupt,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      if (res.status !== 415) throw new Error(`Expected 415, got ${res.status}`);
    });

    await test('HTTP POST /api/resumes: Rejects MIME and extension mismatch with HTTP 415', async () => {
      // PDF extension with DOCX MIME
      const res = await uploadFile(
        tokenA,
        'mismatch.pdf',
        createTestPdf(),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      if (res.status !== 415) throw new Error(`Expected 415, got ${res.status}`);
    });

    await test('HTTP POST /api/resumes: Rejects non-whitelisted file extension with HTTP 415', async () => {
      const res = await uploadFile(tokenA, 'script.exe', Buffer.from('MZ_exe'), 'application/x-msdownload');
      if (res.status !== 415) throw new Error(`Expected 415, got ${res.status}`);
    });

    await test('HTTP POST /api/resumes: Rejects empty (0-byte) file with HTTP 400 VALIDATION_ERROR', async () => {
      const res = await uploadFile(tokenA, 'empty.pdf', Buffer.alloc(0), 'application/pdf');
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('HTTP POST /api/resumes: Rejects missing "resume" field with HTTP 400 VALIDATION_ERROR', async () => {
      const res = await uploadFile(tokenA, 'test.pdf', createTestPdf(), 'application/pdf', 'wrong_field_name');
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('HTTP POST /api/resumes: Rejects oversized file (> 5 MB) with HTTP 413 FILE_TOO_LARGE', async () => {
      // Create 5.1 MB buffer starting with %PDF- header
      const header = Buffer.from('%PDF-1.4\n');
      const largeBuffer = Buffer.concat([header, Buffer.alloc(5.1 * 1024 * 1024)]);

      const res = await uploadFile(tokenA, 'large.pdf', largeBuffer, 'application/pdf');
      if (res.status !== 413) throw new Error(`Expected 413, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'FILE_TOO_LARGE') throw new Error('Expected FILE_TOO_LARGE code');
    });

    await test('Duplicate Upload Policy: Re-uploading identical file succeeds and stores matching file_hash', async () => {
      const pdfBuffer = createTestPdf();
      const res = await uploadFile(tokenA, 'duplicate_resume.pdf', pdfBuffer, 'application/pdf');
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);

      const body = await res.json();
      const secondResumeId = body.data?.resume?.resume_id;

      if (secondResumeId === userAResumeId) {
        throw new Error('Duplicate upload should generate a new distinct resume_id');
      }

      // Confirm matching SHA-256 hash
      const { rows } = await query(
        'SELECT file_hash FROM resumes WHERE resume_id IN ($1, $2)',
        [userAResumeId, secondResumeId]
      );
      if (rows.length !== 2 || rows[0].file_hash !== rows[1].file_hash) {
        throw new Error('Duplicate uploads did not store identical file_hash');
      }

      // Clean up second upload
      await resumeService.deleteResumeById({ userId: userA.user_id, resumeId: secondResumeId });
    });

    await test('HTTP GET /api/resumes: Lists only authenticated user resumes with pagination', async () => {
      // User A list
      const resA = await fetch(`${baseUrl}/api/resumes?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (resA.status !== 200) throw new Error(`Expected 200, got ${resA.status}`);
      const dataA = await resA.json();

      if (!Array.isArray(dataA.data?.resumes)) throw new Error('Expected resumes array');
      if (dataA.data?.pagination?.total < 2) throw new Error('Expected at least 2 resumes for User A');

      // User B list (should be completely empty)
      const resB = await fetch(`${baseUrl}/api/resumes?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      if (resB.status !== 200) throw new Error(`Expected 200, got ${resB.status}`);
      const dataB = await resB.json();
      if (dataB.data?.pagination?.total !== 0 || dataB.data?.resumes.length !== 0) {
        throw new Error('User B was able to see User A resumes!');
      }

      // Safe pagination bounds: limit=1000 capped at 50
      const resCapped = await fetch(`${baseUrl}/api/resumes?page=1&limit=1000`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (resCapped.status !== 400) {
        throw new Error('Limit > 50 was not caught by pagination validator');
      }
    });

    await test('HTTP GET /api/resumes/:resumeId: Owner successfully retrieves details with safe metadata', async () => {
      const res = await fetch(`${baseUrl}/api/resumes/${userAResumeId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();

      if (!body.success) throw new Error('Expected success: true');
      const resume = body.data?.resume;
      if (!resume) throw new Error('Expected resume object in response data');
      if (resume.resume_id !== userAResumeId) throw new Error('Resume ID mismatch');
      if (resume.file_name !== 'my_resume.pdf') throw new Error(`Unexpected file_name: ${resume.file_name}`);
      if (!resume.file_size || resume.file_size <= 0) throw new Error('Expected valid positive file_size');
      if (resume.mime_type !== 'application/pdf') throw new Error(`Unexpected mime_type: ${resume.mime_type}`);
      if (!resume.file_hash || resume.file_hash.length !== 64) throw new Error('Expected valid 64-char SHA-256 hash');
      if (resume.extraction_status !== 'PENDING') throw new Error(`Expected PENDING status, got ${resume.extraction_status}`);
      if (resume.file_path !== undefined) throw new Error('SECURITY VIOLATION: Internal file_path exposed in API response!');
    });

    await test('IDOR Protection GET: User B cannot access User A resume (returns 404)', async () => {
      const res = await fetch(`${baseUrl}/api/resumes/${userAResumeId}`, {
        headers: { Authorization: `Bearer ${tokenB}` }, // User B token
      });
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== 'RESOURCE_NOT_FOUND') throw new Error('Expected RESOURCE_NOT_FOUND');
    });

    await test('IDOR Protection DELETE: User B cannot delete User A resume (returns 404)', async () => {
      const res = await fetch(`${baseUrl}/api/resumes/${userAResumeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenB}` }, // User B token
      });
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);

      // Verify User A resume still exists in DB and disk
      const { rows } = await query('SELECT resume_id FROM resumes WHERE resume_id = $1', [userAResumeId]);
      if (rows.length === 0) throw new Error('User A resume was deleted by User B!');
    });

    await test('HTTP DELETE /api/resumes/:resumeId: Deletes record and unlinks physical file', async () => {
      // Find physical file path before delete
      const { rows } = await query('SELECT file_path FROM resumes WHERE resume_id = $1', [userADocxResumeId]);
      const physicalPath = path.resolve(config.uploadDir, rows[0].file_path);

      if (!fs.existsSync(physicalPath)) {
        throw new Error('Physical file did not exist prior to deletion');
      }

      // Execute delete
      const res = await fetch(`${baseUrl}/api/resumes/${userADocxResumeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

      // Verify DB row deleted
      const checkDb = await query('SELECT resume_id FROM resumes WHERE resume_id = $1', [userADocxResumeId]);
      if (checkDb.rows.length !== 0) throw new Error('Resume DB record still exists after deletion');

      // Verify physical file unlinked
      if (fs.existsSync(physicalPath)) {
        throw new Error('Physical file still exists on disk after deletion!');
      }
    });

    await test('Analysis Preservation: Deleting resume sets analyses.resume_id = NULL while preserving report', async () => {
      // Insert an analysis referencing userAResumeId
      const anaRes = await query(`
        INSERT INTO analyses (
          user_id, resume_id, resume_file_name, job_title,
          overall_score, skill_score, experience_score, project_score, education_score, quality_score
        ) VALUES (
          $1, $2, 'my_resume.pdf', 'Software Engineer',
          85, 85, 85, 85, 85, 85
        ) RETURNING analysis_id;
      `, [userA.user_id, userAResumeId]);
      const analysisId = anaRes.rows[0].analysis_id;

      // Delete userAResumeId
      await resumeService.deleteResumeById({ userId: userA.user_id, resumeId: userAResumeId });

      // Verify analysis record remains, with resume_id set to NULL
      const checkAna = await query(
        'SELECT analysis_id, resume_id, resume_file_name, overall_score FROM analyses WHERE analysis_id = $1',
        [analysisId]
      );

      if (checkAna.rows.length === 0) {
        throw new Error('Analysis record was deleted when resume was deleted!');
      }
      if (checkAna.rows[0].resume_id !== null) {
        throw new Error(`Expected resume_id to be NULL, but got: ${checkAna.rows[0].resume_id}`);
      }
      if (checkAna.rows[0].resume_file_name !== 'my_resume.pdf') {
        throw new Error('Snapshot resume_file_name was lost');
      }

      // Clean up analysis
      await query('DELETE FROM analyses WHERE analysis_id = $1', [analysisId]);
    });
  } finally {
    // Teardown test users
    if (userA?.user_id) await query('DELETE FROM users WHERE user_id = $1', [userA.user_id]);
    if (userB?.user_id) await query('DELETE FROM users WHERE user_id = $1', [userB.user_id]);

    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  console.log(`\n====================================================`);
  console.log(`Phase 5 Resume Suite: ${passed} Passed, ${failed} Failed`);
  console.log(`====================================================`);

  if (failed > 0) {
    process.exit(1);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runResumeTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Resume Test Fatal Error]', err);
      process.exit(1);
    });
}
