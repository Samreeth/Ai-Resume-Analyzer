/**
 * Google Gemini API Foundation Service
 * Stage 1: Client initialization, configuration verification, error sanitization, and timeout management.
 *
 * NOTE: This service establishes the isolated AI layer foundation.
 * It does NOT execute live requests at startup, does NOT automatically run during
 * deterministic analysis or recommendations, and does NOT transmit candidate resume data.
 */

import { GoogleGenAI } from '@google/genai';
import config from '../config/env.mjs';

/**
 * Determine whether the Gemini API is fully configured and enabled.
 *
 * @param {object} [override={}] - Optional configuration overrides (useful for testing)
 * @param {boolean} [override.enabled]
 * @param {string} [override.apiKey]
 * @returns {boolean} True if Gemini is enabled and a non-empty API key is present
 */
export const isGeminiConfigured = (override = {}) => {
  const enabled = override.enabled !== undefined ? Boolean(override.enabled) : config.geminiEnabled;
  const apiKey = override.apiKey !== undefined ? override.apiKey : config.geminiApiKey;

  return Boolean(
    enabled &&
    apiKey &&
    typeof apiKey === 'string' &&
    apiKey.trim().length > 0
  );
};

/**
 * Retrieve safe status metadata for the Gemini service without exposing sensitive credentials.
 *
 * @param {object} [override={}] - Optional configuration overrides
 * @returns {{ configured: boolean, enabled: boolean, hasApiKey: boolean, model: string, timeoutMs: number }}
 */
export const getGeminiStatus = (override = {}) => {
  const enabled = override.enabled !== undefined ? Boolean(override.enabled) : config.geminiEnabled;
  const apiKey = override.apiKey !== undefined ? override.apiKey : config.geminiApiKey;
  const model = override.model !== undefined ? override.model : config.geminiModel;
  const timeoutMs = override.timeoutMs !== undefined ? override.timeoutMs : config.geminiTimeoutMs;

  const hasApiKey = Boolean(apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0);

  return {
    configured: Boolean(enabled && hasApiKey),
    enabled: Boolean(enabled),
    hasApiKey,
    model: String(model || 'gemini-2.0-flash').trim(),
    timeoutMs: Math.max(1000, Number(timeoutMs) || 10000),
  };
};

/**
 * Initialize and return an official GoogleGenAI client instance.
 * Returns null if the service is unconfigured or disabled, avoiding warnings or unnecessary instantiation.
 *
 * @param {object} [override={}] - Optional configuration overrides
 * @param {string} [override.apiKey]
 * @param {boolean} [override.enabled]
 * @returns {GoogleGenAI|null}
 */
export const getGeminiClient = (override = {}) => {
  const apiKey = override.apiKey !== undefined ? override.apiKey : config.geminiApiKey;
  const enabled = override.enabled !== undefined ? Boolean(override.enabled) : config.geminiEnabled;

  if (!enabled || !apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return null;
  }

  return new GoogleGenAI({ apiKey: apiKey.trim() });
};

/**
 * Sanitize an error object from the provider to ensure API keys, authorization tokens,
 * or sensitive user excerpts are never logged or exposed.
 *
 * @param {Error|any} error - The caught error
 * @param {string[]} [sensitiveStrings=[]] - Additional strings (e.g. candidate details) to redact
 * @returns {Error} Sanitized error object safe for logging and response handling
 */
export const sanitizeGeminiError = (error, sensitiveStrings = []) => {
  if (!error) {
    const defaultErr = new Error('Unknown Gemini provider error');
    defaultErr.code = 'GEMINI_PROVIDER_ERROR';
    defaultErr.statusCode = 500;
    defaultErr.isSanitized = true;
    return defaultErr;
  }

  let message = error.message || String(error);

  // 1. Redact the active Gemini API key if configured
  if (config.geminiApiKey && typeof config.geminiApiKey === 'string' && config.geminiApiKey.length > 4) {
    message = message.replaceAll(config.geminiApiKey, '[REDACTED_API_KEY]');
  }

  // 2. Redact any sensitive strings passed as context
  for (const str of sensitiveStrings) {
    if (str && typeof str === 'string' && str.length > 3) {
      message = message.replaceAll(str, '[REDACTED]');
    }
  }

  // 3. Regex redactions for URL query parameter keys
  message = message.replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED_KEY]');

  // 4. Regex redactions for standard Google API keys (AIza...)
  message = message.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');

  // 5. Regex redactions for Bearer tokens
  message = message.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]');

  const safeError = new Error(message);
  safeError.code = error.code || 'GEMINI_PROVIDER_ERROR';
  safeError.statusCode = error.status || error.statusCode || 500;
  safeError.isSanitized = true;

  return safeError;
};

/**
 * Execute an asynchronous operation with an enforceable timeout, catching and sanitizing any failure.
 *
 * @param {Function} asyncFn - Async function returning a promise
 * @param {number} [timeoutMs] - Optional timeout in milliseconds (defaults to config.geminiTimeoutMs)
 * @param {string[]} [sensitiveStrings=[]] - Strings to redact on failure
 * @returns {Promise<any>}
 */
export const executeWithTimeout = async (
  asyncFn,
  timeoutMs = config.geminiTimeoutMs,
  sensitiveStrings = []
) => {
  if (typeof asyncFn !== 'function') {
    throw new Error('executeWithTimeout requires an executable function');
  }

  const effectiveTimeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : 10000;

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new Error(`Gemini operation timed out after ${effectiveTimeout}ms`);
      timeoutError.code = 'GEMINI_TIMEOUT';
      timeoutError.statusCode = 504;
      reject(timeoutError);
    }, effectiveTimeout);
  });

  try {
    const result = await Promise.race([asyncFn(), timeoutPromise]);
    return result;
  } catch (err) {
    throw sanitizeGeminiError(err, sensitiveStrings);
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Service Boundary Placeholder: Contextual Recommendations
 * Will be implemented in subsequent authorized stages.
 */
export const generateContextualRecommendations = async () => {
  const error = new Error(
    'Gemini contextual recommendations are not implemented in Stage 1 foundation.'
  );
  error.code = 'NOT_IMPLEMENTED';
  error.statusCode = 501;
  throw error;
};

/**
 * Service Boundary Placeholder: Semantic Comparison
 * Will be implemented in subsequent authorized stages.
 */
export const generateSemanticComparison = async () => {
  const error = new Error(
    'Gemini semantic comparison is not implemented in Stage 1 foundation.'
  );
  error.code = 'NOT_IMPLEMENTED';
  error.statusCode = 501;
  throw error;
};

export default {
  isGeminiConfigured,
  getGeminiStatus,
  getGeminiClient,
  sanitizeGeminiError,
  executeWithTimeout,
  generateContextualRecommendations,
  generateSemanticComparison,
};
