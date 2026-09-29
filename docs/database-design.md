# Database Design Specification

**Database Engine**: PostgreSQL 16 (WSL2 Ubuntu / Linux)  
**Schema Definition**: `database/schema.sql`  
**Migration Pipeline**: Versioned SQL migrations in `database/migrations/` (Migrations 001–005)  
**Master Seed Catalog**: `database/seeds/001_initial_skills.sql` and `002_taxonomy_skills.sql` (86 canonical skills)  

---

## 1. Relational Architecture Overview

The database design provides strict multi-tenant isolation, data integrity, auditability, and analytical history preservation.

```text
  ┌────────────────────────┐         1..N        ┌────────────────────────┐
  │         users          ├────────────────────►│        resumes         │
  │ PK: user_id (UUID)     │                     │ PK: resume_id (UUID)   │
  │ email (UNIQUE, LOWER)  │                     │ FK: user_id (CASCADE)  │
  │ password_hash (TEXT)   │                     │ extraction_status      │
  └───────────┬────────────┘                     │ extracted_text (TEXT)  │
              │ 1..N                             └───────────┬────────────┘
              │                                              │ 1..N
              ▼                                              ▼
  ┌────────────────────────┐                     ┌────────────────────────┐
  │    job_descriptions    │                     │     resume_skills      │
  │ PK: job_id (UUID)      │                     │ PK: (resume_id,skill_id│
  │ FK: user_id (CASCADE)  │                     │ confidence (0.00-1.00) │
  │ extracted_data (JSONB) │                     └───────────┬────────────┘
  └───────────┬────────────┘                                 │ N..1
              │ 1..N                                         ▼
              ▼                                  ┌────────────────────────┐
  ┌────────────────────────┐                     │         skills         │
  │        analyses        │                     │ PK: skill_id (UUID)    │
  │ PK: analysis_id (UUID) │                     │ skill_name (UNIQUE)    │
  │ FK: user_id (CASCADE)  │                     │ category (VARCHAR)     │
  │ FK: resume_id(SET NULL)│                     └───────────▲────────────┘
  │ FK: job_id  (SET NULL) │                                 │ N..1
  │ scores: 0-100 (DECIMAL)│                                 │
  └───────────┬────────────┘                                 │
              │ 1..N                                         │
              ▼                                              │
  ┌────────────────────────┐                                 │
  │    analysis_skills     ├─────────────────────────────────┘
  │ PK:(analysis_id,skill) │
  │ status: MATCHED/etc.   │
  │ evidence: [REQ]/[PREF] │
  └────────────────────────┘
```

---

## 2. Table Specifications & Integrity Constraints

### 2.1 `users` Table
Stores registered application users. Managed in `database/migrations/001_create_tables.sql` and `003_case_insensitive_user_email.sql`.

