-- Migration 004: Add Resume Metadata Columns and User Uploaded Index
-- Authoritative Source of Truth: database/migrations/

-- 1. Add new metadata columns as nullable initially for safe schema evolution
ALTER TABLE resumes
    ADD COLUMN IF NOT EXISTS file_size INTEGER,
    ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);

-- 2. Backfill existing rows (if any exist) with safe default metadata
UPDATE resumes
SET 
    file_size = COALESCE(file_size, 0),
    mime_type = COALESCE(mime_type, 'application/octet-stream')
WHERE file_size IS NULL OR mime_type IS NULL;

-- 3. Add bounds check for file_size
ALTER TABLE resumes
    DROP CONSTRAINT IF EXISTS chk_resumes_file_size,
    ADD CONSTRAINT chk_resumes_file_size CHECK (file_size IS NULL OR file_size >= 0);

-- 4. Add composite index for efficient user resume pagination & sorting
CREATE INDEX IF NOT EXISTS idx_resumes_user_uploaded
    ON resumes (user_id, uploaded_at DESC);
