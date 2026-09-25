# Database Architecture & Management

This directory manages the relational database schema, versioned migrations, seed catalogs, and Docker initialization for the **AI-Powered Resume Analyzer and Job Matching System**.

---

## 1. Directory Structure

```text
database/
├── migrations/                           # Authoritative single source of truth for schema evolution
│   ├── 001_create_tables.sql             # Tables, constraints, similarity bounds, and updated_at triggers
│   ├── 002_create_indexes.sql            # Performance indexes and unique expression index for skills
│   ├── 003_case_insensitive_user_email.sql # Case-insensitive email uniqueness with pre-check
│   └── 004_add_resume_metadata.sql       # Resume file metadata, constraints, and composite user/uploaded_at index
├── seeds/                                # Idempotent reference datasets
│   └── 001_initial_skills.sql            # Curated baseline skills with ON CONFLICT ((LOWER(skill_name)))
├── docker-init.sql                       # Lightweight extension initializer for Docker containers
├── schema.sql                            # Consolidated cumulative reference snapshot (documentation only)
└── README.md
```

---

## 2. Docker Initialization vs. Migration Runner Compatibility

To prevent conflicts and duplicate schema execution:
* **Docker Compose (`database/docker-init.sql`):** Initializes only necessary PostgreSQL extensions (`pgcrypto`). It does **not** create application tables.
* **Migration Runner (`server/src/database/migrate.mjs`):** The authoritative engine responsible for creating tables, triggers, constraints, indexes, and recording history in `schema_migrations`.
* **Snapshot File (`database/schema.sql`):** Retained purely as a cumulative reference snapshot for documentation. It is not run automatically.

---

## 3. Automatic `updated_at` Trigger Management

Tables with mutable state (`users`, `resumes`, `job_descriptions`) automatically update their `updated_at` timestamp via a reusable PL/pgSQL function:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
Any `UPDATE` query will automatically advance `updated_at` without manual timestamp passing in application code.

---

## 4. Case-Insensitive Uniqueness & Seed Syntax

- **Skills Table**: Enforces case-insensitive uniqueness on `LOWER(skill_name)`:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_lower_name ON skills ((LOWER(skill_name)));
  ```
  Seed queries target this index:
  ```sql
  INSERT INTO skills (skill_name, category) VALUES (...)
  ON CONFLICT ((LOWER(skill_name))) DO NOTHING;
  ```
- **Users Table**: Enforces case-insensitive uniqueness on `LOWER(email)`:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON users ((LOWER(email)));
  ```
- **Resumes Table (Migration 004)**: Enforces physical file metadata bounds and composite index:
  ```sql
  ALTER TABLE resumes
      ADD COLUMN IF NOT EXISTS file_size INTEGER,
      ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS file_hash CHAR(64);

  ALTER TABLE resumes
      ADD CONSTRAINT chk_resumes_file_size CHECK (file_size > 0 AND file_size <= 5242880),
      ADD CONSTRAINT chk_resumes_mime_type CHECK (mime_type IN ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));

  CREATE INDEX IF NOT EXISTS idx_resumes_user_uploaded ON resumes (user_id, uploaded_at DESC);
  ```

---

## 5. Local PostgreSQL Development Setup (WSL / Native)

When running the database locally via WSL Ubuntu:

### Starting PostgreSQL:
```bash
# In WSL terminal or via PowerShell:
wsl -u postgres -d Ubuntu /usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main -c config_file=/etc/postgresql/16/main/postgresql.conf
```
*(Or if using systemd/init: `wsl -u root -d Ubuntu service postgresql start 16`)*

### Checking Status:
```bash
# From Windows / PowerShell in server directory:
node -e "import('./src/config/database.mjs').then(m => m.testDbConnection()).then(r => console.log(r))"
# Or from WSL:
wsl -u root -d Ubuntu service postgresql status
```

### Stopping PostgreSQL Safely:
```bash
# In WSL:
pkill -u postgres postgres
# Or:
wsl -u root -d Ubuntu service postgresql stop 16
```

### Verifying Connection & Schema:
```bash
cd server
npm run db:verify
```

---

## 6. CLI Commands (via Backend)

From the `server/` directory:

```bash
# 1. Apply pending migrations
npm run db:migrate

# 2. Populate standard skills dictionary
npm run db:seed

# 3. Run automated 14-point schema, trigger, and migration verification test suite
npm run db:verify

# 4. Run authentication test suite
npm run test:auth

# 5. Run end-to-end integration test suite
npm run test:e2e

# 6. Run resume upload, validation, and storage test suite
npm run test:resume
```

### Safety Features
1. **Checksum Protection:** Modifying an already-applied migration file triggers an immediate halt with exit code 1.
2. **Missing File Detection:** Removing an applied migration file from disk triggers an immediate halt with exit code 1.
3. **Reordering Guard:** Migrations must be strictly append-only; unapplied migrations cannot precede applied migrations.
4. **Atomic Transactions:** Each migration runs inside `BEGIN ... COMMIT` with automatic `ROLLBACK` on error.
