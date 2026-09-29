# AI-Powered Resume Analyzer and Job Matching Platform

[![Test Status](https://img.shields.io/badge/tests-325%20passed%20%7C%200%20failed-brightgreen)](#automated-testing--verification)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-blue)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/postgresql-16-blue)](https://www.postgresql.org/)
[![Architecture](https://img.shields.io/badge/architecture-Node.js%20ESM-orange)](#system-architecture)

A full-stack, enterprise-grade resume screening and job compatibility matching platform. The system performs secure document ingestion (PDF and DOCX), in-process text extraction, deterministic skill taxonomy extraction, multi-tier job requirement matching, resume quality diagnostics, and actionable recommendation synthesis.

---

## 1. Project Overview & Key Capabilities

- **Secure Document Ingestion**: Supports PDF and DOCX uploads with memory-buffered staging, 5 MB file size ceilings, magic-byte inspection, UUID filename jailing, and ZIP bomb protection.
- **In-Process Document Extraction**: Native PDF parsing via `unpdf` and OpenXML DOCX streaming via `yauzl` with XXE defenses and 10 MB streaming limits.
- **Deterministic Skill Taxonomy**: Curated 86-skill catalog across programming languages, frameworks, cloud, and databases with regex word boundaries and short-token lookahead fencing (e.g., isolating C, R, and Go).
- **Automated Job Requirement Extraction**: Ingests job descriptions, normalizes text, and classifies qualifications into Required vs. Preferred skill tiers.
- **Explainable Compatibility Scoring**: Evaluates candidate resumes against job requirements using a transparent composite formula:
  $$\text{Score} = (0.70 \times S_{\text{req}} + 0.20 \times S_{\text{pref}} + 0.10 \times S_{\text{conf}}) \times 100$$
- **Deterministic Quality Diagnostics**: Evaluates 12 transparent deduction rules (contact info, section completeness, word count bounds, bullet density, action verbs, quantifiable metrics) on a base-100 clamped scale.
- **Prioritized Recommendations**: Synthesizes prioritized improvement suggestions (`HIGH`, `MEDIUM`, `LOW`) across skill gaps, resume quality, impact metrics, and formatting.
- **Analytical History Preservation**: Stage 3 analysis records and scores are preserved against entity deletions using `ON DELETE SET NULL` and snapshot metadata, while still supporting explicit user deletion via `DELETE /api/analyses/:analysisId`.
- **Zero Third-Party AI Dependency**: Text extraction, taxonomy matching, and scoring operate locally within Node.js, reducing third-party data exposure and eliminating external AI subscription costs.

---

## 2. Technology Stack

- **Runtime**: Node.js v20+ with native ECMAScript Modules (`"type": "module"`).
- **Web Framework**: Express 4.21.
- **Database**: PostgreSQL 16 (running locally or in WSL2).
- **Validation**: Zod schema validation on all inputs.
- **Authentication**: Stateless JSON Web Tokens (HS256) and bcrypt password hashing (10 rounds).
- **Document Extractors**: `unpdf` (PDF streams), `yauzl` (DOCX ZIP streams), `fast-xml-parser`.
- **Testing**: Native Node.js test runner (`node:test` and `node:assert/strict`).

> **Architectural Note**: Early project drafts referenced a separate Python/FastAPI microservice in `nlp-service/`. During development, text extraction and matching were implemented natively and locally in Node.js. The `nlp-service/` directory is an unused template from initial scaffolding. The React frontend in `client/` is intentionally deferred; all capabilities are verified through the 23 REST API endpoints.

---

## 3. Implemented REST API Endpoints (23 Total)

All endpoints return standardized JSON envelopes (`{ "success": true, "data": {}, "message": "..." }`) and enforce tenant isolation:

| Domain | Method | Endpoint | Auth | Purpose |
| :--- | :---: | :--- | :---: | :--- |
| **System** | `GET` | `/health` | No | Health check & uptime status |
| | `GET` | `/api` | No | API version & metadata |
| **Auth** | `POST` | `/api/auth/register` | No | Register new user account |
| | `POST` | `/api/auth/login` | No | Authenticate user & issue JWT |
| | `GET` | `/api/auth/me` | Yes | Get authenticated profile |
| | `POST` | `/api/auth/logout` | Yes | Client-side session acknowledgment |
| **Resumes** | `POST` | `/api/resumes` | Yes | Upload & stage resume (sets status `PENDING`) |
| | `GET` | `/api/resumes` | Yes | List paginated user resumes |
| | `GET` | `/api/resumes/:resumeId` | Yes | Get resume metadata & extracted text |
| | `POST` | `/api/resumes/:resumeId/process` | Yes | Trigger in-process text & skill extraction |
| | `GET` | `/api/resumes/:resumeId/status` | Yes | Poll resume processing status |
| | `DELETE` | `/api/resumes/:resumeId` | Yes | Delete resume & file vault asset |
| **Jobs** | `POST` | `/api/jobs` | Yes | Create job posting & extract requirements |
| | `GET` | `/api/jobs` | Yes | List paginated user job postings |
| | `GET` | `/api/jobs/:jobId` | Yes | Get job posting details |
| | `PUT` | `/api/jobs/:jobId` | Yes | Update job posting & re-extract skills |
| | `DELETE` | `/api/jobs/:jobId` | Yes | Delete job posting |
| | `POST` | `/api/jobs/:jobId/extract` | Yes | Re-run skill extraction on job |
| **Analyses** | `POST` | `/api/analyses` | Yes | Run matching & atomically persist analysis |
| | `GET` | `/api/analyses` | Yes | List user historical analyses |
| | `GET` | `/api/analyses/:analysisId` | Yes | Get detailed analysis report |
| | `GET` | `/api/analyses/:analysisId/recommendations` | Yes | On-demand quality diagnostics & recommendations |
| | `DELETE` | `/api/analyses/:analysisId` | Yes | Explicitly delete analysis record |

---

## 4. Database Architecture & Schema

The PostgreSQL schema comprises 7 tables managed across Migrations `001` through `005` in `database/migrations/`:

- `users`: User identity, case-insensitive email index, bcrypt password hashes.
- `resumes`: Staged file assets, extraction status (`'PENDING'`, `'PROCESSING'`, `'COMPLETED'`, `'FAILED'`), extracted text, claim tokens, and retry audit fields.
- `job_descriptions`: Job postings and structured requirements (`requiredSkills` and `preferredSkills` in JSONB).
- `skills`: Master taxonomy catalog of 86 canonical skills with case-insensitive unique indexes.
- `resume_skills`: Composite join table linking extracted skills to resumes with match confidence.
- `analyses`: Historical match scores, versioning, and frozen snapshot metadata (`resume_file_name`, `job_title`). Foreign keys use `ON DELETE SET NULL`.
- `analysis_skills`: Composite join table storing itemized match results with requirement tags (`[REQUIRED]`, `[PREFERRED]`).

For complete schema details and the ER diagram, see [docs/diagrams/database-er.md](docs/diagrams/database-er.md).

---

## 5. Quick Start Guide

### Prerequisites
- Node.js v20.0.0 or higher
- PostgreSQL 16 (running locally or in WSL2)

### Installation & Initialization
```bash
# 1. Clone repository & install dependencies
git clone https://github.com/samreeth/ai-resume-analyzer.git
cd ai-resume-analyzer
npm install

# 2. Configure environment variables
cp .env.example .env

# 3. Ensure PostgreSQL is running (WSL example)
wsl -u root -d Ubuntu service postgresql start

# 4. Run database migrations & seed skills taxonomy
npm run db:migrate
npm run db:seed

# 5. Start the backend server
npm run dev
```

The server initializes at `http://localhost:5000`. Verify with `curl http://localhost:5000/health`.

---

## 6. Automated Testing & Verification

The test suite runs with the Node.js native test runner against live database transactions:

```bash
npm test
```

### Exact Test Suite Breakdown (325 Tests Total)
- `server/test/recommendation.test.mjs` (53 tests) — Stage 4 Recommendations & Quality Diagnostics
- `server/test/analysis.test.mjs` (47 tests) — Stage 3 Matching & Composite Scoring
- `server/test/job.test.mjs` (39 tests) — Stage 2 Job Description Management
- `server/test/skill.test.mjs` (37 tests) — Stage 1 Deterministic Skill Matcher
- `server/test/extractor.test.mjs` (26 tests) — Phase 6 Document Text Extraction
- `server/test/processing.test.mjs` (27 tests) — Phase 6 Asynchronous Processing & Concurrency
- `server/test/resume.test.mjs` (32 tests) — Phase 5 Resume Upload & Vault Storage
- `server/test/auth.test.mjs` (22 tests) — Phase 4 Authentication & Security
- `server/test/live_e2e_verification.mjs` (42 tests) — Phase 4 End-to-End Integration Verification

---

## 7. Documentation Index

Detailed engineering documentation is organized in the `docs/` directory:

| Document | Description |
| :--- | :--- |
| [docs/final-technical-report.md](docs/final-technical-report.md) | Comprehensive capstone technical report |
| [docs/architecture.md](docs/architecture.md) | System architecture & component responsibilities |
| [docs/api-documentation.md](docs/api-documentation.md) | Authoritative contract specification for all 23 REST endpoints |
| [docs/database-design.md](docs/database-design.md) | Relational schema, integrity rules, and indexing strategy |
| [docs/testing-report.md](docs/testing-report.md) | Test methodology, coverage dimensions, and execution plan |
| [docs/setup-and-run-guide.md](docs/setup-and-run-guide.md) | Local environment onboarding & operational runbook |
| [docs/demo-walkthrough.md](docs/demo-walkthrough.md) | End-to-end cURL walkthrough script & scenarios |
| [docs/presentation-structure.md](docs/presentation-structure.md) | 16-slide academic presentation structure & speaker notes |
| [docs/viva-preparation.md](docs/viva-preparation.md) | 20 technical viva defense questions and answers |
| [docs/diagrams/system-architecture.md](docs/diagrams/system-architecture.md) | 9 Mermaid system architecture, pipeline & state-flow diagrams |
| [docs/diagrams/database-er.md](docs/diagrams/database-er.md) | Database Entity-Relationship diagram & constraint reference |

---

## 8. Quality & Regression Assurance

**Low Runtime Regression Risk**: Stage 5 does not modify runtime code, database schema, migrations, seeds, dependencies, or tests. Running the full test suite after documentation generation verifies that all 325 tests remain green.
