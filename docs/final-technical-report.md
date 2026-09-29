# Final Technical Report: AI-Powered Resume Analyzer & Job Matching Platform

**Project Title**: AI-Powered Resume Analyzer and Job Matching Platform  
**System Type**: Full-Stack Web Application Backend & Analytical Engine  
**Implementation Standard**: Native ECMAScript Modules (Node.js ESM), Express 4.21, PostgreSQL 16, Zod, JWT, bcrypt  
**Current Verification Baseline**: 325/325 Automated Tests Passing across 9 Suites  
**Architectural Approach**: Local In-Process Deterministic Document Extraction & Matching  

---

## 1. Executive Summary & Problem Formulation

### 1.1 Executive Summary
The **AI-Powered Resume Analyzer and Job Matching Platform** is an enterprise-grade backend system designed to evaluate candidate resumes against target job postings. The system performs secure document ingestion, in-process plain text extraction for PDF and DOCX formats, deterministic skill taxonomy extraction, multi-tier job requirement matching, resume quality diagnostics, and actionable recommendation synthesis.

Unlike black-box Applicant Tracking Systems (ATS) or systems dependent on non-deterministic generative LLMs, this architecture implements **deterministic, auditable, and reproducible scoring algorithms**. By running text extraction, taxonomy matching, and scoring locally within the Node.js runtime, the system avoids an additional external processing service for document extraction and reduces third-party data exposure.

### 1.2 Problem Formulation
Job seekers face significant challenges when tailoring resumes to complex job descriptions:
- **Keyword Opacity**: Traditional screening systems reject qualified candidates due to minor phrasing discrepancies or alias mismatches.
- **Scoring Inconsistency**: Non-deterministic generative AI models return fluctuating match scores for identical inputs across invocations.
- **Privacy and Compliance Risks**: Uploading resumes containing Personally Identifiable Information (PII) to third-party cloud AI APIs creates data exposure concerns.
- **Lack of Actionable Guidance**: Most screening systems provide pass/fail decisions without itemized skill gap breakdowns or structured quality feedback.

The platform addresses these issues through a deterministic analytical pipeline with clear mathematical scoring models, auditable evidence logging, and reproducible recommendations.

---

## 2. System Objectives & Design Philosophy

### 2.1 Core System Objectives
1. **Secure Document Ingestion**: Support PDF and DOCX uploads with multi-layer boundary defense (magic bytes, memory staging, UUID file jailing, and ZIP bomb protection).
2. **In-Process Text Extraction**: Extract plain text from PDF streams and OpenXML DOCX archives within the Node.js runtime without external microservices or binary wrappers.
3. **Deterministic Skill Taxonomy Matching**: Maintain an 86-skill canonical catalog with alias normalization, regex word boundaries, and short-token lookahead fencing.
4. **Structured Job Ingestion**: Sanitize job postings and split requirements into Required vs. Preferred skill tiers.
5. **Multi-Tier Compatibility Matching**: Calculate an explainable composite compatibility score based on required skills (70%), preferred skills (20%), and keyword confidence (10%).
6. **Deterministic Quality Diagnostics**: Evaluate resume structural quality against 12 deterministic deduction rules on a base-100 clamped scale.
7. **Actionable Recommendations**: Synthesize prioritized suggestions (HIGH, MEDIUM, LOW) across skill gaps, resume quality, impact metrics, and formatting.
8. **Tenant Isolation & Security**: Enforce IDOR protection, JWT authentication, bcrypt password hashing, and anti-enumeration defenses across all 23 endpoints.

### 2.2 Design Philosophy
- **Determinism over Stochasticity**: Scoring and extraction logic produce identical outputs for identical inputs, ensuring auditability.
- **Analytical History Preservation with Explicit User Control**: Historical analysis records are not modified or re-scored by the pipeline once created. Underlying entity deletions use `ON DELETE SET NULL` to preserve historical snapshots, while users retain the ability to explicitly delete analyses they own.
- **Zero Third-Party AI Dependency**: Operates entirely locally without external OpenAI, Gemini, or Anthropic API dependencies.

---

## 3. Technology Stack & Runtime Architecture

