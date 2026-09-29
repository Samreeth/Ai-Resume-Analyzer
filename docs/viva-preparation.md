# Technical Viva & Evaluation Defense Guide

This document contains 20 comprehensive technical viva questions and defensible answers rooted strictly in the actual implementation of the **AI-Powered Resume Analyzer and Job Matching Platform**.

---

### Question 1: System Architecture
**Q**: *Why did you implement text extraction, skill matching, and scoring directly in Node.js instead of maintaining a separate Python microservice or calling cloud AI APIs?*  
**Answer**:  
The implementation performs text extraction, skill matching, scoring, and recommendation generation locally within the Node.js runtime. This avoids an additional external processing service for document extraction, eliminates network hops, and reduces third-party data exposure by processing resume text entirely within the application boundary. It also removes external API subscription costs and credential exposure risks while ensuring that scoring remains 100% deterministic and reproducible.

---

### Question 2: Deterministic Matching vs. Generative LLMs
**Q**: *Why choose deterministic taxonomy matching over generative AI models like GPT-4 or Gemini for candidate evaluation?*  
**Answer**:  
Deterministic matching was selected because it provides reproducible, explainable scoring and does not require sending resume data to an external AI service. Generative models introduce non-deterministic variability (returning different scores for identical inputs across runs), hallucination risks (inventing skills or qualifications), and prompt injection vulnerabilities. In employment decision-support tools, auditability and explainability are paramount.

---

### Question 3: Composite Scoring Formulation
**Q**: *Explain the mathematical formulation behind the Stage 3 composite match score.*  
**Answer**:  
The score is computed using the formula:
$$\text{Overall Score} = (0.70 \times S_{\text{req}} + 0.20 \times S_{\text{pref}} + 0.10 \times S_{\text{conf}}) \times 100$$
- $S_{\text{req}}$ is the fraction of required skills matched ($\frac{\text{Matched Required}}{\text{Total Required}}$). If a job has no required skills but lists preferred skills, $S_{\text{req}}$ defaults to 1.0.
- $S_{\text{pref}}$ is the fraction of preferred skills matched ($\frac{\text{Matched Preferred}}{\text{Total Preferred}}$). If no preferred skills are listed, it defaults to 0.0.
- $S_{\text{conf}}$ is the average extraction confidence across all matched skills ($\frac{\sum \text{Confidence}}{N_{\text{matched}}}$).
The score is clamped strictly between `0.00` and `100.00` and rounded to two decimal places.

---

### Question 4: Analytical History Preservation vs. User Control
**Q**: *How does the system balance analytical history preservation with user deletion rights?*  
**Answer**:  
Stage 3 analysis records are not modified or re-scored by the analytical pipeline after creation. When an analysis is created, snapshot metadata (`resume_file_name` and `job_title`) is frozen into columns on the `analyses` table, and the foreign keys `resume_id` and `job_id` specify `ON DELETE SET NULL`. If an underlying resume or job is deleted, the analysis report survives intact with `resume_id = NULL` or `job_id = NULL`. However, existing analysis records can still be explicitly deleted through the authorized `DELETE /api/analyses/:analysisId` endpoint, cascading cleanly to `analysis_skills`.

---

### Question 5: On-Demand Resume Quality Diagnostics
**Q**: *Why is the Stage 4 resume quality score computed on demand rather than persisted in the database?*  
**Answer**:  
Stage 4 computes recommendations on demand using existing database records and deterministic in-memory processing. This design preserves the immutability of historical analysis records and avoids unnecessary database migrations or table mutations during read operations. Computing diagnostics on retrieval ensures that any refinement in quality rules immediately benefits users without mutating historical scoring records.

---

### Question 6: Token Isolation & Short Skill Disambiguation
**Q**: *How does the skill matcher prevent false positives when searching for short or single-letter skills like C, R, or Go?*  
**Answer**:  
In `server/src/utils/skill.matcher.mjs`, short tokens use strict lookahead and lookbehind regular expressions:
- For `C`, the regex `(?<![a-zA-Z0-9])C(?![a-zA-Z0-9+#])` combined with contextual language checks prevents matches inside common words or symbols like `C++` and `C#`.
- For `Go`, the pattern `(?<![a-zA-Z0-9])(Go|Golang)(?![a-zA-Z0-9])` distinguishes the programming language from the common English verb "go".
Standard multi-letter skills use word-boundary regex (`\bTOKEN\b`) across canonical names and cataloged aliases.

---

