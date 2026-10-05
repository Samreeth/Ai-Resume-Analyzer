/**
 * Resume PII Minimization and Data Sanitization Utility
 *
 * Scans and redacts common contact identifiers (emails, phone numbers, street addresses)
 * prior to external AI transmission, and sanitizes returned model outputs.
 *
 * KNOWN LIMITATIONS:
 * 1. Regex-based scrubbing reduces accidental exposure of direct contact info, but is NOT
 *    full anonymization. Candidate names, school names, employer names, GitHub handles,
 *    and LinkedIn URLs may remain identifiable in the text.
 * 2. Unconventional international phone formats or non-standard residential address formats
 *    may not match standard heuristics.
 * 3. Transparent disclosure and explicit user consent are therefore required.
 */

// Matches standard email addresses
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// Matches US and international phone formats without falsely matching date ranges like 2020-2024
const PHONE_REGEX =
  /(?:(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b)|(?:\+\d{1,4}[-.\s]?\d{6,12}\b)/g;

// Matches standard street address patterns (e.g. "123 Main Street", "456 Elm Ave.", "123 Example Street, Hyderabad")
const STREET_ADDRESS_REGEX =
  /\b\d{1,5}\s+[A-Za-z0-9.,\s]{1,40}?\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Circle|Cir|Highway|Hwy|Square|Sq)\b[.,]?/gi;

// Matches US zip codes with state prefix (CA 94103), ZIP+4 (94103-1234), labeled PIN/ZIP codes, UK/Canada formats, and 6-digit PIN codes
const POSTAL_CODE_REGEX =
  /(?:\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b)|(?:\b\d{5}-\d{4}\b)|(?:\b(?:ZIP|PIN|Postal(?:\s+Code)?|Zipcode|Postcode)[\s:#-]*[A-Z0-9-]+\b)|(?:\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b)|(?:\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b)|(?:\b\d{6}\b)/gi;

/**
 * Scrub PII from candidate resume text before passing it to external AI services.
 *
 * @param {string} text - Raw extracted resume text
 * @returns {string} Sanitized text with redacted emails, phone numbers, and addresses
 */
export const sanitizeResumePii = (text) => {
  if (typeof text !== 'string') return '';

  let sanitized = text;

  // 1. Redact email addresses
  sanitized = sanitized.replace(EMAIL_REGEX, '[EMAIL_REDACTED]');

  // 2. Redact phone numbers
  sanitized = sanitized.replace(PHONE_REGEX, '[PHONE_REDACTED]');

  // 3. Redact street addresses
  sanitized = sanitized.replace(STREET_ADDRESS_REGEX, '[ADDRESS_REDACTED]');

  // 4. Redact postal codes
  sanitized = sanitized.replace(POSTAL_CODE_REGEX, '[POSTAL_REDACTED]');

  return sanitized;
};

/**
 * Deeply sanitize model output fields to ensure model reflection does not leak PII
 * (including emails, phone numbers, street addresses, and postal/ZIP codes).
 *
 * @param {any} value - Object, array, or primitive returned by model
 * @returns {any} Sanitized clone of value
 */
export const sanitizeModelOutputPii = (value) => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value
      .replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
      .replace(PHONE_REGEX, '[PHONE_REDACTED]')
      .replace(STREET_ADDRESS_REGEX, '[ADDRESS_REDACTED]')
      .replace(POSTAL_CODE_REGEX, '[POSTAL_REDACTED]');
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeModelOutputPii(item));
  }

  if (typeof value === 'object') {
    const sanitizedObj = {};
    for (const [key, val] of Object.entries(value)) {
      if (/^(?:postal_?code|zip_?code|zip|pin_?code|pincode)$/i.test(key) && val) {
        sanitizedObj[key] = '[POSTAL_REDACTED]';
      } else if (/^(?:street_?address|address_?line|street)$/i.test(key) && val) {
        sanitizedObj[key] = '[ADDRESS_REDACTED]';
      } else {
        sanitizedObj[key] = sanitizeModelOutputPii(val);
      }
    }
    return sanitizedObj;
  }

  return value;
};

export default {
  sanitizeResumePii,
  sanitizeModelOutputPii,
};
