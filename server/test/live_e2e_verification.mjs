import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../src/app.mjs';
import { query, pool, testDbConnection } from '../src/config/database.mjs';
import config from '../src/config/env.mjs';

const runLiveE2E = async () => {
  console.log('================================================================');
  console.log('Phase 4: Real PostgreSQL & Live HTTP End-to-End Verification');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assertTest = (name, condition, detail = '') => {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}${detail ? ': ' + detail : ''}`);
      failed++;
    }
  };

  // 1. Database Availability & Configuration
  const dbStatus = await testDbConnection();
  if (!dbStatus.connected) {
    console.error(`[FATAL] Database connection failed: ${dbStatus.error}`);
    process.exit(1);
  }
  console.log(`[Database Connected] Timestamp: ${dbStatus.timestamp}`);

  // 2. Migration System & Schema Verification
  const { rows: migrations } = await query('SELECT name, checksum, executed_at FROM schema_migrations ORDER BY id ASC');
  console.log(`\n[Migrations Found in DB]: ${migrations.length}`);
  migrations.forEach((m, idx) => console.log(`  ${idx + 1}. ${m.name} (SHA-256: ${m.checksum.slice(0, 16)}...)`));

  assertTest('Migration 001 recorded', migrations.some((m) => m.name === '001_create_tables.sql'));
  assertTest('Migration 002 recorded', migrations.some((m) => m.name === '002_create_indexes.sql'));
  assertTest('Migration 003 recorded', migrations.some((m) => m.name === '003_case_insensitive_user_email.sql'));

  // 3. Case-Insensitive Email Index in PostgreSQL
  const { rows: indexRows } = await query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'users' AND indexname = 'idx_users_lower_email';
  `);
  assertTest(
    'PostgreSQL Index: idx_users_lower_email exists and indexes LOWER(email)',
    indexRows.length === 1 && indexRows[0].indexdef.includes('lower(')
  );

  // Start ephemeral HTTP server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`\n[Live Test Server Active] http://127.0.0.1:${port}\n`);

  try {
    // 4. Real Registration Flow
    const testEmailRaw = '  Alice.Hardened@Example.COM  ';
    const testEmailNormalized = 'alice.hardened@example.com';
    const testPassword = 'RealStrongPass123!';
    const testName = 'Alice Hardened';

    // Ensure clean state for test email
    await query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [testEmailNormalized]);

    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: testName,
        email: testEmailRaw,
        password: testPassword,
      }),
    });

    const regData = await regRes.json();
    assertTest('Real Registration: HTTP 201 Created', regRes.status === 201);
    assertTest(
      'Real Registration: Safe payload excludes password and password_hash',
      regData.data?.user?.user_id &&
        regData.data?.user?.password === undefined &&
        regData.data?.user?.password_hash === undefined
    );
    assertTest(
      'Real Registration: Email normalized to lowercase in response',
      regData.data?.user?.email === testEmailNormalized
    );

    const createdUserId = regData.data?.user?.user_id;

    // Direct Database Inspection of Stored Record
    const { rows: dbUserRows } = await query(
      'SELECT user_id, name, email, password_hash FROM users WHERE user_id = $1',
      [createdUserId]
    );
    const dbUser = dbUserRows[0];
    assertTest('PostgreSQL Persistence: User row exists in users table', !!dbUser);
    assertTest('PostgreSQL Persistence: Email normalized in database', dbUser?.email === testEmailNormalized);
    assertTest(
      'PostgreSQL Persistence: Stored password is valid bcrypt hash ($2b$10$)',
      dbUser?.password_hash && dbUser.password_hash.startsWith('$2b$10$')
    );
    assertTest(
      'PostgreSQL Persistence: Plaintext password is NEVER stored in database',
      dbUser?.password_hash !== testPassword
    );

    // Duplicate Registration Handling: Case Variant
    const dupCaseRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Duplicate Case',
        email: 'ALICE.HARDENED@EXAMPLE.COM',
        password: 'AnotherPassword123!',
      }),
    });
    const dupCaseData = await dupCaseRes.json();
    assertTest('Duplicate Registration: Uppercase variant rejected with HTTP 400', dupCaseRes.status === 400);
    assertTest('Duplicate Registration: Returns VALIDATION_ERROR code', dupCaseData.error?.code === 'VALIDATION_ERROR');

    // Duplicate Registration Handling: Padded Variant
    const dupPadRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Duplicate Padded',
        email: `   ${testEmailNormalized}   `,
        password: 'AnotherPassword123!',
      }),
    });
    const dupPadData = await dupPadRes.json();
    assertTest('Duplicate Registration: Padded variant rejected with HTTP 400', dupPadRes.status === 400);
    assertTest('Duplicate Registration: Returns VALIDATION_ERROR code', dupPadData.error?.code === 'VALIDATION_ERROR');

    // 5. Real Login Flow
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailNormalized,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    assertTest('Real Login: HTTP 200 OK', loginRes.status === 200);
    assertTest('Real Login: Returns signed token', typeof loginData.data?.token === 'string');
    assertTest('Real Login: Safe payload excludes password_hash', loginData.data?.user?.password_hash === undefined);

    const authToken = loginData.data?.token;

    // GET /api/auth/me with valid token
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const meData = await meRes.json();
    assertTest('Profile GET /api/auth/me: HTTP 200 OK', meRes.status === 200);
    assertTest('Profile GET /api/auth/me: User ID matches', meData.data?.user?.user_id === createdUserId);
    assertTest('Profile GET /api/auth/me: Safe payload excludes password_hash', meData.data?.user?.password_hash === undefined);

    // Incorrect password login
    const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailNormalized,
        password: 'WrongPassword999!',
      }),
    });
    const wrongPassData = await wrongPassRes.json();
    assertTest('Invalid Password: HTTP 401 Unauthorized', wrongPassRes.status === 401);
    assertTest('Invalid Password: Returns AUTHENTICATION_ERROR', wrongPassData.error?.code === 'AUTHENTICATION_ERROR');
    assertTest('Invalid Password: Uses generic message', wrongPassData.error?.message === 'Invalid email or password');

    // Nonexistent email login
    const nonExistRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ghost_user_does_not_exist@example.com',
        password: 'AnyPassword123!',
      }),
    });
    const nonExistData = await nonExistRes.json();
    assertTest('Nonexistent Email: HTTP 401 Unauthorized', nonExistRes.status === 401);
    assertTest('Nonexistent Email: Returns AUTHENTICATION_ERROR', nonExistData.error?.code === 'AUTHENTICATION_ERROR');
    assertTest(
      'Timing-Safe Consistency: Nonexistent email message exactly equals wrong password message',
      nonExistData.error?.message === wrongPassData.error?.message
    );

    // 6. Token Verification via HTTP
    // 6a. Expired Token
    const expiredToken = jwt.sign(
      { userId: createdUserId, email: testEmailNormalized, name: testName },
      config.jwtSecret,
      { expiresIn: '-10s', algorithm: 'HS256' }
    );
    const expRes = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${expiredToken}` } });
    const expData = await expRes.json();
    assertTest('Token Rejection: Expired token returns HTTP 401', expRes.status === 401);
    assertTest('Token Rejection: Expired token returns AUTHENTICATION_ERROR', expData.error?.code === 'AUTHENTICATION_ERROR');

    // 6b. Tampered Token
    const tamperedToken = authToken.slice(0, -6) + 'abcdef';
    const tampRes = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${tamperedToken}` } });
    const tampData = await tampRes.json();
    assertTest('Token Rejection: Tampered token returns HTTP 401', tampRes.status === 401);
    assertTest('Token Rejection: Tampered token returns AUTHENTICATION_ERROR', tampData.error?.code === 'AUTHENTICATION_ERROR');

    // 6c. Invalid Signature
    const forgedToken = jwt.sign(
      { userId: createdUserId, email: testEmailNormalized },
      'forged_untrusted_secret_key_1234567890',
      { algorithm: 'HS256' }
    );
    const forgeRes = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${forgedToken}` } });
    const forgeData = await forgeRes.json();
    assertTest('Token Rejection: Invalid signature returns HTTP 401', forgeRes.status === 401);
    assertTest('Token Rejection: Invalid signature returns AUTHENTICATION_ERROR', forgeData.error?.code === 'AUTHENTICATION_ERROR');

    // 6d. Unsupported Algorithm (HS512)
    const hs512Token = jwt.sign(
      { userId: createdUserId, email: testEmailNormalized },
      config.jwtSecret,
      { algorithm: 'HS512' }
    );
    const algRes = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${hs512Token}` } });
    const algData = await algRes.json();
    assertTest('Token Rejection: Unsupported algorithm HS512 returns HTTP 401', algRes.status === 401);
    assertTest('Token Rejection: Unsupported algorithm returns AUTHENTICATION_ERROR', algData.error?.code === 'AUTHENTICATION_ERROR');

    // 6e. Missing Authorization Header
    const noHeaderRes = await fetch(`${baseUrl}/api/auth/me`);
    assertTest('Header Rejection: Missing Authorization header returns HTTP 401', noHeaderRes.status === 401);

    // 6f. Basic Auth Header
    const basicRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    assertTest('Header Rejection: Basic auth header returns HTTP 401', basicRes.status === 401);

    // 6g. Empty Bearer Token
    const emptyBearerRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer ' },
    });
    assertTest('Header Rejection: Empty Bearer token returns HTTP 401', emptyBearerRes.status === 401);

    // 7. Deleted User Flow
    // Create dedicated user for deletion test
    const delEmail = `del_${Date.now()}@example.com`;
    const delRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Del User', email: delEmail, password: 'Password123!' }),
    });
    const delRegData = await delRegRes.json();
    const delUserId = delRegData.data?.user?.user_id;

    // Login to get valid token
    const delLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: delEmail, password: 'Password123!' }),
    });
    const delLoginData = await delLoginRes.json();
    const delToken = delLoginData.data?.token;

    // Verify /me works prior to deletion
    const delMeBefore = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${delToken}` },
    });
    assertTest('Deleted User Flow: Profile works before deletion', delMeBefore.status === 200);

    // Directly delete user from PostgreSQL
    await query('DELETE FROM users WHERE user_id = $1', [delUserId]);

    // Request /me again with valid token
    const delMeAfter = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${delToken}` },
    });
    const delMeAfterData = await delMeAfter.json();
    assertTest('Deleted User Flow: Access after deletion returns HTTP 401', delMeAfter.status === 401);
    assertTest(
      'Deleted User Flow: Returns AUTHENTICATION_ERROR',
      delMeAfterData.error?.code === 'AUTHENTICATION_ERROR'
    );
    assertTest(
      'Deleted User Flow: Informative message "User account no longer exists"',
      delMeAfterData.error?.message === 'User account no longer exists'
    );

    // Clean up test user
    await query('DELETE FROM users WHERE user_id = $1', [createdUserId]);
    console.log('\n[Cleanup Complete] Test user records removed from database.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  console.log(`\n================================================================`);
  console.log(`Live PostgreSQL End-to-End Verification: ${passed} Passed, ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runLiveE2E().catch((err) => {
  console.error('[Live E2E Fatal Error]', err);
  process.exit(1);
});