| Column | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `user_id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique user identifier |
| `name` | VARCHAR(255) | NOT NULL | User's full name |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | User email address |
| `password_hash` | TEXT | NOT NULL | bcrypt salted hash (10 rounds) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Account creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Automatic trigger update |

*Index*: Unique expression index `idx_users_lower_email ON users ((LOWER(email)))` prevents duplicate accounts regardless of case.

### 2.2 `resumes` Table
Stores uploaded resume files and extraction lifecycles. Managed in Migrations `001`, `004`, and `005`.

| Column | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `resume_id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique resume identifier |
| `user_id` | UUID | NOT NULL, FK → `users(user_id)` ON DELETE CASCADE | Tenant owner identifier |
| `file_name` | VARCHAR(255) | NOT NULL | Sanitized display filename |
| `file_path` | TEXT | NOT NULL | Storage path in `uploads/resumes/` |
| `file_size` | INTEGER | CHECK (`file_size IS NULL OR file_size >= 0`) | Binary file size in bytes |
| `mime_type` | VARCHAR(100) | Valid MIME string | Whitelisted PDF or DOCX MIME |
| `file_hash` | VARCHAR(64) | Hex string | SHA-256 binary content hash |
| `uploaded_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Initial upload timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Automatic trigger update |
| `extracted_data` | JSONB | Nullable | Extracted structured metadata |
| `extraction_status` | VARCHAR(50) | NOT NULL, DEFAULT `'PENDING'` | Lifecycle state: `'PENDING'`, `'PROCESSING'`, `'COMPLETED'`, `'FAILED'` |
| `extracted_text` | TEXT | Nullable | Normalized plain text extracted from document |
| `processing_error_code` | VARCHAR(100) | Nullable | Error code string if extraction fails |
| `processing_error_message` | TEXT | Nullable | Diagnostic error explanation |
| `processing_started_at` | TIMESTAMPTZ | Nullable | Timestamp when worker claimed task |
| `processing_completed_at` | TIMESTAMPTZ | Nullable | Timestamp when worker finalized task |
| `processing_attempts` | INTEGER | NOT NULL, DEFAULT 0, CHECK (`processing_attempts >= 0`) | Count of processing attempts (max 3) |
| `processing_token` | UUID | Nullable | Atomic worker claim token |

### 2.3 `job_descriptions` Table
Stores target job postings and extracted requirements. Managed in Migration `001`.

| Column | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `job_id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique job identifier |
| `user_id` | UUID | NOT NULL, FK → `users(user_id)` ON DELETE CASCADE | Tenant owner identifier |
| `title` | VARCHAR(255) | NOT NULL | Job role title |
| `description` | TEXT | NOT NULL | Full job description text |
| `extracted_data` | JSONB | Nullable | Extracted `requiredSkills` and `preferredSkills` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Automatic trigger update |

### 2.4 `skills` Table (Master Taxonomy)
Master catalog of canonical skills. Managed in Migration `001` and seeded via `001_initial_skills.sql` and `002_taxonomy_skills.sql`.

| Column | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `skill_id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique canonical skill identifier |
| `skill_name` | VARCHAR(100) | NOT NULL | Canonical display name |
| `category` | VARCHAR(50) | NOT NULL | Category classification |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Creation timestamp |

*Index*: Unique expression index `idx_skills_lower_name ON skills ((LOWER(skill_name)))`.

### 2.5 `resume_skills` Table (Join Table)
Associates extracted skills with resumes. Managed in Migration `001`.

| Column | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `resume_id` | UUID | NOT NULL, FK → `resumes(resume_id)` ON DELETE CASCADE | Resume reference |
| `skill_id` | UUID | NOT NULL, FK → `skills(skill_id)` ON DELETE RESTRICT | Canonical skill reference |
| `confidence` | DECIMAL(5, 2) | NOT NULL, DEFAULT 1.00, CHECK (`confidence >= 0.00 AND confidence <= 1.00`) | Match confidence score |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Association timestamp |

*Primary Key*: Composite `(resume_id, skill_id)`.

### 2.6 `analyses` Table (Historical Reports)
Stores compatibility reports between resumes and jobs. Managed in Migration `001`.

| Column | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `analysis_id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique analysis identifier |
| `user_id` | UUID | NOT NULL, FK → `users(user_id)` ON DELETE CASCADE | Tenant owner identifier |
| `resume_id` | UUID | Nullable, FK → `resumes(resume_id)` ON DELETE SET NULL | Resume reference (nullable) |
| `job_id` | UUID | Nullable, FK → `job_descriptions(job_id)` ON DELETE SET NULL | Job reference (nullable) |
| `resume_file_name` | VARCHAR(255) | Nullable | Frozen snapshot of resume filename |
| `job_title` | VARCHAR(255) | Nullable | Frozen snapshot of job title |
| `overall_score` | DECIMAL(5, 2) | NOT NULL, CHECK (`overall_score >= 0.00 AND overall_score <= 100.00`) | Composite match score (0–100) |
| `skill_score` | DECIMAL(5, 2) | NOT NULL, CHECK (`skill_score >= 0.00 AND skill_score <= 100.00`) | Skill match score (0–100) |
| `experience_score` | DECIMAL(5, 2) | NOT NULL, DEFAULT 0.00 | Experience match component |
| `project_score` | DECIMAL(5, 2) | NOT NULL, DEFAULT 0.00 | Project match component |
| `education_score` | DECIMAL(5, 2) | NOT NULL, DEFAULT 0.00 | Education match component |
| `quality_score` | DECIMAL(5, 2) | NOT NULL, DEFAULT 0.00 | Stored default; computed on-demand |
| `scoring_version` | VARCHAR(50) | NOT NULL, DEFAULT `'1.0'` | Version of scoring algorithm |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Analysis creation timestamp |

