# Database Design Specification

## 1. Relational Architecture Overview

The PostgreSQL database schema is designed for data integrity, privacy compliance, analysis history preservation, and high-performance skill matching.

```text
  ┌────────────────────────┐         1..N        ┌────────────────────────┐
  │         users          ├────────────────────►│        resumes         │
  │ PK: user_id (UUID)     │                     │ PK: resume_id (UUID)   │
  │ email (UNIQUE)         │                     │ FK: user_id (CASCADE)  │
  │ password_hash (TEXT)   │                     │ extracted_data (JSONB) │
  └───────────┬────────────┘                     └───────────┬────────────┘
              │ 1..N                                         │ 1..N
              │                                              ▼
              ▼                                  ┌────────────────────────┐
  ┌────────────────────────┐                     │     resume_skills      │
  │    job_descriptions    │                     │ PK: (resume_id,skill_id│
  │ PK: job_id (UUID)      │                     │ confidence (0.00-1.00) │
  │ FK: user_id (CASCADE)  │                     └───────────┬────────────┘
  │ extracted_data (JSONB) │                                 │ N..1
  └───────────┬────────────┘                                 ▼
              │ 1..N                             ┌────────────────────────┐
              ▼                                  │         skills         │
  ┌────────────────────────┐                     │ PK: skill_id (UUID)    │
  │        analyses        │                     │ UNIQUE ((LOWER(name))) │
  │ PK: analysis_id (UUID) │                     │ category (VARCHAR)     │
  │ FK: user_id (CASCADE)  │                     └───────────▲────────────┘
  │ FK: resume_id(SET NULL)│                                 │ N..1
  │ FK: job_id  (SET NULL) │                                 │
  │ scores: 0-100 (DECIMAL)│                                 │
  └───────────┬────────────┘                                 │
              │ 1..N                                         │
              ▼                                              │
  ┌────────────────────────┐                                 │
  │    analysis_skills     ├─────────────────────────────────┘
  │ PK:(analysis_id,skill) │
  │ status: MATCHED/etc.   │
  │ similarity (NULL/0-100)│
  └────────────────────────┘
```

---

## 2. Table Specifications & Constraints

### 2.1 `users`
* `user_id` (UUID, PK): `DEFAULT gen_random_uuid()`
* `name` (VARCHAR(255), NOT NULL)
* `email` (VARCHAR(255), UNIQUE, NOT NULL)
* `password_hash` (TEXT, NOT NULL): bcrypt salted hash. Never plain text.
* `created_at` (TIMESTAMPTZ, NOT NULL, `DEFAULT CURRENT_TIMESTAMP`)
* `updated_at` (TIMESTAMPTZ, NOT NULL, `DEFAULT CURRENT_TIMESTAMP`): Maintained by `trg_users_updated_at`.

### 2.2 `resumes`
* `resume_id` (UUID, PK): `DEFAULT gen_random_uuid()`
* `user_id` (UUID, FK -> `users(user_id)` ON DELETE CASCADE)
* `file_name` (VARCHAR(255), NOT NULL)
* `file_path` (TEXT, NOT NULL)
* `uploaded_at` (TIMESTAMPTZ, NOT NULL, `DEFAULT CURRENT_TIMESTAMP`)
* `updated_at` (TIMESTAMPTZ, NOT NULL, `DEFAULT CURRENT_TIMESTAMP`): Maintained by `trg_resumes_updated_at`.
* `extracted_data` (JSONB)
* `extraction_status` (VARCHAR(50), NOT NULL, `DEFAULT 'PENDING'`):
  * `CHECK (extraction_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'))`

### 2.3 `job_descriptions`
* `job_id` (UUID, PK): `DEFAULT gen_random_uuid()`
* `user_id` (UUID, FK -> `users(user_id)` ON DELETE CASCADE)
* `title` (VARCHAR(255), NOT NULL)
* `description` (TEXT, NOT NULL)
* `extracted_data` (JSONB)
* `created_at` (TIMESTAMPTZ, NOT NULL, `DEFAULT CURRENT_TIMESTAMP`)
* `updated_at` (TIMESTAMPTZ, NOT NULL, `DEFAULT CURRENT_TIMESTAMP`): Maintained by `trg_job_descriptions_updated_at`.

