import { extractText } from 'unpdf';
import {
  ExtractionError,
  EXTRACTION_LIMITS,
  sanitizeResumeText,
  validateExtractedText,
} from '../../utils/text.util.mjs';

/**
 * Extract plain text from a PDF binary buffer using unpdf.
 *
 * NOTE ON CANCELLATION:
 * unpdf (powered by Mozilla pdf.js) processes pages asynchronously across JS microtasks and
 * does NOT accept an AbortSignal for computational cancellation.
 * The timeout implemented below via Promise.race provides request deadline detection for the caller,
 * but cannot forcibly preempt ongoing CPU execution inside the active Node.js event loop.
 * Full process isolation with hard preemption is deferred to a future worker architecture.
 *
 * @param {Buffer} buffer - Raw PDF binary buffer
 * @param {object} [options={}]
 * @param {number} [options.timeoutMs=10000] - Extraction deadline in ms
 * @returns {Promise<{ text: string, totalPages: number, format: 'pdf', characterCount: number, wordCount: number }>}
 * @throws {ExtractionError}
 */
export const extractTextFromPdf = async (buffer, options = {}) => {
  if (!buffer || !(buffer instanceof Buffer) || buffer.length === 0) {
    throw new ExtractionError(
      'INVALID_BUFFER',
      'A valid, non-empty binary buffer is required for PDF extraction.',
      400
    );
  }

  const timeoutMs = options.timeoutMs ?? EXTRACTION_LIMITS.DEFAULT_TIMEOUT_MS;

  if (timeoutMs <= 0) {
    throw new ExtractionError(
      'EXTRACTION_TIMEOUT',
      `PDF text extraction exceeded the deadline of ${timeoutMs}ms.`,
      422
    );
  }

  // Convert Node.js Buffer to Uint8Array as required by unpdf / pdfjs-dist
  const uint8Data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // Set up extraction deadline race
  let timerId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(
        new ExtractionError(
          'EXTRACTION_TIMEOUT',
          `PDF text extraction exceeded the deadline of ${timeoutMs}ms.`,
          422
        )
      );
    }, timeoutMs);
    if (typeof timerId.unref === 'function') timerId.unref();
  });

  try {
    const extractionPromise = extractText(uint8Data);
    const result = await Promise.race([extractionPromise, timeoutPromise]);

    // Handle extraction result: result.text is string[] (one entry per page)
    const rawPages = Array.isArray(result?.text)
      ? result.text
      : typeof result?.text === 'string'
      ? [result.text]
      : [];

    const rawJoinedText = rawPages.join('\n\n');
    const sanitized = sanitizeResumeText(rawJoinedText);
    const validated = validateExtractedText(sanitized);

    return {
      text: validated.text,
      totalPages: result?.totalPages || rawPages.length || 1,
      format: 'pdf',
      characterCount: validated.characterCount,
      wordCount: validated.wordCount,
    };
  } catch (err) {
    if (err instanceof ExtractionError) {
      throw err;
    }

    // Inspect error types from pdfjs-dist / unpdf
    const errName = err?.name || '';
    const errMsg = (err?.message || '').toLowerCase();

    if (errName === 'PasswordException' || errMsg.includes('password') || errMsg.includes('encrypt')) {
      throw new ExtractionError(
        'DOCUMENT_ENCRYPTED',
        'The PDF document is encrypted or password-protected and cannot be processed.',
        422
      );
    }

    if (
      errName === 'InvalidPDFException' ||
      errMsg.includes('invalid pdf') ||
      errMsg.includes('corrupted') ||
      errMsg.includes('format error')
    ) {
      throw new ExtractionError(
        'CORRUPTED_DOCUMENT',
        'The PDF document structure is corrupted or invalid.',
        422
      );
    }

    throw new ExtractionError(
      'EXTRACTION_FAILED',
      `Failed to extract text from PDF document: ${err.message || 'unknown error'}`,
      422
    );
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }
  }
};

export default {
  extractTextFromPdf,
};
