import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import config from './config/env.mjs';
import { testDbConnection } from './config/database.mjs';
import { sendSuccess } from './utils/response.mjs';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.mjs';
import authRoutes from './routes/auth.routes.mjs';

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or matching allowed origins
      if (!origin || origin === config.clientUrl || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
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

// 404 Not Found Middleware
app.use(notFoundHandler);

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
