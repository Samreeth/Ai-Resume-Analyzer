import multer from 'multer';
import path from 'path';
import config from '../config/env.mjs';
import { sendError } from '../utils/response.mjs';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  detectFormatFromMagicBytes,
  validateDocxArchive,
} from '../utils/file.util.mjs';

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
    files: 1,
  },
});

/**
 * Express middleware handling multipart upload and deep file security validation
 */
export const handleResumeUpload = (req, res, next) => {
  const singleUpload = upload.single('resume');

  singleUpload(req, res, async (err) => {
    // 1. Handle Multer-specific errors
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(
            res,
            'FILE_TOO_LARGE',
            `File size exceeds the allowed limit of ${config.maxFileSizeMb}MB`,
            413
          );
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
          return sendError(
            res,
            'VALIDATION_ERROR',
            `Unexpected field or multiple files. Only a single file in 'resume' field is permitted`,
            400
          );
        }
        return sendError(res, 'VALIDATION_ERROR', err.message, 400);
      }
      return next(err);
    }

    // 2. Validate file presence
    if (!req.file) {
      return sendError(
        res,
        'VALIDATION_ERROR',
        "Resume file is required in 'resume' form field",
        400
      );
    }

    // 3. Validate non-empty file
    if (!req.file.size || req.file.size === 0 || !req.file.buffer || req.file.buffer.length === 0) {
      return sendError(res, 'VALIDATION_ERROR', 'Uploaded file is empty (0 bytes)', 400);
    }

    const originalExt = path.extname(req.file.originalname || '').toLowerCase();
    const declaredMime = (req.file.mimetype || '').toLowerCase();

    // 4. Validate extension whitelist
    if (!ALLOWED_EXTENSIONS.includes(originalExt)) {
      return sendError(
        res,
        'UNSUPPORTED_MEDIA_TYPE',
        `Unsupported file extension '${originalExt}'. Only .pdf and .docx files are accepted`,
        415
      );
    }

    // 5. Validate declared MIME type
    const expectedMime =
      originalExt === '.pdf' ? ALLOWED_MIME_TYPES.PDF : ALLOWED_MIME_TYPES.DOCX;

    if (declaredMime !== expectedMime) {
      return sendError(
        res,
        'UNSUPPORTED_MEDIA_TYPE',
        `MIME type '${declaredMime}' does not match expected extension '${originalExt}'`,
        415
      );
    }

    // 6. Magic bytes header inspection
    const detectedFormat = detectFormatFromMagicBytes(req.file.buffer);
    const expectedFormat = originalExt === '.pdf' ? 'pdf' : 'docx';

    if (!detectedFormat || detectedFormat !== expectedFormat) {
      return sendError(
        res,
        'UNSUPPORTED_MEDIA_TYPE',
        `File magic byte signature does not match expected format for '${originalExt}'`,
        415
      );
    }

    // 7. DOCX Open Packaging Conventions deep structure check via yauzl
    if (expectedFormat === 'docx') {
      const isValidDocx = await validateDocxArchive(req.file.buffer);
      if (!isValidDocx) {
        return sendError(
          res,
          'UNSUPPORTED_MEDIA_TYPE',
          'Invalid or malformed DOCX archive structure. Must contain [Content_Types].xml and word/document.xml',
          415
        );
      }
    }

    // All validation passed; proceed to controller
    next();
  });
};

export default {
  handleResumeUpload,
};
