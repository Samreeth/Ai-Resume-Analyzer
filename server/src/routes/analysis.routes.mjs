import express from 'express';
import analysisController from '../controllers/analysis.controller.mjs';
import { requireAuth } from '../middleware/auth.middleware.mjs';

const router = express.Router();

// Enforce authentication across all analysis endpoints
router.use(requireAuth);

// 1. Create new analysis
router.post('/', analysisController.create);

// 2. List authenticated user's analyses with pagination
router.get('/', analysisController.list);

// 3. Retrieve single analysis details
router.get('/:analysisId', analysisController.getById);

// 4. Delete an analysis record
router.delete('/:analysisId', analysisController.deleteById);

export default router;
