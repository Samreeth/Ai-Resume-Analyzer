import path from 'path';
import crypto from 'crypto';
import yauzl from 'yauzl';
import config from '../config/env.mjs';

export const ALLOWED_MIME_TYPES = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

/**
 * Validate file magic bytes for PDF and ZIP/DOCX
 * @param {Buffer} buffer
 * @returns {'pdf' | 'docx' | null}
 */
export const detectFormatFromMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 4) return null;

  // PDF check: %PDF (0x25, 0x50, 0x44, 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'pdf';
  }

  // ZIP check: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return 'docx';
  }

  return null;
};

/**
 * Validate DOCX Open Packaging Conventions archive metadata using yauzl
 * Operates purely on memory buffer without writing or extracting to disk.
 * Requires root-level [Content_Types].xml and word/document.xml.
 * Does NOT accept word/document2.xml or alternative names.
 * Enforces strict limits on entry counts, name lengths, and path traversal characters.
 * @param {Buffer} buffer
 * @returns {Promise<boolean>}
 */
export const validateDocxArchive = (buffer) => {
  return new Promise((resolve) => {
    let isSettled = false;

    const finish = (isValid, zipfile = null) => {
      if (isSettled) return;
      isSettled = true;
      if (zipfile) {
        try {
          zipfile.close();
        } catch (_) {
          // ignore error on close
        }
      }
      resolve(isValid);
    };

    yauzl.fromBuffer(buffer, { lazyEntries: true, decodeStrings: true }, (err, zipfile) => {
      if (err || !zipfile) {
        return finish(false);
      }

      let hasContentTypes = false;
      let hasWordDocument = false;
      let entryCount = 0;

      zipfile.on('error', () => {
        finish(false, zipfile);
      });

      zipfile.on('entry', (entry) => {
        if (isSettled) return;

        entryCount++;

        // 1. Max entry count threshold (1,000 entries max)
        if (entryCount > 1000) {
          return finish(false, zipfile);
        }

        const fileName = entry.fileName;

        // 2. Entry name length limit (max 255 chars)
        if (!fileName || typeof fileName !== 'string' || fileName.length > 255) {
          return finish(false, zipfile);
        }

        // 3. Reject path traversal, absolute paths, and backslashes
        if (
          fileName.includes('..') ||
          fileName.startsWith('/') ||
          fileName.startsWith('\\') ||
          fileName.includes('\\')
        ) {
          return finish(false, zipfile);
        }

        // Check for required OPC parts
        if (fileName === '[Content_Types].xml') {
          hasContentTypes = true;
        }

        // Strict main document check: only 'word/document.xml' accepted
        if (fileName === 'word/document.xml') {
          hasWordDocument = true;
        }

        // Continue reading to audit all entries for security violations
        if (!isSettled) {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        finish(hasContentTypes && hasWordDocument, zipfile);
      });

      // Initiate entry traversal
      zipfile.readEntry();
    });
  });
};

/**
 * Sanitize client-provided original filename for display and metadata purposes
 * Never use this as a physical OS storage filename.
 * @param {string} originalName
 * @param {string} fallbackExtension
 * @returns {string}
 */
export const sanitizeDisplayName = (originalName, fallbackExtension = '.pdf') => {
  if (!originalName || typeof originalName !== 'string') {
    return `resume${fallbackExtension}`;
  }

  // Strip directory paths
  let baseName = path.basename(originalName);

  // Remove control characters (0x00-0x1F, 0x7F) and hazardous injection characters
  baseName = baseName.replace(/[\u0000-\u001F\u007F<>:"'\/\\|?*]/g, '_');

  // Collapse multiple underscores or spaces
  baseName = baseName.replace(/[_\s]+/g, '_').trim();

  // Enforce max length of 255
  if (baseName.length > 255) {
    const ext = path.extname(baseName);
    const nameWithoutExt = baseName.slice(0, 255 - ext.length);
    baseName = `${nameWithoutExt}${ext}`;
  }

  if (!baseName || baseName === '.' || baseName.startsWith('.')) {
    return `resume${fallbackExtension}`;
  }

  return baseName;
};

/**
 * Resolve and validate internal relative file path against upload directory jail
 * @param {string} relativePath (e.g. "resumes/<uuid>.<ext>")
 * @param {string} baseDir
 * @returns {string} Absolute validated path
 */
export const resolveSecurePath = (relativePath, baseDir = config.uploadDir) => {
  if (!relativePath || typeof relativePath !== 'string') {
    const err = new Error('File path must be a non-empty string');
    err.code = 'INVALID_PATH';
    throw err;
  }

  // Strict regex pattern enforcing format: resumes/<uuid>.<ext>
  const safePathRegex = /^resumes\/[0-9a-fA-F-]{36}\.(pdf|docx)$/;
  if (!safePathRegex.test(relativePath)) {
    const err = new Error('Invalid internal file path format');
    err.code = 'INVALID_PATH';
    throw err;
  }

  const canonicalUploadRoot = path.resolve(baseDir, 'resumes');
  const resolvedTarget = path.resolve(baseDir, relativePath);

  if (!resolvedTarget.startsWith(canonicalUploadRoot + path.sep)) {
    const err = new Error('Path traversal attempt detected');
    err.code = 'SECURITY_VIOLATION';
    throw err;
  }

  return resolvedTarget;
};

/**
 * Compute SHA-256 hash from a Buffer
 * @param {Buffer} buffer
 * @returns {string} 64-character lowercase hex hash
 */
export const computeFileHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

export default {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  detectFormatFromMagicBytes,
  validateDocxArchive,
  sanitizeDisplayName,
  resolveSecurePath,
  computeFileHash,
};
