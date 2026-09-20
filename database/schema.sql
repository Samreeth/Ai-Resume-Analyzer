-- ============================================================================
-- AI-Powered Resume Analyzer: Consolidated Database Schema Snapshot
-- ============================================================================
-- PURPOSE OF THIS FILE:
-- 1. This file serves exclusively as a consolidated, cumulative reference snapshot
--    of the complete database schema.
-- 2. It is NOT executed automatically by Docker Compose (Docker uses database/docker-init.sql
--    to initialize prerequisites, allowing the migration runner to manage all schema state).
-- 3. The versioned migration files in database/migrations/ are the SINGLE AUTHORITATIVE
--    SOURCE OF TRUTH. Schema changes must always be applied via `npm run db:migrate`.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reusable Automatic updated_at Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Resumes Table
CREATE TABLE IF NOT EXISTS resumes (
    resume_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    extracted_data JSONB,
    extraction_status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (extraction_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'))
);

CREATE OR REPLACE TRIGGER trg_resumes_updated_at
    BEFORE UPDATE ON resumes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. Job Descriptions Table
CREATE TABLE IF NOT EXISTS job_descriptions (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    extracted_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE TRIGGER trg_job_descriptions_updated_at
    BEFORE UPDATE ON job_descriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Skills Table (Master Dictionary)
CREATE TABLE IF NOT EXISTS skills (
    skill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Resume Skills Table (Join Table)
CREATE TABLE IF NOT EXISTS resume_skills (
    resume_id UUID NOT NULL REFERENCES resumes(resume_id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(skill_id) ON DELETE RESTRICT,
    confidence DECIMAL(5, 2) NOT NULL DEFAULT 1.00
        CHECK (confidence >= 0.00 AND confidence <= 1.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (resume_id, skill_id)
);

-- 6. Analyses Table (Historical Compatibility Reports)
CREATE TABLE IF NOT EXISTS analyses (
    analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(resume_id) ON DELETE SET NULL,
    job_id UUID REFERENCES job_descriptions(job_id) ON DELETE SET NULL,
    resume_file_name VARCHAR(255),
    job_title VARCHAR(255),
    overall_score DECIMAL(5, 2) NOT NULL
        CHECK (overall_score >= 0.00 AND overall_score <= 100.00),
    skill_score DECIMAL(5, 2) NOT NULL
        CHECK (skill_score >= 0.00 AND skill_score <= 100.00),
    experience_score DECIMAL(5, 2) NOT NULL
        CHECK (experience_score >= 0.00 AND experience_score <= 100.00),
    project_score DECIMAL(5, 2) NOT NULL
        CHECK (project_score >= 0.00 AND project_score <= 100.00),
    education_score DECIMAL(5, 2) NOT NULL
        CHECK (education_score >= 0.00 AND education_score <= 100.00),
    quality_score DECIMAL(5, 2) NOT NULL
        CHECK (quality_score >= 0.00 AND quality_score <= 100.00),
    scoring_version VARCHAR(50) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Analysis Skills Table (Itemized Match Results)
CREATE TABLE IF NOT EXISTS analysis_skills (
    analysis_id UUID NOT NULL REFERENCES analyses(analysis_id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(skill_id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('MATCHED', 'MISSING', 'PARTIAL')),
    evidence TEXT,
    similarity_score DECIMAL(5, 2)
        CHECK (similarity_score IS NULL OR (similarity_score >= 0.00 AND similarity_score <= 100.00)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (analysis_id, skill_id)
);

-- ============================================================================
-- Indexes for Performance & Data Integrity
-- ============================================================================

-- Foreign Key Lookups
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON job_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_resume_id ON analyses(resume_id);
CREATE INDEX IF NOT EXISTS idx_analyses_job_id ON analyses(job_id);
CREATE INDEX IF NOT EXISTS idx_resume_skills_skill_id ON resume_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_analysis_skills_skill_id ON analysis_skills(skill_id);

-- Case-Insensitive User Email Unique Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON users ((LOWER(email)));

-- Case-Insensitive Skill Name Unique Expression Index for O(1) Fast & Duplicate-Safe Matching
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_lower_name ON skills ((LOWER(skill_name)));

-- Dashboard Analysis History Sorting Compound Index
CREATE INDEX IF NOT EXISTS idx_analyses_user_history ON analyses (user_id, created_at DESC);
