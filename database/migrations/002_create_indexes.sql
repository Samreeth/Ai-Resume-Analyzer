-- Migration 002: Create Performance and Look-up Indexes
-- Authoritative Source of Truth: database/migrations/

-- Foreign Key Lookups
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON job_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_resume_id ON analyses(resume_id);
CREATE INDEX IF NOT EXISTS idx_analyses_job_id ON analyses(job_id);
CREATE INDEX IF NOT EXISTS idx_resume_skills_skill_id ON resume_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_analysis_skills_skill_id ON analysis_skills(skill_id);

-- Case-Insensitive Skill Name Unique Expression Index for O(1) Fast & Duplicate-Safe Matching
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_lower_name ON skills ((LOWER(skill_name)));

-- Dashboard Analysis History Sorting Compound Index
CREATE INDEX IF NOT EXISTS idx_analyses_user_history ON analyses (user_id, created_at DESC);
