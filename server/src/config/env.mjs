import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env if available
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resume_analyzer',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  nlpServiceUrl: process.env.NLP_SERVICE_URL || 'http://localhost:8000',
  nlpServiceToken: process.env.NLP_SERVICE_TOKEN || '',
  uploadDir: path.resolve(__dirname, process.env.UPLOAD_DIR || '../../../uploads'),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
};

// Validate production environment requirements
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'dev_secret_change_in_production' || secret.length < 32) {
    throw new Error(
      '[FATAL CONFIG ERROR] In production, JWT_SECRET must be set to a secure random string of at least 32 characters.'
    );
  }
}

export default config;
