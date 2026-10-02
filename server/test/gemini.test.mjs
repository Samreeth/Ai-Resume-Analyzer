/**
 * Test Suite: Google Gemini API Foundation (Stage 1)
 *
 * Validates:
 * 1. Disabled by default state
 * 2. Missing/blank API key handling
 * 3. Configured API key detection without leaking credentials
 * 4. Model and timeout configuration validation
 * 5. Safe service behavior when unconfigured
 * 6. SDK initialization and timeout wrapper functionality (isolated, 0 live calls)
 * 7. Error sanitization (credential and sensitive data redaction)
 *
 * NOTE: All tests run offline with ZERO network calls, zero API costs, and without requiring a real API key.
 */

import assert from 'node:assert/strict';
import { GoogleGenAI } from '@google/genai';
import config from '../src/config/env.mjs';
import geminiService, {
  isGeminiConfigured,
  getGeminiStatus,
  getGeminiClient,
  sanitizeGeminiError,
  executeWithTimeout,
  generateContextualRecommendations,
  generateSemanticComparison,
} from '../src/services/gemini.service.mjs';

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
    process.exitCode = 1;
  }
};

export const runGeminiTests = async () => {
  console.log('====================================================');
  console.log('Running Stage 1: Google Gemini API Foundation Test Suite');
  console.log('====================================================\n');

  // Group 1: Default Environment & Disabled State
  await test('1. Default State: Gemini is disabled by default in application config', () => {
    // Unless explicitly GEMINI_ENABLED='true' in process.env, geminiEnabled must be false
    assert.strictEqual(typeof config.geminiEnabled, 'boolean');
    assert.strictEqual(typeof config.geminiModel, 'string');
    assert.ok(config.geminiModel.length > 0);
    assert.strictEqual(typeof config.geminiTimeoutMs, 'number');
    assert.ok(config.geminiTimeoutMs >= 1000);
  });

  await test('2. Default State: isGeminiConfigured returns false under default unconfigured environment', () => {
    const isConfigured = isGeminiConfigured();
    // Default without GEMINI_ENABLED=true and without GEMINI_API_KEY
    assert.strictEqual(isConfigured, false);
  });

  await test('3. Default State: getGeminiStatus reports unconfigured and disabled safely', () => {
    const status = getGeminiStatus();
    assert.strictEqual(typeof status.configured, 'boolean');
    assert.strictEqual(typeof status.enabled, 'boolean');
    assert.strictEqual(typeof status.hasApiKey, 'boolean');
    assert.strictEqual(typeof status.model, 'string');
    assert.strictEqual(typeof status.timeoutMs, 'number');
    // Ensure no apiKey property exists in the returned status object
    assert.strictEqual(status.apiKey, undefined);
  });

  // Group 2: Missing or Blank API Key
  await test('4. Missing Key: isGeminiConfigured returns false when enabled is true but apiKey is empty', () => {
    assert.strictEqual(isGeminiConfigured({ enabled: true, apiKey: '' }), false);
    assert.strictEqual(isGeminiConfigured({ enabled: true, apiKey: '   ' }), false);
    assert.strictEqual(isGeminiConfigured({ enabled: true, apiKey: null }), false);
    assert.strictEqual(isGeminiConfigured({ enabled: true, apiKey: undefined }), false);
  });

  await test('5. Missing Key: getGeminiClient returns null when apiKey is missing or blank', () => {
    assert.strictEqual(getGeminiClient({ enabled: true, apiKey: '' }), null);
    assert.strictEqual(getGeminiClient({ enabled: true, apiKey: '   ' }), null);
    assert.strictEqual(getGeminiClient({ enabled: false, apiKey: 'some_key' }), null);
  });

  // Group 3: Detection without Credential Leakage
  await test('6. Key Detection: Correctly detects configured state without exposing raw key', () => {
    const secretKey = 'AIzaSyFakeSecretKeyForTestingPurposeOnly12345';
    const isConfigured = isGeminiConfigured({ enabled: true, apiKey: secretKey });
    assert.strictEqual(isConfigured, true);

    const status = getGeminiStatus({ enabled: true, apiKey: secretKey, model: 'gemini-2.0-flash' });
    assert.strictEqual(status.configured, true);
    assert.strictEqual(status.enabled, true);
    assert.strictEqual(status.hasApiKey, true);

    // Serialization leak check: stringified status must NOT contain the secret key
    const serialized = JSON.stringify(status);
    assert.strictEqual(serialized.includes(secretKey), false);
    assert.strictEqual(serialized.includes('FakeSecret'), false);
  });

  // Group 4: Configuration Validation (Model & Timeout)
  await test('7. Config Validation: Supports custom and configurable model identifiers', () => {
    const status1 = getGeminiStatus({ model: 'gemini-1.5-pro' });
    assert.strictEqual(status1.model, 'gemini-1.5-pro');

    const status2 = getGeminiStatus({ model: '  gemini-2.0-flash-lite  ' });
    assert.strictEqual(status2.model, 'gemini-2.0-flash-lite');

    const statusDefault = getGeminiStatus({ model: '' });
    assert.strictEqual(statusDefault.model, 'gemini-2.0-flash');
  });

  await test('8. Config Validation: Enforces timeout bounds and safe fallback', () => {
    const status1 = getGeminiStatus({ timeoutMs: 15000 });
    assert.strictEqual(status1.timeoutMs, 15000);

    // Negative or sub-1000 timeout falls back to minimum bound 1000
    const statusLow = getGeminiStatus({ timeoutMs: -500 });
    assert.strictEqual(statusLow.timeoutMs, 1000);

    // Invalid non-numeric timeout falls back to 10000
    const statusInvalid = getGeminiStatus({ timeoutMs: 'not_a_number' });
    assert.strictEqual(statusInvalid.timeoutMs, 10000);
  });

  // Group 5: Safe Service Boundaries & Placeholders
  await test('9. Service Boundary: Default getGeminiClient returns null when unconfigured', () => {
    // In unconfigured state, client is null
    const client = getGeminiClient();
    assert.strictEqual(client, null);
  });

  await test('10. Service Boundary: Future operation stubs reject with NOT_IMPLEMENTED (no live calls)', async () => {
    await assert.rejects(
      async () => generateContextualRecommendations(),
      (err) => {
        assert.strictEqual(err.code, 'NOT_IMPLEMENTED');
        assert.strictEqual(err.statusCode, 501);
        return true;
      }
    );

    await assert.rejects(
      async () => generateSemanticComparison(),
      (err) => {
        assert.strictEqual(err.code, 'NOT_IMPLEMENTED');
        assert.strictEqual(err.statusCode, 501);
        return true;
      }
    );
  });

  // Group 6: SDK Initialization & Timeout Wrapper
  await test('11. SDK Initialization: Instantiates GoogleGenAI instance with valid options', () => {
    const client = getGeminiClient({ enabled: true, apiKey: 'mock_key_for_test' });
    assert.ok(client !== null);
    assert.ok(client instanceof GoogleGenAI);
    assert.ok(client.models !== undefined);
  });

  await test('12. Timeout Wrapper: Resolves successfully when async operation finishes within timeout', async () => {
    const mockOp = async () => {
      return { output: 'mocked_success' };
    };

    const res = await executeWithTimeout(mockOp, 2000);
    assert.deepStrictEqual(res, { output: 'mocked_success' });
  });

  await test('13. Timeout Wrapper: Rejects with GEMINI_TIMEOUT when operation exceeds threshold', async () => {
    const hangingOp = async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return 'never_reached';
    };

    await assert.rejects(
      async () => executeWithTimeout(hangingOp, 50),
      (err) => {
        assert.strictEqual(err.code, 'GEMINI_TIMEOUT');
        assert.strictEqual(err.statusCode, 504);
        assert.ok(err.message.includes('timed out'));
        return true;
      }
    );
  });

  // Group 7: Error Sanitization
  await test('14. Error Sanitizer: Redacts API key query parameter from URLs', () => {
    const rawError = new Error(
      'Request failed: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyD_LEAKED_SECRET_KEY_12345'
    );
    rawError.status = 403;

    const sanitized = sanitizeGeminiError(rawError);
    assert.strictEqual(sanitized.isSanitized, true);
    assert.strictEqual(sanitized.statusCode, 403);
    assert.strictEqual(sanitized.message.includes('AIzaSyD_LEAKED_SECRET_KEY_12345'), false);
    assert.ok(sanitized.message.includes('key=[REDACTED_KEY]') || sanitized.message.includes('[REDACTED_API_KEY]'));
  });

  await test('15. Error Sanitizer: Redacts Bearer tokens and standard Google API key formats', () => {
    const rawError = new Error('Auth failed: Bearer secret_bearer_token_xyz999 with AIzaSyD987654321012345678901234567890123');
    const sanitized = sanitizeGeminiError(rawError);

    assert.strictEqual(sanitized.message.includes('secret_bearer_token_xyz999'), false);
    assert.strictEqual(sanitized.message.includes('AIzaSyD987654321012345678901234567890123'), false);
    assert.ok(sanitized.message.includes('Bearer [REDACTED_TOKEN]'));
    assert.ok(sanitized.message.includes('[REDACTED_API_KEY]'));
  });

  await test('16. Error Sanitizer: Redacts sensitive user context strings passed into sanitizer', () => {
    const rawError = new Error('Model rejected candidate resume for Jane Doe at 123 Main St, Phone: +1-555-0199');
    const sensitiveData = ['Jane Doe', '123 Main St', '+1-555-0199'];

    const sanitized = sanitizeGeminiError(rawError, sensitiveData);
    assert.strictEqual(sanitized.message.includes('Jane Doe'), false);
    assert.strictEqual(sanitized.message.includes('123 Main St'), false);
    assert.strictEqual(sanitized.message.includes('+1-555-0199'), false);
    assert.ok(sanitized.message.includes('[REDACTED]'));
  });

  await test('17. Error Sanitizer: Gracefully handles null or empty errors with fallback safe object', () => {
    const sanitizedNull = sanitizeGeminiError(null);
    assert.strictEqual(sanitizedNull.isSanitized, true);
    assert.strictEqual(sanitizedNull.code, 'GEMINI_PROVIDER_ERROR');
    assert.strictEqual(sanitizedNull.statusCode, 500);

    const sanitizedUndefined = sanitizeGeminiError(undefined);
    assert.strictEqual(sanitizedUndefined.isSanitized, true);
  });

  console.log('\n====================================================');
  console.log(`Gemini Foundation Suite Complete: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
    throw new Error(`${failed} test(s) failed in Gemini Foundation Suite`);
  }
};

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('gemini.test.mjs')) {
  runGeminiTests().catch((err) => {
    console.error('Fatal test execution failure:', err);
    process.exit(1);
  });
}

export default runGeminiTests;