### 3.1 Technology Stack
- **Runtime Environment**: Node.js v20+ with native ECMAScript Modules (`"type": "module"`).
- **Web Framework**: Express 4.21.
- **Relational Database**: PostgreSQL 16 (WSL Ubuntu environment) accessed via `pg` connection pool.
- **Document Extractors**:
  - `unpdf`: Serverless, memory-safe PDF text stream extraction.
  - `yauzl`: Streaming, memory-safe ZIP archive extraction for DOCX packages.
  - `fast-xml-parser`: Safe XML parsing with entity expansion disabled (`processEntities: false`).
- **Security & Authentication**:
  - `jsonwebtoken`: Cryptographic HS256 tokens for stateless user authentication.
  - `bcrypt`: Password hashing with 10 salt rounds.
  - `helmet`: HTTP header protection (CSP, XSS, MIME sniffing protection).
  - `cors`: Strict origin whitelisting.
  - `multer`: In-memory multipart upload streaming with 5MB limits.
- **Schema Validation**: `zod` for compile-time and runtime payload validation.
- **Test Framework**: Native Node.js test runner (`node:test` and `node:assert/strict`).

### 3.2 Runtime Component Topology
The application follows a layered architectural pattern:
1. **Edge Middleware Layer**: Helmet, CORS, Body Parsers, and Multer Memory Staging.
2. **Security & Validation Layer**: JWT Authentication (`requireAuth`) and Zod Schema Validation (`validateRequest`).
3. **Controller Layer**: Request orchestration, parameter extraction, and standardized HTTP response formatting.
4. **Service Layer**: Business transactions, concurrency semaphore management, and database coordination.
5. **Local Analytical Engines**: In-process extractors, deterministic skill matcher, composite scoring calculator, and quality analyzer.
6. **Persistence Layer**: PostgreSQL connection pool with parameterized queries and transactional consistency.

---

## 4. Secure Resume Ingestion & Storage Subsystem

Implemented in `server/src/services/resume.service.mjs`, `server/src/services/storage.service.mjs`, and `server/src/middleware/upload.middleware.mjs`.

### 4.1 Multi-Tier Upload Validation Pipeline
1. **Memory Buffering**: Multer stores incoming uploads exclusively in memory (`multer.memoryStorage()`). Corrupted or oversized files are rejected before touching disk.
2. **File Size Boundaries**: Enforces a strict 5 MB (5,242,880 bytes) ceiling via Multer and Zod.
3. **MIME & Extension Whitelisting**: Restricts uploads strictly to `.pdf` (`application/pdf`) and `.docx` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
4. **Magic-Byte Inspection**: Inspects the binary buffer header:
   - PDF files must begin with `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`).
   - DOCX files must begin with the standard PK ZIP header `PK\x03\x04` (`0x50 0x4B 0x03 0x04`).
5. **File Vault Jailing**: Files are stored in a designated storage directory (`uploads/resumes/`) completely outside public web roots. Files are renamed to random UUIDv4 names to prevent directory traversal or filename collision attacks.
6. **Atomic Staged Writes & Rollback**: Uploads are written to `.tmp_<uuid>.tmp` before being atomically renamed to `<uuid>.<ext>`. If database insertion fails, the temporary file is unlinked immediately.
7. **Initial State**: Uploaded records are staged with `extraction_status = 'PENDING'` and `processing_attempts = 0`.

---

## 5. In-Process Text Extraction Subsystem

Implemented in `server/src/services/extractors/pdf.extractor.mjs`, `server/src/services/extractors/docx.extractor.mjs`, and `server/src/services/processing.service.mjs`.

### 5.1 PDF Extraction (`unpdf`)
- Uses `unpdf` to extract plain text streams directly from binary buffers in memory.
- Normalizes unicode characters, replaces non-printable control characters, and collapses repetitive whitespace while preserving paragraph breaks.

