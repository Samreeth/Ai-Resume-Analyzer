# System Architecture Specification

**Project Title**: AI-Powered Resume Analyzer and Job Matching Platform  
**Architecture Style**: Monolithic Layered Backend with Local In-Process Deterministic Analytical Engines  
**Runtime**: Node.js v20+ Native ECMAScript Modules (`"type": "module"`)  
**Web Framework**: Express 4.21  
**Database**: PostgreSQL 16 (WSL2 / Linux)  

---

## 1. High-Level Architecture Overview

The system is structured as an API-first layered application comprising an Express application gateway, modular routing controllers, business services, local deterministic analytical engines, and a PostgreSQL relational database.

```text
               ┌────────────────────────────────────────────────────────┐
               │              Client / API Consumer                      │
               │   (React SPA deferred; HTTP/REST testing & client API) │
               └──────────────────────────┬─────────────────────────────┘
                                          │ HTTP / JSON
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │           Express 4.21 Backend Gateway                 │
               │                                                        │
               │  [Edge Security] Helmet, CORS, Body Parsers            │
               │  [Authentication] JWT Verification (requireAuth)       │
               │  [Validation] Zod Schema Validation (validateRequest)  │
               │  [Upload Staging] Multer Memory Staging (5 MB limit)   │
               └──────────────┬──────────────────────────┬──────────────┘
                              │                          │
                              ▼                          ▼
               ┌───────────────────────────┐  ┌─────────────────────────┐
               │    Controllers & Services │  │  Local Analytical       │
               │                           │  │  Engines (In-Process)   │
               │  • Auth Service (bcrypt)  │  │  • unpdf (PDF stream)   │
               │  • Resume Service         │  │  • yauzl (DOCX ZIP)     │
               │  • Processing Service     │  │  • Skill Matcher        │
               │  • Job Service            │  │  • Matching Engine      │
               │  • Analysis Service       │  │  • Quality Diagnostics  │
               │  • Recommendation Service │  │  • Recommendation Synth │
               └──────────────┬────────────┘  └──────────┬──────────────┘
                              │                          │
                              └───────────┬──────────────┘
                                          │ Parameterized SQL
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │                 PostgreSQL 16 Engine                   │
               │                                                        │
               │  users, resumes, job_descriptions, skills,             │
               │  resume_skills, analyses, analysis_skills              │
               └────────────────────────────────────────────────────────┘
```

> **Note on Early Architectural Drafts**: Early design documentation referenced a separate Python/FastAPI microservice in `nlp-service/`. During development, text extraction, taxonomy matching, compatibility scoring, and recommendation synthesis were implemented natively and locally within Node.js. The `nlp-service/` directory remains as an unexecuted template from early project scaffolding.

---

## 2. Component Layers & Responsibilities

### 2.1 Middleware & Security Layer
- **Helmet (`helmet`)**: Hardens HTTP response headers with Content Security Policy, XSS filtering, and MIME sniffing protection.
- **CORS (`cors`)**: Restricts incoming requests to allowed origins and HTTP methods.
- **Authentication Middleware (`server/src/middleware/auth.middleware.mjs`)**: Extracts and verifies HS256 JSON Web Tokens from `Authorization: Bearer <token>` headers, attaching verified claims to `req.user`.
- **Validation Middleware (`server/src/middleware/validate.middleware.mjs`)**: Enforces compile-time and runtime Zod schemas against request body, query parameters, and route parameters.
- **Upload Middleware (`server/src/middleware/upload.middleware.mjs`)**: Buffers incoming file streams in memory using `multer.memoryStorage()`, enforcing a 5 MB limit and magic-byte validation before filesystem interaction.

### 2.2 Controller & Service Layer
- **Auth (`auth.controller.mjs`, `auth.service.mjs`)**: User registration, bcrypt password hashing, credential verification, and JWT issuance.
- **Resume (`resume.controller.mjs`, `resume.service.mjs`, `storage.service.mjs`)**: Staged upload persistence, secure file vault storage outside public roots, metadata retrieval, and deletion cascades.
- **Processing (`processing.controller.mjs`, `processing.service.mjs`)**: Task dispatching, concurrency semaphore coordination, atomic claim tokens, and crash recovery.
- **Job (`job.controller.mjs`, `job.service.mjs`)**: Job posting ingestion, text sanitization, section parsing, and requirement extraction.
- **Analysis (`analysis.controller.mjs`, `analysis.service.mjs`)**: Resume ↔ Job matching, composite score calculation, and atomic relational persistence.
- **Recommendation (`recommendation.controller.mjs`, `recommendation.service.mjs`)**: On-demand quality diagnostics (12 rules) and actionable recommendation generation.