### 2.4 `skills`
* `skill_id` (UUID, PK): `DEFAULT gen_random_uuid()`
* `skill_name` (VARCHAR(100), NOT NULL)
* `category` (VARCHAR(50), NOT NULL)
* `created_at` (TIMESTAMPTZ, NOT NULL, `DEFAULT CURRENT_TIMESTAMP`)
* Unique constraint: `CREATE UNIQUE INDEX idx_skills_lower_name ON skills ((LOWER(skill_name)));`

### 2.5 `resume_skills`
* `resume_id` (UUID, FK -> `resumes(resume_id)` ON DELETE CASCADE)
* `skill_id` (UUID, FK -> `skills(skill_id)` ON DELETE RESTRICT)
* `confidence` (DECIMAL(5, 2), NOT NULL, `DEFAULT 1.00`):
  * `CHECK (confidence >= 0.00 AND confidence <= 1.00)`
* `created_at` (TIMESTAMPTZ, NOT NULL, `DEFAULT CURRENT_TIMESTAMP`)
* `PRIMARY KEY (resume_id, skill_id)`

### 2.6 `analyses`
* `analysis_id` (UUID, PK): `DEFAULT gen_random_uuid()`
* `user_id` (UUID, FK -> `users(user_id)` ON DELETE CASCADE)
* `resume_id` (UUID, FK -> `resumes(resume_id)` ON DELETE SET NULL): **Preserves history when resume is deleted.**
* `job_id` (UUID, FK -> `job_descriptions(job_id)` ON DELETE SET NULL): **Preserves history when job is deleted.**
* `resume_file_name` (VARCHAR(255)): Snapshot of resume filename.
* `job_title` (VARCHAR(255)): Snapshot of job title.
* Scores (0–100 scale):
  * `overall_score DECIMAL(5, 2) NOT NULL CHECK (overall_score >= 0.00 AND overall_score <= 100.00)`
  * `skill_score DECIMAL(5, 2) NOT NULL CHECK (skill_score >= 0.00 AND skill_score <= 100.00)`
  * `experience_score DECIMAL(5, 2) NOT NULL CHECK (experience_score >= 0.00 AND experience_score <= 100.00)`
  * `project_score DECIMAL(5, 2) NOT NULL CHECK (project_score >= 0.00 AND project_score <= 100.00)`
  * `education_score DECIMAL(5, 2) NOT NULL CHECK (education_score >= 0.00 AND education_score <= 100.00)`
  * `quality_score DECIMAL(5, 2) NOT NULL CHECK (quality_score >= 0.00 AND quality_score <= 100.00)`
* `scoring_version` (VARCHAR(50), NOT NULL, `DEFAULT '1.0'`)
* `created_at` (TIMESTAMPTZ, NOT NULL, `DEFAULT CURRENT_TIMESTAMP`)

### 2.7 `analysis_skills`
* `analysis_id` (UUID, FK -> `analyses(analysis_id)` ON DELETE CASCADE)
* `skill_id` (UUID, FK -> `skills(skill_id)` ON DELETE RESTRICT)
* `status` (VARCHAR(20), NOT NULL CHECK (status IN ('MATCHED', 'MISSING', 'PARTIAL')))
* `evidence` (TEXT)
* `similarity_score` (DECIMAL(5, 2)):
  * `CHECK (similarity_score IS NULL OR (similarity_score >= 0.00 AND similarity_score <= 100.00))`
* `created_at` (TIMESTAMPTZ, NOT NULL, `DEFAULT CURRENT_TIMESTAMP`)
* `PRIMARY KEY (analysis_id, skill_id)`

---

## 3. Foreign Key Deletion Behavior Rationale

1. **User Deletion:** Deleting an account purges user resumes, job descriptions, and analyses via `ON DELETE CASCADE` in compliance with privacy regulations.
2. **Resume & Job Deletion:** Deleting a resume file or an old job posting sets `resume_id` and `job_id` to `NULL` in `analyses` (`ON DELETE SET NULL`), preserving the user's historical scores and audit trail.
3. **Master Skills Protection:** Skills in the catalog cannot be deleted while referenced by active resumes or analyses (`ON DELETE RESTRICT`).

---

## 4. Automatic `updated_at` Trigger Architecture

A single PL/pgSQL function manages row timestamp updates automatically:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
Triggers attached:
* `trg_users_updated_at` on `users` (`BEFORE UPDATE`)
* `trg_resumes_updated_at` on `resumes` (`BEFORE UPDATE`)
* `trg_job_descriptions_updated_at` on `job_descriptions` (`BEFORE UPDATE`)
