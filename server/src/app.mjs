import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import config from './config/env.mjs';
import { testDbConnection } from './config/database.mjs';
import { sendSuccess } from './utils/response.mjs';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.mjs';
import authRoutes from './routes/auth.routes.mjs';
import resumeRoutes from './routes/resume.routes.mjs';
import jobRoutes from './routes/job.routes.mjs';
import analysisRoutes from './routes/analysis.routes.mjs';

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      const isAllowedExplicit =
        origin === config.clientUrl ||
        (config.clientUrl?.includes(',') &&
          config.clientUrl.split(',').map((u) => u.trim()).includes(origin));

      const isLocalhost =
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:');

      // Automatically allow Vercel production & preview domains (*.vercel.app)
      const isVercel =
        origin.endsWith('.vercel.app') ||
        /^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/.test(origin);

      if (isAllowedExplicit || isLocalhost || isVercel) {
        callback(null, true);
      } else {
        callback(new Error(`Blocked by CORS policy for origin: ${origin}`));
      }
    },
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/health', async (req, res, next) => {
  try {
    const dbStatus = await testDbConnection();

    return sendSuccess(
      res,
      {
        status: 'UP',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: config.env,
        services: {
          database: dbStatus.connected ? 'CONNECTED' : 'DISCONNECTED',
          ...(dbStatus.error && { databaseError: dbStatus.error }),
        },
      },
      'Service health status'
    );
  } catch (error) {
    next(error);
  }
});

// Root API Information Route
app.get('/api', (req, res) => {
  return sendSuccess(
    res,
    {
      name: 'AI-Powered Resume Analyzer API',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        resumes: '/api/resumes',
        jobs: '/api/jobs',
        analyses: '/api/analyses',
      },
    },
    'API is active'
  );
});

// Authentication Routes
app.use('/api/auth', authRoutes);

// Resume Management Routes
app.use('/api/resumes', resumeRoutes);

// Job Description Management Routes
app.use('/api/jobs', jobRoutes);

// Analysis & Matching Routes
app.use('/api/analyses', analysisRoutes);

// 404 Not Found Middleware
app.use(notFoundHandler);

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
