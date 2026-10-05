import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.mjs';
import { handleResumeUpload } from '../middleware/upload.middleware.mjs';
import resumeController from '../controllers/resume.controller.mjs';
import processingController from '../controllers/processing.controller.mjs';
import resumeAiController from '../controllers/resume.ai.controller.mjs';
import { aiGenerationRateLimiter } from '../middleware/rate-limit.middleware.mjs';

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

// 5. Generate or refresh AI resume understanding profile (rate limited)
router.post('/:resumeId/ai-profile', aiGenerationRateLimiter, resumeAiController.generateAiProfile);

// 6. Retrieve cached AI resume understanding profile
router.get('/:resumeId/ai-profile', resumeAiController.getAiProfile);

// 7. Generate or refresh AI contextual job comparison (rate limited)
router.post(
  '/:resumeId/ai-job-comparison',
  aiGenerationRateLimiter,
  resumeAiController.generateAiJobComparison
);

// 8. Retrieve cached AI contextual job comparison
router.get('/:resumeId/ai-job-comparison', resumeAiController.getAiJobComparison);

// 9. Generate or refresh AI personalized recommendations (rate limited)
router.post(
  '/:resumeId/ai-recommendations',
  aiGenerationRateLimiter,
  resumeAiController.generateAiRecommendations
);

// 10. Retrieve cached AI personalized recommendations
router.get('/:resumeId/ai-recommendations', resumeAiController.getAiRecommendations);

// 11. Get resume details by ID
router.get('/:resumeId', resumeController.getById);

// 12. Delete resume by ID
router.delete('/:resumeId', resumeController.deleteById);

export default router;

