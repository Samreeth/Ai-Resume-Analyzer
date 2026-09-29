/**
 * Text processing and sanitization utilities for extracted resume content.
 * Preserves structural formatting (paragraphs, linebreaks, tabs, bullet points)
 * essential for downstream parsing and analysis while stripping dangerous or non-printable bytes.
 */

export class ExtractionError extends Error {
  /**
   * @param {string} code - Standardized machine error code
   * @param {string} message - User-safe error description
   * @param {number} [statusCode=422] - Associated HTTP status code
   * @param {object|null} [details=null] - Optional structured error details
   */
  constructor(code, message, statusCode = 422, details = null) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const EXTRACTION_LIMITS = {
  MIN_READABLE_CHARS: 20,
  MAX_TEXT_LENGTH: 500000, // ~100 pages of text
  MAX_XML_STREAM_BYTES: 10 * 1024 * 1024, // 10 MB uncompressed XML limit
  MAX_ARCHIVE_TOTAL_BYTES: 10 * 1024 * 1024, // 10 MB total read across entries
  DEFAULT_TIMEOUT_MS: 10000, // 10 seconds
};

/**
 * Sanitize raw extracted document text while preserving document structure
 * (paragraphs, section breaks, bullets, and indentation).
 *
 * @param {string} rawText
 * @returns {string}
 */
export const sanitizeResumeText = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  // 1. Normalize Unicode characters (standardizes composite accents & ligatures like fi, fl)
  let text = rawText.normalize('NFKC');

  // 2. Remove null bytes (\u0000) and dangerous ASCII control characters
  // Preserves \t (0x09), \n (0x0A), and \r (0x0D)
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  // 3. Standardize line breaks: convert \r\n and \r to \n
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 4. Clean line-by-line whitespace while preserving structure
  const lines = text.split('\n').map((line) => {
    // Collapse multiple non-tab horizontal spaces into a single space
    let cleaned = line.replace(/[^\S\t]+/g, ' ');
    // Remove trailing whitespace on each line
    return cleaned.trimEnd();
  });

  text = lines.join('\n');

  // 5. Collapse 3+ consecutive newlines to exactly 2 (\n\n) to preserve paragraph separation
  text = text.replace(/\n{3,}/g, '\n\n');

  // 6. Trim leading/trailing whitespace of the entire document
  return text.trim();
};

/**
 * Validate sanitized text against character bounds and readability criteria.
 *
 * @param {string} sanitizedText
 * @param {object} [options={}]
 * @param {number} [options.minCharacters]
 * @param {number} [options.maxCharacters]
 * @returns {{ text: string, characterCount: number, wordCount: number }}
 * @throws {ExtractionError}
 */
export const validateExtractedText = (sanitizedText, options = {}) => {
  const minChars = options.minCharacters ?? EXTRACTION_LIMITS.MIN_READABLE_CHARS;
  const maxChars = options.maxCharacters ?? EXTRACTION_LIMITS.MAX_TEXT_LENGTH;

  if (!sanitizedText || typeof sanitizedText !== 'string') {
    throw new ExtractionError(
      'NO_READABLE_TEXT',
      'The document contains no readable text. Scanned images or OCR are not currently supported.',
      422
    );
  }

  // Count printable non-whitespace characters
  const printableChars = sanitizedText.replace(/\s/g, '').length;
  if (printableChars < minChars) {
    throw new ExtractionError(
      'NO_READABLE_TEXT',
      'The document contains insufficient readable text. Scanned images or OCR are not currently supported.',
      422
    );
  }

  if (sanitizedText.length > maxChars) {
    throw new ExtractionError(
      'TEXT_LIMIT_EXCEEDED',
      `Extracted document text exceeds the maximum allowed limit of ${maxChars} characters.`,
      422
    );
  }

  // Word count estimation based on whitespace separation
  const words = sanitizedText.split(/\s+/).filter(Boolean);

  return {
    text: sanitizedText,
    characterCount: sanitizedText.length,
    wordCount: words.length,
  };
};

export default {
  ExtractionError,
  EXTRACTION_LIMITS,
  sanitizeResumeText,
  validateExtractedText,
};
