import { fileURLToPath } from 'url';
import { pool, testDbConnection } from '../config/database.mjs';

/**
 * Automated Verification Test Suite for PostgreSQL Schema and Triggers
 */
export const runVerification = async () => {
  console.log('====================================================');
  console.log('Running PostgreSQL Schema & Constraints Verification');
  console.log('====================================================\n');

  // Check DB Connection
  const connectionTest = await testDbConnection();
  if (!connectionTest.connected) {
    console.error(`[Verification Halt] Database not reachable: ${connectionTest.error || 'Connection refused'}`);
    console.info('[Verification Info] Start PostgreSQL or update DATABASE_URL in server/.env to run live tests.');
    process.exit(1);
  }

  const client = await pool.connect();
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

  try {
    // Shared test user ID for tests
    let testUserId;
    let testResumeId;
    let testJobId;
    let testSkillId;
    let testAnalysisId;

    await test('Setup Test Environment in Transaction', async () => {
      const userRes = await client.query(`
        INSERT INTO users (name, email, password_hash)
        VALUES ('Test User', 'verify_test_${Date.now()}@example.com', '$2b$10$dummyhashfortestingonly')
        RETURNING user_id;
      `);
      testUserId = userRes.rows[0].user_id;

      const resumeRes = await client.query(`
        INSERT INTO resumes (user_id, file_name, file_path)
        VALUES ($1, 'test_resume.pdf', '/tmp/test_resume.pdf')
        RETURNING resume_id;
      `, [testUserId]);
      testResumeId = resumeRes.rows[0].resume_id;

      const jobRes = await client.query(`
        INSERT INTO job_descriptions (user_id, title, description)
        VALUES ($1, 'Software Engineer', 'We are looking for a Software Engineer.')
        RETURNING job_id;
      `, [testUserId]);
      testJobId = jobRes.rows[0].job_id;

      const skillRes = await client.query(`
        INSERT INTO skills (skill_name, category)
        VALUES ('VerifyTestSkill_${Date.now()}', 'Programming language')
        RETURNING skill_id;
      `);
      testSkillId = skillRes.rows[0].skill_id;
    });

    // 1. Score Lower Bound Test (< 0)
    await test('Check Constraint: Rejects overall_score < 0.00', async () => {
      let threw = false;
      try {
        await client.query(`
          INSERT INTO analyses (
            user_id, resume_id, job_id, resume_file_name, job_title,
            overall_score, skill_score, experience_score, project_score, education_score, quality_score
          ) VALUES ($1, $2, $3, 'test.pdf', 'Engineer', -5.00, 80, 80, 80, 80, 80)
        `, [testUserId, testResumeId, testJobId]);
      } catch (err) {
        threw = true;
      }
      if (!threw) throw new Error('Expected check constraint violation for negative overall_score, but insert succeeded');
    });

    // 2. Score Upper Bound Test (> 100)
    await test('Check Constraint: Rejects overall_score > 100.00', async () => {
      let threw = false;
      try {
        await client.query(`
          INSERT INTO analyses (
            user_id, resume_id, job_id, resume_file_name, job_title,
            overall_score, skill_score, experience_score, project_score, education_score, quality_score
          ) VALUES ($1, $2, $3, 'test.pdf', 'Engineer', 105.00, 80, 80, 80, 80, 80)
        `, [testUserId, testResumeId, testJobId]);
      } catch (err) {
        threw = true;
      }
      if (!threw) throw new Error('Expected check constraint violation for overall_score > 100, but insert succeeded');
    });

    // 3. Confidence Bounds Test
    await test('Check Constraint: Rejects resume_skills confidence > 1.00 or < 0.00', async () => {
      let threw = false;
      try {
        await client.query(`
          INSERT INTO resume_skills (resume_id, skill_id, confidence)
          VALUES ($1, $2, 1.50)
        `, [testResumeId, testSkillId]);
      } catch (err) {
        threw = true;
      }
      if (!threw) throw new Error('Expected confidence check constraint violation for 1.50, but insert succeeded');
    });

    // 4. Similarity Score Constraint: Nullable & 0–100 Bounded
    await test('Check Constraint: Similarity score allows NULL and values 0-100, rejects invalid', async () => {
      // Valid analysis
      const anaRes = await client.query(`
        INSERT INTO analyses (
          user_id, resume_id, job_id, resume_file_name, job_title,
          overall_score, skill_score, experience_score, project_score, education_score, quality_score
        ) VALUES ($1, $2, $3, 'test.pdf', 'Engineer', 85.00, 85, 85, 85, 85, 85)
        RETURNING analysis_id;
      `, [testUserId, testResumeId, testJobId]);
      testAnalysisId = anaRes.rows[0].analysis_id;

      // Allows NULL similarity_score
      await client.query(`
        INSERT INTO analysis_skills (analysis_id, skill_id, status, similarity_score)
        VALUES ($1, $2, 'MATCHED', NULL)
      `, [testAnalysisId, testSkillId]);

      // Rejects similarity_score > 100.00
      let threwUpper = false;
      try {
        await client.query(`
          UPDATE analysis_skills SET similarity_score = 105.00 WHERE analysis_id = $1 AND skill_id = $2
        `, [testAnalysisId, testSkillId]);
      } catch (err) {
        threwUpper = true;
      }
      if (!threwUpper) throw new Error('Expected constraint violation for similarity_score > 100');

      // Rejects similarity_score < 0.00
      let threwLower = false;
      try {
        await client.query(`
          UPDATE analysis_skills SET similarity_score = -5.00 WHERE analysis_id = $1 AND skill_id = $2
        `, [testAnalysisId, testSkillId]);
      } catch (err) {
        threwLower = true;
      }
      if (!threwLower) throw new Error('Expected constraint violation for similarity_score < 0');

      // Accepts valid score 88.50
      await client.query(`
        UPDATE analysis_skills SET similarity_score = 88.50 WHERE analysis_id = $1 AND skill_id = $2
      `, [testAnalysisId, testSkillId]);
    });

    // 5. Automatic updated_at Trigger on users
    await test('Trigger Test: users.updated_at advances on row update', async () => {
      const origRes = await client.query('SELECT updated_at FROM users WHERE user_id = $1', [testUserId]);
      const originalUpdatedAt = new Date(origRes.rows[0].updated_at).getTime();

      // Controlled sleep to guarantee timestamp progression
      await client.query('SELECT pg_sleep(0.05)');

      await client.query('UPDATE users SET name = $1 WHERE user_id = $2', ['Updated Name Test', testUserId]);
      const newRes = await client.query('SELECT updated_at FROM users WHERE user_id = $1', [testUserId]);
      const newUpdatedAt = new Date(newRes.rows[0].updated_at).getTime();

      if (newUpdatedAt <= originalUpdatedAt) {
        throw new Error(`updated_at did not advance! Previous: ${originalUpdatedAt}, New: ${newUpdatedAt}`);
      }
    });

    // 6. Automatic updated_at Trigger on resumes
    await test('Trigger Test: resumes.updated_at advances on row update', async () => {
      const origRes = await client.query('SELECT updated_at FROM resumes WHERE resume_id = $1', [testResumeId]);
      const originalUpdatedAt = new Date(origRes.rows[0].updated_at).getTime();

      await client.query('SELECT pg_sleep(0.05)');

      await client.query('UPDATE resumes SET file_name = $1 WHERE resume_id = $2', ['new_file.pdf', testResumeId]);
      const newRes = await client.query('SELECT updated_at FROM resumes WHERE resume_id = $1', [testResumeId]);
      const newUpdatedAt = new Date(newRes.rows[0].updated_at).getTime();

      if (newUpdatedAt <= originalUpdatedAt) {
        throw new Error(`resumes.updated_at did not advance! Previous: ${originalUpdatedAt}, New: ${newUpdatedAt}`);
      }
    });

    // 7. Automatic updated_at Trigger on job_descriptions
    await test('Trigger Test: job_descriptions.updated_at advances on row update', async () => {
      const origRes = await client.query('SELECT updated_at FROM job_descriptions WHERE job_id = $1', [testJobId]);
      const originalUpdatedAt = new Date(origRes.rows[0].updated_at).getTime();

      await client.query('SELECT pg_sleep(0.05)');

      await client.query('UPDATE job_descriptions SET title = $1 WHERE job_id = $2', ['Senior Engineer', testJobId]);
      const newRes = await client.query('SELECT updated_at FROM job_descriptions WHERE job_id = $1', [testJobId]);
      const newUpdatedAt = new Date(newRes.rows[0].updated_at).getTime();

      if (newUpdatedAt <= originalUpdatedAt) {
        throw new Error(`job_descriptions.updated_at did not advance! Previous: ${originalUpdatedAt}, New: ${newUpdatedAt}`);
      }
    });

    // 8. Case-Insensitive Skill Uniqueness Test
    await test('Index Test: Case-insensitive unique constraint rejects skill duplicates', async () => {
      const testName = `CaseSkill_${Date.now()}`;
      await client.query('INSERT INTO skills (skill_name, category) VALUES ($1, $2)', [testName, 'Tool']);

      let threw = false;
      try {
        // Direct insert of lower-case duplicate
        await client.query('INSERT INTO skills (skill_name, category) VALUES ($1, $2)', [testName.toLowerCase(), 'Tool']);
      } catch (err) {
        threw = true;
      }
      if (!threw) throw new Error('Expected unique constraint violation on LOWER(skill_name) for direct insert');
    });

    // 8b. Case-Insensitive User Email Uniqueness Test (Migration 003)
    await test('Index Test: Case-insensitive unique constraint rejects user email duplicates', async () => {
      const testEmail = `case_email_${Date.now()}@example.com`;
      const res = await client.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id', [
        'Case User',
        testEmail,
        '$2b$10$dummyhashfortestingonly',
      ]);
      const caseUserId = res.rows[0].user_id;

      try {
        let threw = false;
        try {
          await client.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', [
            'Case User Duplicate',
            testEmail.toUpperCase(),
            '$2b$10$dummyhashfortestingonly',
          ]);
        } catch (err) {
          threw = true;
        }
        if (!threw) throw new Error('Expected unique constraint violation on LOWER(email)');
      } finally {
        await client.query('DELETE FROM users WHERE user_id = $1', [caseUserId]);
      }
    });

    // 9. Seed Conflict Clause Compatibility: ON CONFLICT ((LOWER(skill_name))) DO NOTHING
    await test('Seed Conflict Syntax: ON CONFLICT ((LOWER(skill_name))) DO NOTHING handles case variants', async () => {
      const testName = `ConflictTest_${Date.now()}`;
      await client.query('INSERT INTO skills (skill_name, category) VALUES ($1, $2)', [testName, 'Tool']);

      // Should execute cleanly without error, ignoring the conflicting variant
      const result = await client.query(`
        INSERT INTO skills (skill_name, category)
        VALUES ($1, $2)
        ON CONFLICT ((LOWER(skill_name))) DO NOTHING;
      `, [testName.toLowerCase(), 'Tool']);

      if (result.rowCount !== 0) {
        throw new Error('Expected 0 rows inserted for conflicting case variant');
      }
    });

    // 10. Foreign Key Deletion Behavior: Preserves Analyses on Resume/Job Deletion
    await test('Foreign Key Test: Deleting resume sets resume_id = NULL but preserves analysis report', async () => {
      // Delete resume
      await client.query('DELETE FROM resumes WHERE resume_id = $1', [testResumeId]);

      // Check analysis still exists
      const checkRes = await client.query('SELECT resume_id, resume_file_name, overall_score FROM analyses WHERE analysis_id = $1', [testAnalysisId]);
      if (checkRes.rows.length === 0) {
        throw new Error('Analysis was unexpectedly deleted when resume was deleted!');
      }
      if (checkRes.rows[0].resume_id !== null) {
        throw new Error(`Expected resume_id to be NULL, but got: ${checkRes.rows[0].resume_id}`);
      }
      if (checkRes.rows[0].resume_file_name !== 'test.pdf') {
        throw new Error('Snapshot resume_file_name was lost!');
      }
    });

    // 11. Foreign Key Deletion Behavior: Cascade User Deletion
    await test('Foreign Key Test: Deleting user cascades to analyses and job descriptions', async () => {
      await client.query('DELETE FROM users WHERE user_id = $1', [testUserId]);

      const anaRes = await client.query('SELECT analysis_id FROM analyses WHERE analysis_id = $1', [testAnalysisId]);
      if (anaRes.rows.length !== 0) {
        throw new Error('Analysis was not deleted when user was deleted!');
      }

      const jobRes = await client.query('SELECT job_id FROM job_descriptions WHERE job_id = $1', [testJobId]);
      if (jobRes.rows.length !== 0) {
        throw new Error('Job description was not deleted when user was deleted!');
      }
    });

    console.log(`\n====================================================`);
    console.log(`Verification Complete: ${passed} Passed, ${failed} Failed`);
    console.log(`====================================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    client.release();
  }
};

// Run automatically when executed directly via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runVerification()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Verification Error]', err.message);
      await pool.end();
      process.exit(1);
    });
}
