# Setup & Runbook Guide: AI-Powered Resume Analyzer

This guide details the step-by-step procedure for configuring, initializing, and running the **AI-Powered Resume Analyzer and Job Matching Platform** in local development and evaluation environments.

---

## 1. System Prerequisites

Before running the application, ensure the host machine meets the following prerequisites:

| Requirement | Supported Version | Notes |
| :--- | :--- | :--- |
| **Node.js** | v20.0.0 or higher | Native ESM (`"type": "module"`) support required |
| **npm** | v9.0.0 or higher | Installed with Node.js |
| **PostgreSQL** | v16.x | Running locally, via Docker, or in WSL2 (Windows) |
| **Operating System** | Windows (WSL2), Linux, or macOS | Tested on Windows 11 with Ubuntu WSL2 |

---

## 2. PostgreSQL Database Setup (WSL / Linux)

On Windows systems, PostgreSQL runs inside WSL Ubuntu.

### 2.1 Starting the PostgreSQL Service
If PostgreSQL is installed inside WSL2:
```bash
wsl -u root -d Ubuntu bash -c "service postgresql start"
```
Or start the daemon directly:
```bash
wsl -u root -d Ubuntu bash -c "mkdir -p /var/run/postgresql && chown -R postgres:postgres /var/run/postgresql && su - postgres -c '/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main -c config_file=/etc/postgresql/16/main/postgresql.conf'"
```

### 2.2 Creating Database and User Credentials
Ensure the database and user match the application configuration:
```bash
wsl -u postgres -d Ubuntu psql -c "CREATE USER postgres WITH SUPERUSER PASSWORD 'postgres';"
wsl -u postgres -d Ubuntu psql -c "CREATE DATABASE ai_resume_analyzer OWNER postgres;"
```

---

## 3. Environment Variable Configuration

Copy the example environment template to create your local `.env` file:
```bash
cp .env.example .env
```

Verify that the `.env` file contains the following active variables:

```ini
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Connection (PostgreSQL)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=ai_resume_analyzer
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

# Authentication Secrets
JWT_SECRET=your_super_secret_jwt_key_change_in_production_min_32_chars
JWT_EXPIRES_IN=7d

# File Storage Configuration
UPLOAD_DIR=uploads/resumes
MAX_FILE_SIZE_BYTES=5242880
```

---

## 4. Database Migrations & Seed Initialization

The database schema and initial skills catalog are managed via migration scripts in `database/migrations/` and seeds in `database/seeds/`.

### 4.1 Run Database Migrations
Execute all 5 ordered migrations (tables, indexes, email uniqueness, metadata, processing fields):
```bash
npm run db:migrate
```

### 4.2 Seed Master Skills Taxonomy
Seed the initial 86 canonical skills into the `skills` master catalog:
```bash
npm run db:seed
```

### 4.3 Verify Database State
Run the built-in database verification script to check table connectivity, triggers, and seed counts:
```bash
node server/src/database/verify.mjs
```
Expected output:
```text
[OK] Database connection established successfully.
[OK] Core relational tables verified (7 tables).
[OK] Master skills catalog verified (86 skills loaded).
[OK] Schema integrity check passed.
```

---

## 5. Starting the Backend Server

Start the development server with live reload:
```bash
npm run dev
```

Or start the server directly using Node:
```bash
npm start
```

The server initializes on port `5000` (or the configured `PORT`):
```text
[INFO] Server running on http://localhost:5000 in development mode
[INFO] Single-instance startup recovery completed.
```

Verify server health in your browser or terminal:
```bash
curl http://localhost:5000/health
```
Response:
```json
{
  "status": "UP",
  "timestamp": "2026-09-29T16:30:00.000Z",
  "uptime": 1.25
}
```

---

## 6. Running the Automated Test Suite

The repository contains 9 automated test suites totaling **325 tests**, executed using the native Node.js test runner.

### 6.1 Run All Tests
```bash
npm test
```

### 6.2 Run Specific Test Suites Individually
You can target individual test files directly:

```bash
# Stage 4: Recommendations & Resume Quality Diagnostics (53 tests)
node --test server/test/recommendation.test.mjs

# Stage 3: Resume ↔ Job Compatibility Matching Engine (47 tests)
node --test server/test/analysis.test.mjs

# Stage 2: Job Description Ingestion & Requirement Extraction (39 tests)
node --test server/test/job.test.mjs

# Stage 1: Deterministic Skill Matcher & Taxonomy (37 tests)
node --test server/test/skill.test.mjs

# Phase 6: Document Text Extraction Engine (26 tests)
node --test server/test/extractor.test.mjs

# Phase 6: Asynchronous Processing & Concurrency Recovery (27 tests)
node --test server/test/processing.test.mjs

# Phase 5: Secure Resume Upload & File Vault (32 tests)
node --test server/test/resume.test.mjs

# Phase 4: User Authentication & JWT (22 tests)
node --test server/test/auth.test.mjs

# Phase 4: Live End-to-End Integration Verification (42 tests)
node --test server/test/live_e2e_verification.mjs
```

### 6.3 Expected Test Output Summary
```text
✔ server/test/recommendation.test.mjs (53 tests)
✔ server/test/analysis.test.mjs (47 tests)
✔ server/test/job.test.mjs (39 tests)
✔ server/test/skill.test.mjs (37 tests)
✔ server/test/extractor.test.mjs (26 tests)
✔ server/test/processing.test.mjs (27 tests)
✔ server/test/resume.test.mjs (32 tests)
✔ server/test/auth.test.mjs (22 tests)
✔ server/test/live_e2e_verification.mjs (42 tests)
ℹ tests 325
ℹ suites 0
ℹ pass 325
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

---

## 7. Troubleshooting & Common Operational Issues

### 7.1 Database Connection Refused (`ECONNREFUSED 127.0.0.1:5432`)
- Ensure PostgreSQL is running inside WSL: `wsl -u root -d Ubuntu service postgresql status`.
- Check if PostgreSQL is listening on port 5432: `netstat -an | grep 5432`.
- Verify credentials in `.env` match the PostgreSQL database user.

### 7.2 Stale Processing Tasks
If the server crashed during document processing, the automatic startup recovery routine (`runStartupRecovery()`) resets orphaned `PROCESSING` rows to `FAILED` with code `SERVER_RESTARTED`. Users can retry processing using `POST /api/resumes/:resumeId/process`.

### 7.3 File Upload Directory Permissions
If upload operations fail with `EACCES`, verify that the `uploads/resumes/` directory exists and has write permissions:
```bash
mkdir -p uploads/resumes
```
