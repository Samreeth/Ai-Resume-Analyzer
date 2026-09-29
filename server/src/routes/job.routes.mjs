import express from 'express';
import jobController from '../controllers/job.controller.mjs';
import { requireAuth } from '../middleware/auth.middleware.mjs';

const router = express.Router();

// Enforce authentication across all job description endpoints
router.use(requireAuth);

// 1. Ingest new job description
router.post('/', jobController.create);

// 2. List authenticated user's job descriptions
router.get('/', jobController.list);

// 3. Retrieve single job description details
router.get('/:jobId', jobController.getById);

// 4. Update job description (consistent partial update under PUT)
router.put('/:jobId', jobController.update);

// 5. Delete job description
router.delete('/:jobId', jobController.deleteById);

// 6. Force skill re-extraction on existing job description
router.post('/:jobId/extract', jobController.extract);

export default router;
