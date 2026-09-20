import { Router } from 'express';
import { register, login, getMe, logout } from '../controllers/auth.controller.mjs';
import { validateBody } from '../middleware/validation.middleware.mjs';
import { requireAuth } from '../middleware/auth.middleware.mjs';
import { registerSchema, loginSchema } from '../validators/auth.validator.mjs';

const router = Router();

// Public Authentication Endpoints
router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.post('/logout', logout);

// Protected Authentication Endpoints
router.get('/me', requireAuth, getMe);

export default router;
