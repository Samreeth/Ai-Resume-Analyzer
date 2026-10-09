-- Migration 006: Add persistent binary file storage for serverless environments
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_data BYTEA;