### 2.3 Local Deterministic Analytical Engines
- **Document Text Extractors**:
  - `server/src/services/extractors/pdf.extractor.mjs`: Memory-safe plain text extraction via `unpdf`.
  - `server/src/services/extractors/docx.extractor.mjs`: Stream-based OpenXML ZIP parsing via `yauzl` with 1,000-entry limits, 255-character filename limits, path traversal rejection, 10 MB streaming limits, and XXE rejection.
- **Deterministic Skill Matcher (`server/src/utils/skill.matcher.mjs`)**: Matches text against an 86-skill catalog using token boundary regex, lookahead fencing for short tokens (C, R, Go), and section context scoring.
- **Resume Quality Analyzer (`server/src/utils/quality.analyzer.mjs`)**: Evaluates 12 deterministic rules on a base-100 clamped scale (0.00–100.00).

---

## 3. Resume Processing Lifecycle & Concurrency Control

Resumes transition through four discrete lifecycle states stored in `resumes.extraction_status`:
- `'PENDING'`: Initial status upon upload and storage staging.
- `'PROCESSING'`: Actively claimed by a worker via an atomic UUID claim token (`resumes.processing_token`).
- `'COMPLETED'`: Text extraction and skill matching completed successfully.
- `'FAILED'`: Extraction halted due to corrupt file, parser error, or crash recovery.

```text
[Client Upload]
       │
       ▼
   'PENDING'  ◄──────────────────────────────┐
       │                                     │ Retry if attempts < 3
       ▼ (Atomic Token Claim)                │
  'PROCESSING' ────────► [Parser Error] ─────┴──► 'FAILED'
       │                 [Server Crash] ─────┴──► 'FAILED'
       │                 [Timeout > 5m] ─────┴──► 'FAILED'
       ▼
  'COMPLETED' (Ready for Matching & Analysis)
```

### Concurrency Protection & Fencing
1. **Concurrency Semaphore (`server/src/utils/semaphore.util.mjs`)**: Restricts parallel in-process extraction operations to 2 simultaneous workers.
2. **Token Fencing**: Workers update `processing_token` atomically. If a worker attempt times out or is superseded, finalization verifies token matching before writing results.
3. **Crash & Stale Recovery**:
   - `runStartupRecovery()`: Resets orphaned `PROCESSING` rows to `FAILED` with code `SERVER_RESTARTED` when the server starts.
   - `runStaleRecovery()`: Periodic timer marks tasks in `PROCESSING` for > 5 minutes as `FAILED` with code `STALE_PROCESSING_TIMEOUT`.

---

## 4. Historical Analysis Preservation & Data Integrity

The system maintains analytical history preservation:
- **No Pipeline Mutation**: Analysis records and scores are **not modified or re-scored by the analytical pipeline** after creation.
- **Snapshot Metadata**: When an analysis is created, snapshot columns `resume_file_name` and `job_title` store the source entity titles directly on the `analyses` row.
- **Safe Cascades**: `analyses.resume_id` and `analyses.job_id` foreign keys specify `ON DELETE SET NULL`. If an underlying resume or job is deleted, historical reports remain fully auditable with `resume_id = NULL` or `job_id = NULL`.
- **Explicit User Deletion**: Users retain full control and can explicitly delete analyses they own via `DELETE /api/analyses/:analysisId`, which cascades to `analysis_skills`.
- **Read-Only Recommendations**: Stage 4 recommendation queries compute diagnostics on-demand in memory without executing database writes (`INSERT`, `UPDATE`, `DELETE`).

---

## 5. Architectural Diagrams Reference

For complete visual representations of the system architecture, request flows, extraction state machines, and relational models, see:
- System Architecture Diagrams: `docs/diagrams/system-architecture.md`
- Database Entity-Relationship Diagram: `docs/diagrams/database-er.md`