### Question 7: Secure Resume Upload Pipeline
**Q**: *How does the application prevent malicious file uploads from compromising the server?*  
**Answer**:  
The upload pipeline in `server/src/middleware/upload.middleware.mjs` and `server/src/services/resume.service.mjs` applies layered defenses:
1. Multer stages files exclusively in memory with a 5 MB limit.
2. File extensions and MIME types are whitelisted strictly to `.pdf` and `.docx`.
3. Binary magic bytes are validated (`%PDF-` for PDF, `PK\x03\x04` for DOCX).
4. Files are stored outside public web roots with random UUIDv4 names.
5. Writes are staged as `.tmp_<uuid>.tmp` and renamed atomically, with automatic cleanup on database error.

---

### Question 8: DOCX Extraction Hardening & ZIP Security
**Q**: *What specific security limits are enforced when extracting text from DOCX files?*  
**Answer**:  
In `server/src/services/extractors/docx.extractor.mjs`:
1. Archive entries are limited to a maximum of 1,000 entries.
2. Entry filenames are restricted to 255 characters.
3. Path traversal sequences (`..`, leading `/`, backslashes `\`) are rejected.
4. Mandatory DOCX files `[Content_Types].xml` and `word/document.xml` must be present.
5. The uncompressed `word/document.xml` stream is capped at 10 MB (`EXTRACTION_LIMITS.MAX_XML_STREAM_BYTES`).
6. Total uncompressed archive bytes are capped at 10 MB.
7. XML payloads matching `<!DOCTYPE` or `<!ENTITY` are rejected to prevent XXE injection.
8. `fast-xml-parser` is configured with `processEntities: false`.
9. Extraction runs entirely in memory without writing temporary uncompressed files to disk.

---

### Question 9: Concurrency Control & Processing Fencing
**Q**: *How does the system prevent race conditions when multiple workers attempt to process the same resume?*  
**Answer**:  
Concurrency is governed by two layers in `server/src/services/processing.service.mjs`:
1. An in-memory concurrency semaphore (`server/src/utils/semaphore.util.mjs`) limits concurrent extraction operations to 2 simultaneous tasks.
2. An atomic database claim token (`resumes.processing_token` UUID) ensures token fencing:
   ```sql
   UPDATE resumes
   SET extraction_status = 'PROCESSING', processing_token = $1, processing_started_at = CURRENT_TIMESTAMP
   WHERE resume_id = $2 AND extraction_status IN ('PENDING', 'FAILED') AND processing_attempts < 3
   RETURNING resume_id;
   ```
   Only the worker that successfully updates the row acquires the processing lock.

---

### Question 10: Crash Recovery & Stale Worker Handling
**Q**: *What happens if the Node.js server crashes while a resume is in `PROCESSING` status?*  
**Answer**:  
Two recovery mechanisms handle abandoned tasks:
1. **Startup Recovery (`runStartupRecovery`)**: When the server boots, it queries `resumes` for any rows in `PROCESSING` status and resets them to `FAILED` with `processing_error_code = 'SERVER_RESTARTED'`.
2. **Periodic Stale Recovery (`runStaleRecovery`)**: A periodic timer identifies any task remaining in `PROCESSING` status for longer than 5 minutes and marks it `FAILED` with code `STALE_PROCESSING_TIMEOUT`.
Users can then re-trigger processing if `processing_attempts < 3`.

---

### Question 11: Insecure Direct Object Reference (IDOR) Protections
**Q**: *How does the application protect against IDOR attacks across its 23 endpoints?*  
**Answer**:  
All queries for user-owned resources enforce tenant scoping by combining the resource ID with the authenticated user ID:
`WHERE id = $1 AND user_id = req.user.userId`.
If an ID does not exist or belongs to another user, the system uniformly returns `404 RESOURCE_NOT_FOUND` rather than `403 FORBIDDEN`. This anti-enumeration defense prevents attackers from discovering valid resource IDs owned by other users.

---

### Question 12: Job Description Section Classification
**Q**: *How does the system distinguish between required and preferred qualifications in job descriptions?*  
**Answer**:  
In `server/src/services/job.service.mjs`, regular expressions scan for heading patterns:
- "Requirements", "Must Have", "Basic Qualifications", and "Required Skills" delimit required qualification blocks.
- "Preferred Qualifications", "Nice to Have", "Bonus", and "Desired Skills" delimit preferred blocks.
Skills extracted from these blocks are categorized into `requiredSkills` and `preferredSkills` arrays in `job_descriptions.extracted_data`.

---

### Question 13: Contact Information Diagnostic Rule
**Q**: *What are the exact deduction rules for missing contact information in Stage 4?*  
**Answer**:  
In `server/src/utils/quality.analyzer.mjs`, the contact information check uses boolean OR logic:
- The text is scanned for a valid email address regex and a valid phone number regex.
- If *either* an email OR a phone number is detected, the contact presence check passes (0.00 deduction).
- A 15.00 deduction is applied only if *neither* an email nor a phone number is detected in the resume text.

---

### Question 14: Action Verb & Quantifiable Metric Detection
**Q**: *How does the resume quality analyzer evaluate action verbs and quantifiable impact?*  
**Answer**:  
- **Action Verbs**: The analyzer matches extracted text against a curated dictionary of 35+ strong resume action verbs (e.g., "architected", "spearheaded", "engineered", "optimized"). If 0 verbs are found, a 15.00 deduction applies; if 1 to 2 verbs are found, an 8.00 deduction applies.
- **Quantifiable Metrics**: Regular expressions search for percentage symbols (`%`), monetary indicators (`$`, `USD`), scale multipliers (e.g., `10x`, `2x`), and numeric counts. If 0 metrics are found, a 15.00 deduction applies; if 1 to 2 metrics are found, an 8.00 deduction applies.

---

### Question 15: Database Indexing Strategy
**Q**: *Which database indexes were created and what performance purposes do they serve?*  
**Answer**:  
The schema includes:
1. Foreign key B-tree indexes: `idx_resumes_user_id`, `idx_jobs_user_id`, `idx_analyses_user_id` optimize tenant-scoped queries.
2. Case-insensitive unique expression indexes: `idx_users_lower_email` on `users(LOWER(email))` and `idx_skills_lower_name` on `skills(LOWER(skill_name))` prevent duplicate records.
3. Compound sorting indexes: `idx_analyses_user_history` on `(user_id, created_at DESC)` and `idx_resumes_user_uploaded` on `(user_id, uploaded_at DESC)` accelerate dashboard pagination.
4. Partial indexes: `idx_resumes_status_stale` on `(extraction_status, processing_started_at) WHERE extraction_status = 'PROCESSING'` and `idx_resumes_processing_token` optimize recovery and token lookups.

---

### Question 16: Password Security & Storage
**Q**: *How are user passwords hashed, stored, and protected?*  
**Answer**:  
In `server/src/services/auth.service.mjs`, passwords are hashed using `bcrypt` with 10 salt rounds. Plaintext passwords are never logged, cached, or stored. In database queries, password hashes are explicitly omitted from return payloads, and password comparisons are performed using `bcrypt.compare()` to mitigate timing attacks.

---

### Question 17: Stateless Authentication Architecture
**Q**: *How is authentication implemented and what are the security trade-offs of your JWT approach?*  
**Answer**:  
Authentication uses JSON Web Tokens (HS256) signed with a server secret. Tokens encode `userId` and `email` with a standard expiration (7 days). On incoming requests, `requireAuth` verifies signature validity and expiration before injecting `req.user`. While stateless JWTs eliminate database lookup overhead on every request, revocation requires client-side token deletion or token blacklisting.

---

### Question 18: Testing Strategy Without External Mocks
**Q**: *How did you achieve comprehensive test coverage across 325 tests without mocking libraries?*  
**Answer**:  
Tests use the Node.js native test runner (`node:test` and `node:assert/strict`). Rather than mocking database drivers or file extractors with artificial stubs, tests execute against live PostgreSQL database transactions and real binary PDF/DOCX buffers. Tests create isolated user tenants and clean up their test data, verifying real database constraints, foreign key cascades, and HTTP response envelopes.

---

### Question 19: Unused Template Files in the Repository
**Q**: *Why does the `nlp-service/` directory exist in the repository if it is not used by the application?*  
**Answer**:  
`nlp-service/` was created during initial project scaffolding when a separate Python microservice was originally envisioned. During architecture refinement, in-process extraction and matching were implemented directly in Node.js to eliminate inter-service network overhead and simplify deployment. The folder was retained as an unused template to preserve commit history while the Node.js engine operates as the authoritative production implementation.

---

### Question 20: Future Technical Roadmap
**Q**: *What are the primary technical improvements planned for future iterations?*  
**Answer**:  
1. **React Frontend Implementation**: Connect the deferred React/Vite single-page application to the 23 verified API endpoints.
2. **OCR Integration**: Integrate Tesseract OCR for parsing scanned, image-only PDF documents.
3. **Hybrid Embedding Layer**: Augment the deterministic taxonomy matcher with a locally hosted ONNX embedding model to identify uncataloged semantic synonyms.
4. **Distributed Job Queue**: Transition the single-instance concurrency semaphore to Redis/BullMQ to allow horizontal scaling across multi-node worker clusters.