### 2.7 `analysis_skills` Table (Itemized Match Results)
Itemized skill breakdown per analysis. Managed in Migration `001`.

| Column | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `analysis_id` | UUID | NOT NULL, FK → `analyses(analysis_id)` ON DELETE CASCADE | Analysis parent reference |
| `skill_id` | UUID | NOT NULL, FK → `skills(skill_id)` ON DELETE RESTRICT | Canonical skill reference |
| `status` | VARCHAR(20) | NOT NULL, CHECK (`status IN ('MATCHED', 'MISSING', 'PARTIAL')`) | Match result status |
| `evidence` | TEXT | Nullable | Evidence string containing `[REQUIRED]` or `[PREFERRED]` tag |
| `similarity_score` | DECIMAL(5, 2) | Nullable, CHECK (`similarity_score IS NULL OR (similarity_score >= 0.00 AND similarity_score <= 100.00)`) | Similarity rating |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Insertion timestamp |

*Primary Key*: Composite `(analysis_id, skill_id)`.

---

## 3. Relational Integrity & Historical Analysis Preservation

1. **User Account Deletion (`ON DELETE CASCADE`)**:
   Deleting a user removes all their associated resumes, job descriptions, and analysis reports.
2. **Analytical History Preservation (`ON DELETE SET NULL`)**:
   - `analyses.resume_id` and `analyses.job_id` foreign keys specify `ON DELETE SET NULL`.
   - Snapshot metadata columns (`resume_file_name` and `job_title`) preserve source labels.
   - If an underlying resume or job is deleted, historical analysis records remain intact and auditable with `resume_id = NULL` or `job_id = NULL`.
3. **Pipeline Preservation vs. Explicit User Deletion**:
   - Stage 3 analysis records and scores are **not modified or re-scored by the analytical pipeline** after creation.
   - Existing analysis records can still be explicitly deleted through the authorized `DELETE /api/analyses/:analysisId` endpoint, which cascades to `analysis_skills`.
   - Stage 4 recommendations are computed on-demand during `GET /api/analyses/:analysisId/recommendations` without updating `analyses.quality_score` or inserting new database rows, ensuring zero side-effects.
4. **Master Dictionary Protection (`ON DELETE RESTRICT`)**:
   - `skills` catalog records cannot be deleted while referenced by active `resume_skills` or `analysis_skills` rows.

---

## 4. Indexing Strategy

Targeted B-tree and partial indexes are configured to support fast tenant queries and concurrency recovery:

```sql
-- Foreign Key Lookups
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON job_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_resume_id ON analyses(resume_id);
CREATE INDEX IF NOT EXISTS idx_analyses_job_id ON analyses(job_id);
CREATE INDEX IF NOT EXISTS idx_resume_skills_skill_id ON resume_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_analysis_skills_skill_id ON analysis_skills(skill_id);

-- Case-Insensitive Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON users ((LOWER(email)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_lower_name ON skills ((LOWER(skill_name)));

-- Dashboard History Sorting Compound Indexes
CREATE INDEX IF NOT EXISTS idx_analyses_user_history ON analyses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_user_uploaded ON resumes (user_id, uploaded_at DESC);

-- Stale Processing Recovery Partial Index (Migration 005)
CREATE INDEX IF NOT EXISTS idx_resumes_status_stale
    ON resumes (extraction_status, processing_started_at)
    WHERE extraction_status = 'PROCESSING';

-- Active Processing Claim Token Partial Index (Migration 005)
CREATE INDEX IF NOT EXISTS idx_resumes_processing_token
    ON resumes (processing_token)
    WHERE processing_token IS NOT NULL;
```
