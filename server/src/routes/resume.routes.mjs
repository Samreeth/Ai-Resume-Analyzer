import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.mjs';
import { handleResumeUpload } from '../middleware/upload.middleware.mjs';
import resumeController from '../controllers/resume.controller.mjs';

const router = express.Router();

// Enforce authentication on all resume endpoints
router.use(requireAuth);

// 1. Upload a new resume (multipart/form-data)
router.post('/', handleResumeUpload, resumeController.upload);

// 2. List user resumes (with pagination)
router.get('/', resumeController.list);

// 3. Get resume details by ID
router.get('/:resumeId', resumeController.getById);

// 4. Delete resume by ID
router.delete('/:resumeId', resumeController.deleteById);

export default router;