### 5.2 DOCX Extraction & ZIP Security Controls (`yauzl`)
DOCX files are OpenXML ZIP packages. Extraction enforces layered defensive controls:
1. **Archive Entry-Count Limit**: Rejects archives containing more than 1,000 entries.
2. **Filename Length Restriction**: Rejects entry names exceeding 255 characters.
3. **Path Traversal Defense**: Rejects entries containing `..`, leading slashes (`/`), or backslashes (`\`).
4. **Required DOCX Structure**: Verifies mandatory presence of root `[Content_Types].xml` and exact `word/document.xml` (rejecting alternative part names like `word/document2.xml`).
5. **Streaming Byte Counters**: Limits uncompressed `word/document.xml` streams to 10 MB (`EXTRACTION_LIMITS.MAX_XML_STREAM_BYTES`).
6. **Total Archive Read Limit**: Limits total uncompressed archive bytes to 10 MB (`EXTRACTION_LIMITS.MAX_ARCHIVE_TOTAL_BYTES`).
7. **XXE Protection**: Rejects XML payloads containing `<!DOCTYPE` or `<!ENTITY` declarations (`UNSAFE_XML_DECLARATION`).
8. **Entity Resolution Disabled**: Configures `fast-xml-parser` with `processEntities: false`.
9. **Immediate Resource Teardown**: Destroys active read streams and closes ZIP archives immediately on error or limit violation.
10. **In-Memory Processing**: Extraction runs entirely in memory without writing temporary uncompressed files to disk.

### 5.3 Concurrency & Lifecycle Management
- **Concurrency Semaphore**: Limits concurrent extraction operations to 2 simultaneous workers (`server/src/utils/semaphore.util.mjs`) to prevent event-loop starvation.
- **Atomic Claim Tokens**: Workers acquire processing rights by writing a UUID token to `resumes.processing_token` in an atomic UPDATE query:
  ```sql
  UPDATE resumes
  SET extraction_status = 'PROCESSING',
      processing_token = $1,
      processing_started_at = CURRENT_TIMESTAMP,
      processing_attempts = processing_attempts + 1
  WHERE resume_id = $2
    AND extraction_status IN ('PENDING', 'FAILED')
    AND processing_attempts < 3
  RETURNING resume_id;
  ```
- **Crash & Stale Recovery**:
  - `runStartupRecovery()`: On application boot, resets orphaned `PROCESSING` rows to `FAILED` with error code `SERVER_RESTARTED`.
  - `runStaleRecovery()`: Periodic timer resets tasks stuck in `PROCESSING` for > 5 minutes to `FAILED` with code `STALE_PROCESSING_TIMEOUT`.
  - Users can retry failed extractions up to 3 total attempts.

---

## 6. Deterministic Skill Extraction & Taxonomy Engine

Implemented in `server/src/utils/skill.matcher.mjs` and `server/src/utils/skills.taxonomy.mjs`.

### 6.1 Canonical Taxonomy Catalog
The master taxonomy contains 86 canonical technical skills seeded in PostgreSQL (`database/seeds/001_initial_skills.sql` and `002_taxonomy_skills.sql`) and mirrored in `skills.taxonomy.mjs`. Categories include:
- Programming Languages (JavaScript, TypeScript, Python, Java, C, C++, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, R)
- Frontend Frameworks (React, Vue.js, Angular, Svelte, Next.js, HTML5, CSS3, Tailwind CSS)
- Backend Frameworks (Node.js, Express, NestJS, Django, FastAPI, Flask, Spring Boot, Ruby on Rails)
- Databases (PostgreSQL, MySQL, MongoDB, Redis, SQLite, Cassandra, Elasticsearch)
- Cloud & Infrastructure (AWS, Azure, Google Cloud, Docker, Kubernetes, Terraform, Linux)
- Machine Learning & Data Science (TensorFlow, PyTorch, Scikit-Learn, Pandas, NumPy)
- Testing & Tooling (Git, CI/CD, Jest, Cypress, GraphQL, REST APIs)

### 6.2 Token Boundary Isolation & Disambiguation
Matching single-letter and short language identifiers (such as `C`, `R`, and `Go`) without false positives requires strict regular expression fencing:
- **Single-Letter C Guard**: Uses `(?<![a-zA-Z0-9])C(?![a-zA-Z0-9+#])` combined with contextual language checks to match the C language while ignoring occurrences in words or symbols like `C++` and `C#`.
- **Go Guard**: Uses `(?<![a-zA-Z0-9])(Go|Golang)(?![a-zA-Z0-9])` to distinguish the language from the common English verb "go".
- **Standard Skills**: Multi-character skills use word-boundary regex matching (`\bskill\b`) across canonical names and known aliases (e.g., `Postgres` → `PostgreSQL`, `k8s` → `Kubernetes`).
- **Context Scoring**: Matches in explicit "Skills" sections receive a 1.10x confidence multiplier compared to body text mentions.

---

## 7. Job Description Ingestion & Extraction Engine

Implemented in `server/src/services/job.service.mjs` and `server/src/validators/job.validator.mjs`.

### 7.1 Requirement Ingestion & Sanitization
- Validates job title (2–255 characters), company name, and job description (20–50,000 characters).
- Normalizes whitespace, strips non-printable control characters, and standardizes punctuation.

### 7.2 Section Classification (Required vs. Preferred)
The engine analyzes structural heading patterns to categorize requirements:
- **Required Section Patterns**: "Requirements", "Must Have", "Basic Qualifications", "Minimum Requirements", "Required Skills".
- **Preferred Section Patterns**: "Preferred Qualifications", "Nice to Have", "Bonus", "Desired Skills", "Plus".
- **Extraction Persistence**: Skills extracted from respective sections are stored in `job_descriptions.extracted_data` as:
  ```json
  {
    "requiredSkills": [{ "skillName": "Node.js", "category": "Backend" }],
    "preferredSkills": [{ "skillName": "Docker", "category": "DevOps" }],
    "extractedAt": "2026-09-24T12:00:00.000Z"
  }
  ```

---

## 8. Resume ↔ Job Compatibility Matching Engine

Implemented in `server/src/services/analysis.service.mjs` and `server/src/controllers/analysis.controller.mjs`.

### 8.1 Mathematical Composite Scoring Formula
The matching engine evaluates the candidate resume against job requirements using the approved Stage 3 formula:

$$\text{Score} = (0.70 \times S_{\text{req}} + 0.20 \times S_{\text{pref}} + 0.10 \times S_{\text{conf}}) \times 100$$

Where:
- $S_{\text{req}}$: Ratio of matched required skills ($\frac{\text{Matched Required}}{\text{Total Required}}$). If a job has no required skills but has preferred skills, $S_{\text{req}} = 1.0$.
- $S_{\text{pref}}$: Ratio of matched preferred skills ($\frac{\text{Matched Preferred}}{\text{Total Preferred}}$). If no preferred skills are listed, $S_{\text{pref}} = 0.0$.
- $S_{\text{conf}}$: Mean extraction confidence across all matched skills ($\frac{\sum \text{Confidence}}{N_{\text{matched}}}$).
- **Clamping**: The final score is clamped strictly between `0.00` and `100.00` and rounded to two decimal places.

### 8.2 Atomic Database Transaction & Snapshot Preservation
The matching operation executes within a single PostgreSQL transaction:
1. Inserts parent record into `analyses`, storing snapshot metadata (`resume_file_name`, `job_title`, scores, version).
2. Batch inserts itemized skill records into `analysis_skills` with status (`'MATCHED'`, `'MISSING'`), similarity score, and formatted evidence string containing requirement tag (`[REQUIRED]` or `[PREFERRED]`).

---

## 9. Skill Gap Analysis & Resume Quality Diagnostics

Implemented in `server/src/utils/quality.analyzer.mjs` and `server/src/services/recommendation.service.mjs`.

### 9.1 Deterministic Resume Quality Diagnostics (12 Rules, Base 100)
The diagnostic engine evaluates extracted resume text against 12 deterministic rules, starting from a base score of 100.00 and clamping between 0.00 and 100.00:

| # | Diagnostic Rule | Condition Evaluated | Deduction | Category |
| :---: | :--- | :--- | :---: | :--- |
| 1 | Missing Contact Information | Neither email NOR phone number detected | -15.00 | RESUME_QUALITY |
| 2 | Missing Skills Section | Skills section header not detected | -10.00 | RESUME_QUALITY |
| 3 | Missing Experience Section | Experience section header not detected | -10.00 | RESUME_QUALITY |
| 4 | Missing Education Section | Education section header not detected | -10.00 | RESUME_QUALITY |
| 5 | Missing Projects Section | Projects section header not detected | -10.00 | RESUME_QUALITY |
| 6 | Severe Brevity | Word count < 150 words | -30.00 | FORMATTING |
| 7 | Moderate Brevity | Word count between 150 and 249 words | -15.00 | FORMATTING |
| 8 | Slight Brevity | Word count between 250 and 399 words | -5.00 | FORMATTING |
| 9 | Excessive Verbosity | Word count > 2,000 words | -10.00 | FORMATTING |
| 10 | Sparse Bullet Points | Exactly 0 bullets: -15.00; 1 to 4 bullets: -8.00 | -15.00 / -8.00 | FORMATTING |
| 11 | Low Action-Verb Density | Exactly 0 verbs: -15.00; 1 to 2 verbs: -8.00 | -15.00 / -8.00 | IMPACT_METRICS |
| 12 | Sparse Quantifiable Metrics | Exactly 0 metrics: -15.00; 1 to 2 metrics: -8.00 | -15.00 / -8.00 | IMPACT_METRICS |

*Contact Rule Note: If either an email or a valid phone number is detected, the deduction is 0.00.*

---

## 10. Actionable Recommendation Synthesizer

Implemented in `server/src/services/recommendation.service.mjs`.

### 10.1 Multi-Tier Prioritization & Category Tagging
Recommendations are synthesized dynamically and categorized into:
- **`SKILL_GAP`**: Identifies missing technical competencies.
  - Missing Required skills are assigned **`HIGH`** priority.
  - Missing Preferred skills are assigned **`MEDIUM`** priority.
- **`RESUME_QUALITY`**: Structural and section completeness issues (Missing Contact: HIGH; Missing Experience/Skills: HIGH; Missing Education/Projects: MEDIUM).
- **`IMPACT_METRICS`**: Measurable achievements and verb strength (Zero metrics/verbs: HIGH; Sparse metrics/verbs: MEDIUM).
- **`FORMATTING`**: Length and layout indicators (Severe brevity: HIGH; Sparse bullets: MEDIUM; Excessive length: LOW).

### 10.2 Read-Only On-Demand Evaluation
Recommendations and quality scores are computed in-memory during `GET /api/analyses/:analysisId/recommendations`. The operation executes zero database write queries (`INSERT`, `UPDATE`, `DELETE`), ensuring zero side effects and preserving historical score immutability.

---

## 11. Security Architecture & Threat Defense

### 11.1 Identity & Insecure Direct Object Reference (IDOR) Protections
- **JWT Verification**: Every protected route enforces `requireAuth`, extracting `user_id` from cryptographically signed tokens.
- **Strict Tenant Query Scoping**: Every database lookup for resumes, jobs, or analyses includes `WHERE id = $1 AND user_id = $2`.
- **Anti-Enumeration 404 Responses**: Attempting to access an unowned resource returns `404 RESOURCE_NOT_FOUND` rather than `403 FORBIDDEN`, preventing attackers from enumerating valid resource IDs.

### 11.2 Input & Payload Hardening
- **Zod Schema Enforcement**: Validates request body, parameters, and query parameters before reaching business logic.
- **Parameterized SQL**: All database operations use `pg` parameter binding (`$1, $2, ...`), preventing SQL injection.
- **Error Sanitization**: Error middleware intercepts unhandled exceptions, logging details internally while returning generic error messages to clients in production.

---

## 12. Verification & Testing Strategy

### 12.1 Automated Test Execution Baseline
Testing is executed using the Node.js native test runner (`node:test` and `node:assert/strict`). The test suite comprises **9 test files** totaling **325 tests**, all passing:

```text
Suite Breakdown:
1. server/test/recommendation.test.mjs  -> 53 tests (Stage 4 Quality & Recommendations)
2. server/test/analysis.test.mjs        -> 47 tests (Stage 3 Matching & Composite Scoring)
3. server/test/job.test.mjs             -> 39 tests (Stage 2 Job Ingestion & Extraction)
4. server/test/skill.test.mjs           -> 37 tests (Stage 1 Deterministic Matcher)
5. server/test/extractor.test.mjs       -> 26 tests (Phase 6 Text Extraction)
6. server/test/processing.test.mjs      -> 27 tests (Phase 6 Async Concurrency & Recovery)
7. server/test/resume.test.mjs          -> 32 tests (Phase 5 Upload & File Vault Storage)
8. server/test/auth.test.mjs            -> 22 tests (Phase 4 Authentication & Security)
9. server/test/live_e2e_verification.mjs-> 42 tests (Phase 4 Live Integration & E2E)
--------------------------------------------------------------------------------------
Total Passing Tests: 325 tests | 0 failed | 0 skipped
```

### 12.2 Non-Exclusive Test Coverage Dimensions
The test suite covers:
- **Unit & Algorithmic Testing**: Token boundary regex checks, scoring equations, and quality rule deduction calculations.
- **Database & Relational Testing**: Transactions, cascade behaviors, and `ON DELETE SET NULL` constraints.
- **API Contract Testing**: Status codes, Zod schema rejections, and standardized response envelopes.
- **Security & Negative Testing**: IDOR attempts, invalid JWTs, magic byte mismatches, ZIP path traversal rejections, XXE attempts, and oversized uploads.
- **Concurrency & Failure Recovery**: Token fencing, worker lease expiration, and stale processing resets.

---

## 13. Known Limitations & Architectural Trade-offs

1. **Deterministic Rule-Based Matching vs. Generative LLMs**:
   - *Design Choice*: The implementation avoids an additional external processing service for document extraction. Deterministic taxonomy matching is used instead of external AI APIs.
   - *Trade-off*: Scoring is fully reproducible, explainable, and eliminates third-party data exposure. However, the system cannot detect informal synonyms not listed in the 86-skill taxonomy alias dictionary.
2. **Single-Instance In-Memory Worker vs. Distributed Queue**:
   - *Design Choice*: Concurrency is managed via an in-process semaphore and database claim tokens rather than Redis or RabbitMQ.
   - *Trade-off*: Reduces deployment complexity. However, worker throughput is bounded by the single Node.js instance.
3. **On-Demand Quality Computation vs. Database Persistence**:
   - *Design Choice*: Quality scores are computed dynamically during recommendation retrieval rather than written to `analyses.quality_score`.
   - *Trade-off*: Preserves analytical score history and avoids schema churn. However, repeated recommendation requests re-evaluate text in memory.
4. **Text-Based Document Extraction vs. Optical Character Recognition (OCR)**:
   - *Design Choice*: Uses `unpdf` and `yauzl` for stream parsing without native C++ compilation.
   - *Trade-off*: Secure and portable. However, scanned image-only PDFs without embedded text streams cannot be parsed.
5. **Deferred Frontend Interface**:
   - *Design Choice*: Complete backend, database, and API verification prioritized first.
   - *Trade-off*: The React client remains deferred; the full system is exercised and evaluated through its 23 REST API endpoints.

---

## 14. Future Scope & Conclusions

### 14.1 Future Enhancements
- **React Frontend Integration**: Implement the deferred SPA client using React and Vite, connecting to the 23 verified API endpoints.
- **OCR Fallback Engine**: Add Tesseract OCR for scanned PDF document parsing.
- **Hybrid Semantic Embeddings**: Complement deterministic taxonomy matching with locally hosted vector embeddings (e.g., ONNX runtime) for semantic skill similarity.
- **Distributed Processing Queue**: Transition the single-instance semaphore to Redis/BullMQ for horizontal scaling across multi-node worker clusters.

### 14.2 Conclusion
Phase 7 Stages 1 through 5 establish a robust, secure, and fully verified backend platform for automated resume evaluation and job compatibility analysis. With 325 passing automated tests, zero external AI dependencies, and strict defense-in-depth protections, the system demonstrates that deterministic engineering provides an explainable, auditable, and secure alternative to black-box resume screening platforms.
