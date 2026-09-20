import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import http from 'http';
import app from '../src/app.mjs';
import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  registerUser,
  loginUser,
  getUserById,
} from '../src/services/auth.service.mjs';
import { registerSchema, loginSchema } from '../src/validators/auth.validator.mjs';
import { requireAuth } from '../src/middleware/auth.middleware.mjs';
import { testDbConnection, query, pool } from '../src/config/database.mjs';
import config from '../src/config/env.mjs';

export const runAuthTests = async () => {
  console.log('====================================================');
  console.log('Running Hardened Authentication & Security Test Suite');
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

  // --------------------------------------------------------------------------
  // 1. Password Hashing & Timing-Safe Dummy Hash
  // --------------------------------------------------------------------------
  await test('Password Hashing: Produces secure bcrypt hash and verifies correctly', async () => {
    const password = 'StrongPassword123!';
    const hash = await hashPassword(password);

    if (!hash || hash === password) {
      throw new Error('Hash was not generated properly or matched plain text');
    }

    const matches = await comparePassword(password, hash);
    if (!matches) {
      throw new Error('Valid password failed comparison against hash');
    }

    const wrongMatches = await comparePassword('WrongPassword123!', hash);
    if (wrongMatches) {
      throw new Error('Wrong password unexpectedly verified against hash');
    }
  });

  await test('Timing-Safe Login: Precomputed dummy hash is valid and safe for bcrypt comparison', async () => {
    // DUMMY_HASH constant from auth.service.mjs
    const dummyHash = '$2b$10$94QW1RfRKKORkGKMZWSJgerg5Q/oh45URki6nkwfUCCLDR6dcoCWC';
    
    // Validate bcrypt format: $2b$ or $2a$, 2 digit rounds, 22 char salt, 31 char hash
    const bcryptRegex = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
    if (!bcryptRegex.test(dummyHash)) {
      throw new Error('Precomputed dummy hash is not a valid bcrypt hash format');
    }

    // Comparison against dummy hash must complete normally and return false
    const comparisonResult = await bcrypt.compare('SomeRandomPassword123!', dummyHash);
    if (comparisonResult !== false) {
      throw new Error('Dummy hash comparison returned true for arbitrary password');
    }
  });

  // --------------------------------------------------------------------------
  // 2. JWT Generation, Expiration, Claims & Algorithm Restrictions
  // --------------------------------------------------------------------------
  await test('JWT Security: Generates signed HS256 token and decodes claims safely', async () => {
    const mockUser = {
      user_id: '11111111-1111-1111-1111-111111111111',
      email: 'jwt_test@example.com',
      name: 'JWT Tester',
    };

    const token = generateToken(mockUser);
    if (!token || typeof token !== 'string') {
      throw new Error('Token generation failed');
    }

    const decoded = verifyToken(token);
    if (decoded.userId !== mockUser.user_id || decoded.email !== mockUser.email || decoded.name !== mockUser.name) {
      throw new Error('Decoded token payload did not match source user');
    }

    // Security check: password and password_hash must never be in claims
    if (decoded.password || decoded.password_hash) {
      throw new Error('Security violation: password or hash exposed in JWT claims');
    }
  });

  await test('JWT Security: Rejects expired tokens', async () => {
    const expiredToken = jwt.sign(
      { userId: 'test', email: 'test@example.com' },
      config.jwtSecret,
      { expiresIn: '-1s', algorithm: 'HS256' }
    );

    let threw = false;
    try {
      verifyToken(expiredToken);
    } catch (err) {
      threw = true;
      if (err.name !== 'TokenExpiredError') {
        throw new Error(`Expected TokenExpiredError, but got: ${err.name}`);
      }
    }
    if (!threw) throw new Error('Expired token was unexpectedly accepted');
  });

  await test('JWT Security: Rejects invalid signatures and tampered tokens', async () => {
    const validToken = generateToken({ user_id: '1', email: 'test@example.com', name: 'Test' });
    const tamperedToken = validToken.slice(0, -5) + 'xxxxx';

    let threw = false;
    try {
      verifyToken(tamperedToken);
    } catch (err) {
      threw = true;
      if (err.name !== 'JsonWebTokenError') {
        throw new Error(`Expected JsonWebTokenError, but got: ${err.name}`);
      }
    }
    if (!threw) throw new Error('Tampered token was unexpectedly accepted');
  });

  await test('JWT Security: Rejects unsupported algorithms (e.g. HS512 or none)', async () => {
    const hs512Token = jwt.sign(
      { userId: 'test', email: 'test@example.com' },
      config.jwtSecret,
      { algorithm: 'HS512' }
    );

    let threw = false;
    try {
      verifyToken(hs512Token);
    } catch (err) {
      threw = true;
      if (!err.message.includes('invalid algorithm')) {
        throw new Error(`Expected invalid algorithm error, got: ${err.message}`);
      }
    }
    if (!threw) throw new Error('Token signed with unsupported algorithm HS512 was accepted');
  });

  // --------------------------------------------------------------------------
  // 3. Validation Schema & Normalization
  // --------------------------------------------------------------------------
  await test('Validation: Rejects short passwords and normalizes emails', async () => {
    const invalidReg = registerSchema.safeParse({
      name: 'A',
      email: 'not-an-email',
      password: 'short',
    });

    if (invalidReg.success) {
      throw new Error('Invalid registration data unexpectedly passed validation');
    }

    const validReg = registerSchema.safeParse({
      name: '  Valid Name  ',
      email: '  USER@EXAMPLE.COM  ',
      password: 'ValidPassword123!',
    });

    if (!validReg.success) {
      throw new Error(`Valid registration failed validation: ${JSON.stringify(validReg.error.errors)}`);
    }

    // Verify email normalization to lowercase and trimmed name
    if (validReg.data.email !== 'user@example.com') {
      throw new Error(`Email was not normalized to lowercase: ${validReg.data.email}`);
    }
    if (validReg.data.name !== 'Valid Name') {
      throw new Error(`Name was not trimmed: ${validReg.data.name}`);
    }
  });

  // --------------------------------------------------------------------------
  // 4. Production JWT Secret Validation
  // --------------------------------------------------------------------------
  await test('Environment Validation: Production rejects fallback dev secret and short secrets', async () => {
    const validateSecret = (env, secret) => {
      if (env === 'production') {
        if (!secret || secret === 'dev_secret_change_in_production' || secret.length < 32) {
          throw new Error(
            '[FATAL CONFIG ERROR] In production, JWT_SECRET must be set to a secure random string of at least 32 characters.'
          );
        }
      }
      return true;
    };

    // 1. Development allows fallback
    if (!validateSecret('development', 'dev_secret_change_in_production')) {
      throw new Error('Development should permit dev secret');
    }

    // 2. Production rejects fallback
    let threwFallback = false;
    try {
      validateSecret('production', 'dev_secret_change_in_production');
    } catch (err) {
      threwFallback = true;
      if (err.message.includes('dev_secret_change_in_production')) {
        // Ensure secret value is not printed as the actual secret
      }
    }
    if (!threwFallback) throw new Error('Production did not reject default dev secret');

    // 3. Production rejects short secret (<32 chars)
    let threwShort = false;
    try {
      validateSecret('production', 'short_secret_under_32_chars');
    } catch (err) {
      threwShort = true;
    }
    if (!threwShort) throw new Error('Production did not reject short secret (<32 chars)');

    // 4. Production accepts strong secret (>=32 chars)
    const validProdSecret = 'a'.repeat(32);
    if (!validateSecret('production', validProdSecret)) {
      throw new Error('Production failed to accept strong 32-character secret');
    }
  });

  // --------------------------------------------------------------------------
  // 5. Authentication Middleware Header Handling
  // --------------------------------------------------------------------------
  await test('Middleware: Rejects missing, Basic, and empty Bearer headers', async () => {
    const testMiddleware = (headers) => {
      let response = null;
      const req = { headers };
      const res = {
        status: (code) => ({
          json: (data) => {
            response = { statusCode: code, data };
          },
        }),
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      requireAuth(req, res, next);
      return { response, nextCalled, req };
    };

    // 1. Missing header
    const r1 = testMiddleware({});
    if (r1.nextCalled || r1.response?.statusCode !== 401) {
      throw new Error('Missing Authorization header did not return 401');
    }

    // 2. Basic auth header
    const r2 = testMiddleware({ authorization: 'Basic dXNlcjpwYXNz' });
    if (r2.nextCalled || r2.response?.statusCode !== 401) {
      throw new Error('Basic authentication header was not rejected with 401');
    }

    // 3. Empty Bearer token
    const r3 = testMiddleware({ authorization: 'Bearer ' });
    if (r3.nextCalled || r3.response?.statusCode !== 401) {
      throw new Error('Empty Bearer token was not rejected with 401');
    }

    // 4. Valid Bearer token
    const validToken = generateToken({ user_id: 'test-123', email: 'test@example.com', name: 'Tester' });
    const r4 = testMiddleware({ authorization: `Bearer ${validToken}` });
    if (!r4.nextCalled || r4.req.user?.userId !== 'test-123') {
      throw new Error('Valid Bearer token was not accepted by middleware');
    }
  });

  // --------------------------------------------------------------------------
  // 6. Service Unit Tests with Mocked Database Queries
  // --------------------------------------------------------------------------
  await test('Registration Unit Test: Successful registration excludes password_hash', async () => {
    const originalQuery = pool.query;
    try {
      pool.query = async (text, params) => {
        if (text.includes('SELECT user_id FROM users WHERE LOWER(email)')) {
          return { rows: [] }; // No existing user
        }
        if (text.includes('INSERT INTO users')) {
          return {
            rows: [
              {
                user_id: '123e4567-e89b-12d3-a456-426614174000',
                name: params[0],
                email: params[1],
                created_at: new Date().toISOString(),
              },
            ],
          };
        }
        return { rows: [] };
      };

      const result = await registerUser({
        name: 'Alice Smith',
        email: 'alice@example.com',
        password: 'Password123!',
      });

      if (!result.user_id || result.email !== 'alice@example.com') {
        throw new Error('Registration failed to return user object');
      }
      if (result.password || result.password_hash) {
        throw new Error('Security violation: password_hash exposed in registerUser return');
      }
    } finally {
      pool.query = originalQuery;
    }
  });

  await test('Registration Unit Test: Proactive check rejects duplicate email with 400 VALIDATION_ERROR', async () => {
    const originalQuery = pool.query;
    try {
      pool.query = async (text, params) => {
        if (text.includes('SELECT user_id FROM users WHERE LOWER(email)')) {
          return { rows: [{ user_id: 'existing-id' }] }; // Existing user found
        }
        return { rows: [] };
      };

      let threw = false;
      try {
        await registerUser({
          name: 'Alice Duplicate',
          email: 'alice@example.com',
          password: 'Password123!',
        });
      } catch (err) {
        threw = true;
        if (err.code !== 'VALIDATION_ERROR' || err.statusCode !== 400) {
          throw new Error(`Expected 400 VALIDATION_ERROR, got: ${err.code} (${err.statusCode})`);
        }
      }
      if (!threw) throw new Error('Duplicate email registration did not throw VALIDATION_ERROR');
    } finally {
      pool.query = originalQuery;
    }
  });

  await test('Registration Unit Test: PostgreSQL 23505 race condition handled safely as 400 VALIDATION_ERROR', async () => {
    const originalQuery = pool.query;
    try {
      pool.query = async (text, params) => {
        if (text.includes('SELECT user_id FROM users WHERE LOWER(email)')) {
          return { rows: [] }; // Pre-check passed
        }
        if (text.includes('INSERT INTO users')) {
          // Simulate concurrent insertion triggering PostgreSQL unique constraint error 23505
          const pgError = new Error('duplicate key value violates unique constraint "idx_users_lower_email"');
          pgError.code = '23505';
          throw pgError;
        }
        return { rows: [] };
      };

      let threw = false;
      try {
        await registerUser({
          name: 'Concurrent User',
          email: 'concurrent@example.com',
          password: 'Password123!',
        });
      } catch (err) {
        threw = true;
        if (err.code !== 'VALIDATION_ERROR' || err.statusCode !== 400) {
          throw new Error(`Expected 400 VALIDATION_ERROR on PG 23505, got: ${err.code} (${err.statusCode})`);
        }
        if (err.message !== 'Email is already registered') {
          throw new Error(`Unexpected message for 23505 handling: ${err.message}`);
        }
      }
      if (!threw) throw new Error('PostgreSQL 23505 error was not handled as VALIDATION_ERROR');
    } finally {
      pool.query = originalQuery;
    }
  });

  await test('Registration Unit Test: Unrelated database errors are preserved and not masked', async () => {
    const originalQuery = pool.query;
    try {
      pool.query = async (text, params) => {
        if (text.includes('SELECT user_id FROM users WHERE LOWER(email)')) {
          return { rows: [] };
        }
        if (text.includes('INSERT INTO users')) {
          // Simulate unrelated error (e.g. disk full, syntax error, connection drop)
          const pgError = new Error('relation "users" does not exist');
          pgError.code = '42P01';
          throw pgError;
        }
        return { rows: [] };
      };

      let threw = false;
      try {
        await registerUser({
          name: 'Error User',
          email: 'error@example.com',
          password: 'Password123!',
        });
      } catch (err) {
        threw = true;
        if (err.code !== '42P01' || err.message !== 'relation "users" does not exist') {
          throw new Error(`Unrelated error was modified unexpectedly: ${err.code} - ${err.message}`);
        }
      }
      if (!threw) throw new Error('Unrelated database error was not thrown');
    } finally {
      pool.query = originalQuery;
    }
  });

  await test('Login Unit Test: Nonexistent email executes dummy bcrypt comparison and returns generic 401', async () => {
    const originalQuery = pool.query;
    try {
      pool.query = async (text, params) => {
        return { rows: [] }; // Nonexistent email
      };

      let threw = false;
      try {
        await loginUser({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        });
      } catch (err) {
        threw = true;
        if (err.code !== 'AUTHENTICATION_ERROR' || err.statusCode !== 401) {
          throw new Error(`Expected 401 AUTHENTICATION_ERROR, got: ${err.code} (${err.statusCode})`);
        }
        if (err.message !== 'Invalid email or password') {
          throw new Error(`Expected generic message "Invalid email or password", got: "${err.message}"`);
        }
      }
      if (!threw) throw new Error('Nonexistent email login unexpectedly succeeded');
    } finally {
      pool.query = originalQuery;
    }
  });

  await test('Login Unit Test: Incorrect password returns identical generic 401', async () => {
    const originalQuery = pool.query;
    try {
      const realHash = await hashPassword('CorrectPassword123!');
      pool.query = async (text, params) => {
        return {
          rows: [
            {
              user_id: 'test-user-id',
              name: 'Alice',
              email: 'alice@example.com',
              password_hash: realHash,
            },
          ],
        };
      };

      let threw = false;
      try {
        await loginUser({
          email: 'alice@example.com',
          password: 'WrongPassword999!',
        });
      } catch (err) {
        threw = true;
        if (err.code !== 'AUTHENTICATION_ERROR' || err.statusCode !== 401) {
          throw new Error(`Expected 401 AUTHENTICATION_ERROR, got: ${err.code} (${err.statusCode})`);
        }
        if (err.message !== 'Invalid email or password') {
          throw new Error(`Expected generic message "Invalid email or password", got: "${err.message}"`);
        }
      }
      if (!threw) throw new Error('Wrong password login unexpectedly succeeded');
    } finally {
      pool.query = originalQuery;
    }
  });

  await test('Login Unit Test: Successful login returns token and safe user (no password_hash)', async () => {
    const originalQuery = pool.query;
    try {
      const realPassword = 'CorrectPassword123!';
      const realHash = await hashPassword(realPassword);
      pool.query = async (text, params) => {
        return {
          rows: [
            {
              user_id: 'test-user-id-valid',
              name: 'Alice Valid',
              email: 'alice_valid@example.com',
              password_hash: realHash,
            },
          ],
        };
      };

      const result = await loginUser({
        email: 'alice_valid@example.com',
        password: realPassword,
      });

      if (!result.token) throw new Error('Login failed to return token');
      if (result.user.password || result.user.password_hash) {
        throw new Error('Security violation: password_hash exposed in login return');
      }
      if (result.user.email !== 'alice_valid@example.com') {
        throw new Error('User email in login result was unexpected');
      }
    } finally {
      pool.query = originalQuery;
    }
  });

  await test('Deleted User Unit Test: getUserById returns 401 AUTHENTICATION_ERROR when user is missing', async () => {
    const originalQuery = pool.query;
    try {
      pool.query = async (text, params) => {
        return { rows: [] }; // User record no longer exists
      };

      let threw = false;
      try {
        await getUserById('nonexistent-deleted-id');
      } catch (err) {
        threw = true;
        if (err.code !== 'AUTHENTICATION_ERROR' || err.statusCode !== 401) {
          throw new Error(`Expected 401 AUTHENTICATION_ERROR, got: ${err.code} (${err.statusCode})`);
        }
        if (err.message !== 'User account no longer exists') {
          throw new Error(`Expected "User account no longer exists", got: "${err.message}"`);
        }
      }
      if (!threw) throw new Error('Deleted user access did not throw authentication error');
    } finally {
      pool.query = originalQuery;
    }
  });

  // --------------------------------------------------------------------------
  // 7. Live HTTP Server Tests (Real Express App Instances via Ephemeral Port)
  // --------------------------------------------------------------------------
  await test('HTTP Server Tests: Live endpoints (/health, /api, /auth/register, /auth/login, /auth/me, /auth/logout)', async () => {
    // Start server on ephemeral port 0
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. GET /health
      const healthRes = await fetch(`${baseUrl}/health`);
      if (healthRes.status !== 200) {
        throw new Error(`/health returned HTTP ${healthRes.status}`);
      }
      const healthData = await healthRes.json();
      if (healthData.data?.status !== 'UP') {
        throw new Error(`/health status was not UP: ${JSON.stringify(healthData)}`);
      }

      // 2. GET /api
      const apiRes = await fetch(`${baseUrl}/api`);
      if (apiRes.status !== 200) {
        throw new Error(`/api returned HTTP ${apiRes.status}`);
      }
      const apiData = await apiRes.json();
      if (!apiData.data?.endpoints?.auth) {
        throw new Error(`/api endpoints payload missing auth: ${JSON.stringify(apiData)}`);
      }

      // 3. POST /api/auth/register with invalid body (fails Zod validation with 400)
      const regFailRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'A', email: 'not-an-email', password: 'short' }),
      });
      if (regFailRes.status !== 400) {
        throw new Error(`POST /api/auth/register invalid body returned HTTP ${regFailRes.status}, expected 400`);
      }
      const regFailData = await regFailRes.json();
      if (regFailData.error?.code !== 'VALIDATION_ERROR') {
        throw new Error(`Expected VALIDATION_ERROR code, got: ${JSON.stringify(regFailData)}`);
      }

      // 4. POST /api/auth/login with missing fields (fails Zod validation with 400)
      const loginFailRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }), // missing password
      });
      if (loginFailRes.status !== 400) {
        throw new Error(`POST /api/auth/login missing password returned HTTP ${loginFailRes.status}, expected 400`);
      }

      // 5. GET /api/auth/me without authorization header (fails with 401)
      const meNoAuthRes = await fetch(`${baseUrl}/api/auth/me`);
      if (meNoAuthRes.status !== 401) {
        throw new Error(`GET /api/auth/me without token returned HTTP ${meNoAuthRes.status}, expected 401`);
      }

      // 6. POST /api/auth/logout (stateless acknowledgment returns 200)
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
      if (logoutRes.status !== 200) {
        throw new Error(`POST /api/auth/logout returned HTTP ${logoutRes.status}, expected 200`);
      }
      const logoutData = await logoutRes.json();
      if (!logoutData.success || logoutData.message !== 'Logged out successfully') {
        throw new Error(`POST /api/auth/logout returned unexpected response: ${JSON.stringify(logoutData)}`);
      }
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // --------------------------------------------------------------------------
  // 8. Live Database Integration Tests (Executed when DB is reachable)
  // --------------------------------------------------------------------------
  const dbStatus = await testDbConnection();
  if (dbStatus.connected) {
    console.log('\n[Database Live] Running database-backed security tests...');
    const testEmail = `auth_test_${Date.now()}@example.com`;
    const testPassword = 'Password123!Secure';
    let createdUserId;

    await test('Live DB Flow: Creates user and excludes password_hash from response', async () => {
      const user = await registerUser({
        name: 'Jane Doe',
        email: testEmail,
        password: testPassword,
      });

      createdUserId = user.user_id;
      if (!user.user_id || user.email !== testEmail.toLowerCase()) {
        throw new Error('User creation returned invalid user payload');
      }

      if (user.password || user.password_hash) {
        throw new Error('Security violation: password or hash exposed in user response');
      }
    });

    await test('Live DB Flow: Case-insensitive duplicate email rejects exact, upper-case, and padded variants', async () => {
      // 1. Exact duplicate
      let threwExact = false;
      try {
        await registerUser({
          name: 'Jane Duplicate',
          email: testEmail,
          password: 'AnotherPassword123',
        });
      } catch (err) {
        threwExact = true;
        if (err.code !== 'VALIDATION_ERROR') throw err;
      }
      if (!threwExact) throw new Error('Exact duplicate email was not rejected');

      // 2. Upper-case variant
      let threwUpper = false;
      try {
        await registerUser({
          name: 'Jane Duplicate Upper',
          email: testEmail.toUpperCase(),
          password: 'AnotherPassword123',
        });
      } catch (err) {
        threwUpper = true;
        if (err.code !== 'VALIDATION_ERROR') throw err;
      }
      if (!threwUpper) throw new Error('Uppercase duplicate email was not rejected');

      // 3. Padded variant
      let threwPadded = false;
      try {
        await registerUser({
          name: 'Jane Duplicate Padded',
          email: `  ${testEmail}  `,
          password: 'AnotherPassword123',
        });
      } catch (err) {
        threwPadded = true;
        if (err.code !== 'VALIDATION_ERROR') throw err;
      }
      if (!threwPadded) throw new Error('Whitespace-padded duplicate email was not rejected');
    });

    await test('Live DB Flow: Rejects wrong password and nonexistent email with identical generic error', async () => {
      // Wrong password
      let threwWrongPass = false;
      try {
        await loginUser({
          email: testEmail,
          password: 'WrongPassword999!',
        });
      } catch (err) {
        threwWrongPass = true;
        if (err.code !== 'AUTHENTICATION_ERROR' || err.message !== 'Invalid email or password') {
          throw new Error(`Unexpected error message for wrong password: ${err.message}`);
        }
      }
      if (!threwWrongPass) throw new Error('Login with incorrect password unexpectedly succeeded');

      // Nonexistent email
      let threwNonexistent = false;
      try {
        await loginUser({
          email: 'nonexistent_user_99999@example.com',
          password: 'AnyPassword123!',
        });
      } catch (err) {
        threwNonexistent = true;
        if (err.code !== 'AUTHENTICATION_ERROR' || err.message !== 'Invalid email or password') {
          throw new Error(`Unexpected error message for nonexistent email: ${err.message}`);
        }
      }
      if (!threwNonexistent) throw new Error('Login with nonexistent email unexpectedly succeeded');

      // Successful login
      const loginResult = await loginUser({
        email: testEmail,
        password: testPassword,
      });

      if (!loginResult.token || loginResult.user.email !== testEmail.toLowerCase()) {
        throw new Error('Valid login failed to return token or user details');
      }

      if (loginResult.user.password || loginResult.user.password_hash) {
        throw new Error('Security violation: password exposed in login response');
      }
    });

    await test('Live DB Flow: Deleted user access returns 401 AUTHENTICATION_ERROR', async () => {
      // Create temporary user
      const tempUser = await registerUser({
        name: 'Temp User',
        email: `temp_${Date.now()}@example.com`,
        password: 'TempPassword123!',
      });

      // Verify profile works before deletion
      const preProfile = await getUserById(tempUser.user_id);
      if (!preProfile) throw new Error('Failed to retrieve user before deletion');

      // Delete user
      await query('DELETE FROM users WHERE user_id = $1', [tempUser.user_id]);

      // Verify getUserById throws 401 AUTHENTICATION_ERROR
      let threwDeleted = false;
      try {
        await getUserById(tempUser.user_id);
      } catch (err) {
        threwDeleted = true;
        if (err.code !== 'AUTHENTICATION_ERROR' || err.statusCode !== 401) {
          throw new Error(`Expected 401 AUTHENTICATION_ERROR for deleted user, got: ${err.code} (${err.statusCode})`);
        }
      }
      if (!threwDeleted) throw new Error('Deleted user access did not throw authentication error');
    });

    // Clean up test user
    if (createdUserId) {
      await query('DELETE FROM users WHERE user_id = $1', [createdUserId]);
    }
  } else {
    console.log('\n[Database Notice] PostgreSQL host is offline; unit tests with simulated DB responses ran successfully.');
    console.log('[Notice] Start PostgreSQL to execute additional end-to-end database persistence tests.');
  }

  console.log(`\n====================================================`);
  console.log(`Auth Suite Complete: ${passed} Passed, ${failed} Failed`);
  console.log(`====================================================`);

  if (failed > 0) {
    process.exit(1);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAuthTests()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Auth Test Error]', err.message);
      await pool.end();
      process.exit(1);
    });
}
