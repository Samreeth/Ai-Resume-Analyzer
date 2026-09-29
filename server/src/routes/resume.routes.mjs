import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.mjs';
import { handleResumeUpload } from '../middleware/upload.middleware.mjs';
import resumeController from '../controllers/resume.controller.mjs';
import processingController from '../controllers/processing.controller.mjs';

const router = express.Router();

// Enforce authentication on all resume endpoints
router.use(requireAuth);

// 1. Upload a new resume (multipart/form-data)
router.post('/', handleResumeUpload, resumeController.upload);

// 2. List user resumes (with pagination)
router.get('/', resumeController.list);

// 3. Process text extraction for a resume
router.post('/:resumeId/process', processingController.processResume);

// 4. Get processing status for a resume
router.get('/:resumeId/status', processingController.getStatus);

// 5. Get resume details by ID
router.get('/:resumeId', resumeController.getById);

// 6. Delete resume by ID
router.delete('/:resumeId', resumeController.deleteById);

export default router;
