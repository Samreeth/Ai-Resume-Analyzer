-- Migration 005: Add Resume Plain-Text, Processing Audit Columns, and Claim Token
-- Authoritative Source of Truth: database/migrations/

-- 1. Add processing and plain-text extraction columns
ALTER TABLE resumes
    ADD COLUMN IF NOT EXISTS extracted_text TEXT,
    ADD COLUMN IF NOT EXISTS processing_error_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS processing_error_message TEXT,
    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS processing_token UUID;

-- 2. Backfill existing legacy rows (if any) to ensure processing_attempts default integrity
UPDATE resumes
SET processing_attempts = COALESCE(processing_attempts, 0)
WHERE processing_attempts IS NULL;

-- 3. Enforce non-negative bounds on processing_attempts
ALTER TABLE resumes
    DROP CONSTRAINT IF EXISTS chk_resumes_processing_attempts,
    ADD CONSTRAINT chk_resumes_processing_attempts CHECK (processing_attempts >= 0);

-- 4. Partial index for efficient stale-processing recovery queries
CREATE INDEX IF NOT EXISTS idx_resumes_status_stale
    ON resumes (extraction_status, processing_started_at)
    WHERE extraction_status = 'PROCESSING';

-- 5. Partial index for fast lookups on active processing claim tokens
CREATE INDEX IF NOT EXISTS idx_resumes_processing_token
    ON resumes (processing_token)
    WHERE processing_token IS NOT NULL;
