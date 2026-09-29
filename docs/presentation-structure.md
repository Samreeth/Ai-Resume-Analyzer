# Presentation Slide Deck: AI-Powered Resume Analyzer

This document defines the 16-slide presentation structure for academic project evaluation, technical reviews, and project defense demonstrations.

---

### Slide 1: Title Slide
- **Title**: AI-Powered Resume Analyzer and Job Matching Platform
- **Subtitle**: Deterministic Skill Taxonomy Matching, Quality Diagnostics, and Explainable Candidate Scoring
- **Objective**: Establish project identity, core technologies, and engineering focus.
- **Key Technical Points**:
  - Full-stack web application backend built with Node.js ESM and PostgreSQL 16.
  - In-process document parsing (`unpdf`, `yauzl`), deterministic matching, and multi-tier scoring.
  - Complete backend verification: 325 automated tests passing across 9 test suites.
- **Visual Reference**: High-Level System Architecture Diagram (`docs/diagrams/system-architecture.md#1-high-level-system-architecture`).
- **Speaking Points**:
  - "Good morning/afternoon. Today I present our AI-Powered Resume Analyzer and Job Matching Platform."
  - "The project delivers a secure, deterministic, and auditable system that analyzes candidate resumes against job descriptions without external AI dependencies or black-box opacity."

---

### Slide 2: The Problem Space — Automated Resume Screening Challenges
- **Title**: The Problem Space: Automated Screening & Black-Box Inefficiencies
- **Objective**: Frame the industry and technical problem addressed by the project.
- **Key Technical Points**:
  - **ATS Opacity**: Traditional Applicant Tracking Systems reject qualified candidates due to rigid keyword mismatches.
  - **Generative AI Non-Determinism**: Cloud LLMs produce fluctuating, non-reproducible scores for the same resume.
  - **Data Privacy Concerns**: Sending candidate PII to third-party cloud APIs introduces data exposure risks.
  - **Lack of Diagnostic Guidance**: Candidates receive binary rejection notices without actionable feedback.
- **Visual Reference**: Problem statement comparison table.
- **Speaking Points**:
  - "Candidates apply to dozens of jobs without knowing how their resume matches specific qualifications."
  - "Current solutions either rely on brittle keyword search or unpredictable generative AI APIs that expose personal candidate data."

---

### Slide 3: Project Objectives & Design Philosophy
- **Title**: Project Objectives & Design Philosophy
- **Objective**: Define core engineering principles guiding the system implementation.
- **Key Technical Points**:
  - **Deterministic Explainability**: 100% reproducible scoring—same input always yields the exact same score.
  - **Local In-Process Processing**: Document extraction, taxonomy matching, and scoring execute entirely within the local Node.js runtime.
  - **Defense-in-Depth Security**: Layered protection across uploads (magic bytes, ZIP traversal checks), tenant scoping (IDOR defense), and authentication (JWT, bcrypt).
  - **Analytical History Preservation**: Preserving historical scoring records while respecting user deletion rights.
- **Visual Reference**: Objectives hierarchy matrix.
- **Speaking Points**:
  - "Our design philosophy centers on determinism, local execution, and auditability."
  - "We ensure that every score deduction and recommendation is grounded in specific, verifiable rules."

---

### Slide 4: System Architecture Overview
- **Title**: System Architecture: Multi-Tiered Node.js & PostgreSQL
- **Objective**: Walk through the backend runtime architecture and service separation.
- **Key Technical Points**:
  - Built with native ECMAScript Modules (Node.js ESM) and Express 4.21.
  - Layered pipeline: Helmet/CORS Edge → Auth Middleware → Zod Schema Validation → Controllers → Services → PostgreSQL.
  - Local engines for text extraction, skill matching, and quality analysis.
  - Relational store with 7 tables, automated updated triggers, and targeted B-tree indexes.
- **Visual Reference**: Component Topology Diagram (`docs/diagrams/system-architecture.md#1-high-level-system-architecture`).
- **Speaking Points**:
  - "Here we see our architectural topology. Requests enter through hardened middleware where authentication and Zod validation occur before reaching business logic."
  - "All data is persisted in PostgreSQL with strict relational integrity."

---

### Slide 5: Secure Resume Ingestion Pipeline
- **Title**: Secure Resume Ingestion: Multi-Tier Upload Hardening
- **Objective**: Demonstrate defensive engineering applied to file handling.
- **Key Technical Points**:
  - In-memory staging via Multer with strict 5 MB limits to prevent disk exhaustion.
  - File extension and MIME type whitelisting restricted strictly to `.pdf` and `.docx`.
  - True binary inspection via magic bytes (`%PDF-` and `PK\x03\x04`).
  - Storage vault jailing outside web root with random UUIDv4 filenames.
  - Atomic two-phase write: `.tmp_<uuid>.tmp` renamed to `<uuid>.<ext>` with automatic cleanup on database error.
- **Visual Reference**: Resume Ingestion Flow Diagram (`docs/diagrams/system-architecture.md#3-resume-ingestion--storage-pipeline`).
- **Speaking Points**:
  - "File uploads represent a significant attack vector. We enforce multi-stage validation including magic-byte inspection before any file touches permanent storage."

---

### Slide 6: In-Process Document Text Extraction
- **Title**: In-Process Document Text Extraction: PDF & DOCX
- **Objective**: Detail how raw text is extracted locally and secured against ZIP vulnerabilities.
- **Key Technical Points**:
  - **PDF Extraction**: Serverless memory parsing using `unpdf`.
  - **DOCX Extraction**: Stream parsing with `yauzl` and `fast-xml-parser`.
  - **ZIP Hardening**: Archive limited to 1,000 entries; filenames limited to 255 chars; path traversal characters (`..`, `/`, `\`) rejected.
  - **Resource Bounds**: Streaming byte-counters limit uncompressed `word/document.xml` and total archive stream to 10 MB.
  - **XXE Prevention**: Strict regex rejection of `<!DOCTYPE` and `<!ENTITY`; entity processing disabled.
- **Visual Reference**: Extraction State Machine Diagram (`docs/diagrams/system-architecture.md#4-in-process-text-extraction-state-machine`).
- **Speaking Points**:
  - "We extract text directly inside the Node.js runtime without external microservices or binary dependencies."
  - "DOCX extraction enforces strict bounds: maximum 1,000 entries, 10 MB uncompressed streaming limits, and zero external entity resolution."

---

### Slide 7: Deterministic Skill Taxonomy & Matching Engine
- **Title**: Deterministic Skill Extraction: 86-Skill Canonical Taxonomy
- **Objective**: Explain token normalization, disambiguation, and regex boundary isolation.
- **Key Technical Points**:
  - 86 canonical technical skills categorized across Languages, Frameworks, Cloud, Databases, and Tools.
  - Contextual section detection (e.g., Skills, Experience, Education) with section-weight multipliers.
  - **Token Disambiguation**: Lookahead/lookbehind fencing (`(?<![a-zA-Z0-9])C(?![a-zA-Z0-9+#])`) isolates single-letter skills like C, R, and Go from common words or symbols.
  - Alias normalization (e.g., "Postgres" maps to "PostgreSQL", "k8s" maps to "Kubernetes").
- **Visual Reference**: Skill Extraction Pipeline Diagram (`docs/diagrams/system-architecture.md#5-deterministic-skill-extraction-pipeline`).
- **Speaking Points**:
  - "Matching technical skills deterministically requires solving ambiguity. Single-letter languages like C or short names like Go are isolated with lookahead boundaries to prevent false positives."

---

### Slide 8: Job Description Management & Requirement Extraction
- **Title**: Job Description Ingestion: Automated Requirement Tiering
- **Objective**: Show how job postings are sanitized and split into priority tiers.
- **Key Technical Points**:
  - Zod validation and whitespace sanitization on job title and body text.
  - Heuristic section parsing detects keyword patterns ("Must Have", "Required Qualifications" vs. "Nice to Have", "Preferred").
  - Skills extracted into distinct `requiredSkills` and `preferredSkills` lists.
  - Extracted requirements persisted into `job_descriptions.extracted_data` JSONB column.
- **Visual Reference**: Job Extraction Flow Diagram (`docs/diagrams/system-architecture.md#6-job-description-ingestion--extraction-flow`).
- **Speaking Points**:
  - "Job requirements are not all equal. Our system splits job descriptions into Required qualifications and Preferred qualifications, enabling nuanced multi-tier scoring."

---

### Slide 9: Resume ↔ Job Compatibility Matching Engine
- **Title**: Compatibility Matching: Explainable Mathematical Scoring
- **Objective**: Present the Stage 3 composite compatibility score formulation.
- **Key Technical Points**:
  - Formula: $\text{Score} = (0.70 \times S_{\text{req}} + 0.20 \times S_{\text{pref}} + 0.10 \times S_{\text{conf}}) \times 100$.
  - Required skills drive 70% of the score; preferred skills account for 20%; extraction confidence contributes 10%.
  - Clamped strictly between `0.00` and `100.00` and rounded to two decimal places.
  - Atomic transaction writes parent record to `analyses` and itemized matches to `analysis_skills`.
- **Visual Reference**: Matching Sequence Diagram (`docs/diagrams/system-architecture.md#7-resume--job-compatibility-matching-engine`).
- **Speaking Points**:
  - "Our composite score reflects real-world hiring logic: core requirements form 70% of the evaluation, preferred skills act as competitive differentiators at 20%, and formatting clarity provides 10%."

---

### Slide 10: Historical Analysis Preservation & Data Integrity
- **Title**: Data Integrity: Analytical History Preservation vs. User Control
- **Objective**: Explain how the database preserves analytical records while respecting user rights.
- **Key Technical Points**:
  - **No Pipeline Mutation**: Analysis records and scores are not modified or re-scored by the pipeline after creation.
  - **Snapshot Metadata**: `resume_file_name` and `job_title` columns freeze entity names at evaluation time.
  - **Safe Cascades**: `analyses.resume_id` and `analyses.job_id` use `ON DELETE SET NULL`. If a resume or job is deleted, historical reports remain auditable.
  - **Explicit Deletion**: Users retain the ability to explicitly delete analyses they own via `DELETE /api/analyses/:analysisId`.
- **Visual Reference**: Database ER Diagram (`docs/diagrams/database-er.md#1-entity-relationship-diagram`).
- **Speaking Points**:
  - "We balance analytical integrity with user control. If a candidate deletes an old resume, historical analyses survive with frozen metadata, but the user can still explicitly delete any analysis record."

---

### Slide 11: Resume Quality Diagnostics & Scoring Engine
- **Title**: Resume Quality Diagnostics: 12 Deterministic Rules
- **Objective**: Explain the Stage 4 diagnostic engine and deduction rules.
- **Key Technical Points**:
  - Base score of 100.00, clamped strictly between 0.00 and 100.00.
  - **Contact Check**: -15.00 only if *neither* email nor phone is detected (boolean OR logic).
  - **Section Completeness**: -10.00 each for missing Skills, Experience, Education, or Projects sections.
  - **Length Bounds**: Tiered deductions for brevity (<150 words: -30; 150–249 words: -15; 250–399 words: -5; >2000 words: -10).
  - **Content Quality**: Deductions for sparse bullets, low action-verb density, and missing quantifiable metrics.
- **Visual Reference**: Quality Diagnostic Flow Diagram (`docs/diagrams/system-architecture.md#8-on-demand-quality-diagnostics--recommendation-engine`).
- **Speaking Points**:
  - "Our resume quality score is not an arbitrary rating. It starts at 100 and applies 12 transparent deduction rules covering section structure, verb strength, and quantifiable impact."

---

### Slide 12: Actionable Recommendation Generation
- **Title**: Actionable Recommendations: Prioritized Guidance
- **Objective**: Showcase how diagnostic results and skill gaps are synthesized into user suggestions.
- **Key Technical Points**:
  - Categorized into `SKILL_GAP`, `RESUME_QUALITY`, `IMPACT_METRICS`, and `FORMATTING`.
  - Prioritized systematically: Missing Required skills → HIGH; Missing Preferred skills → MEDIUM; Quality & metric suggestions → HIGH/MEDIUM/LOW.
  - Read-only on-demand generation during `GET /api/analyses/:analysisId/recommendations` without database mutations.
- **Visual Reference**: Sample Recommendation JSON payload.
- **Speaking Points**:
  - "Recommendations are categorized and prioritized so candidates immediately see high-impact fixes, such as addressing required skill gaps or adding quantifiable achievements."

---

### Slide 13: System Security & IDOR Protections
- **Title**: Security Posture: Multi-Tenant Isolation & Attack Surface Hardening
- **Objective**: Highlight tenant boundaries and anti-enumeration defenses.
- **Key Technical Points**:
  - Insecure Direct Object Reference (IDOR) prevention: all queries scoped by `WHERE id = $1 AND user_id = $2`.
  - Anti-enumeration defense: Unowned resources return uniform `404 RESOURCE_NOT_FOUND` to prevent ID probing.
  - Passwords hashed with bcrypt (10 rounds); credentials never logged or returned.
  - Parameterized queries everywhere via `pg` (zero string interpolation).
- **Visual Reference**: Security Layer Overview (`docs/final-technical-report.md#11-security-architecture--threat-defense`).
- **Speaking Points**:
  - "Security is baked into every endpoint. We enforce tenant-scoped queries and return 404 rather than 403 on unowned resources, preventing malicious ID enumeration."

---

### Slide 14: Verification, Quality Assurance & Test Strategy
- **Title**: Verification: 325 Passing Tests Across 9 Suites
- **Objective**: Present test metrics and verification methodology.
- **Key Technical Points**:
  - Native Node.js test runner (`node:test`) with zero external testing dependencies.
  - Exact breakdown:
    - Recommendations: 53 | Analyses: 47 | Jobs: 39 | Skills: 37
    - Extractor: 26 | Processing: 27 | Resumes: 32 | Auth: 22 | Live E2E: 42
  - Covers unit logic, live PostgreSQL transactions, error envelopes, and security boundaries.
- **Visual Reference**: Test execution terminal summary.
- **Speaking Points**:
  - "Every capability is validated through automated testing. The entire test suite of 325 tests passes with zero failures, covering unit algorithms, database transactions, and security boundaries."

---

### Slide 15: Architectural Trade-offs & Limitations
- **Title**: Architectural Trade-offs & Known Boundaries
- **Objective**: Transparently discuss engineering trade-offs and intentional boundaries.
- **Key Technical Points**:
  - **Deterministic Rules vs. LLMs**: 100% reproducible and auditable, but cannot infer uncataloged synonyms outside the 86-skill taxonomy.
  - **Single-Instance Worker**: Semaphore concurrency avoids message-queue infrastructure, but limits scaling across multi-node clusters.
  - **On-Demand Quality Scoring**: Preserves analytical score immutability, but re-evaluates text in memory during recommendation queries.
  - **Text Parsing vs. OCR**: Fast and dependency-free, but cannot parse scanned image-only PDFs.
- **Visual Reference**: Trade-off comparison matrix (`docs/final-technical-report.md#13-known-limitations--architectural-trade-offs`).
- **Speaking Points**:
  - "Engineering involves trade-offs. Choosing deterministic local processing eliminates third-party API costs and data exposure, while bounding semantic discovery to our curated taxonomy."

---

### Slide 16: Summary, Future Scope & Conclusions
- **Title**: Summary, Future Roadmap & Conclusion
- **Objective**: Summarize achievements and outline future milestones.
- **Key Technical Points**:
  - **Delivered**: Complete, verified 23-endpoint REST API, deterministic matching, quality diagnostics, and 325 passing tests.
  - **Future Roadmap**:
    1. React single-page application frontend integration.
    2. Local OCR engine (Tesseract) for scanned document parsing.
    3. Hybrid semantic embedding layer for synonym expansion.
- **Visual Reference**: Project milestone completion checklist.
- **Speaking Points**:
  - "In conclusion, Phase 7 delivers an auditable, secure, and production-ready backend engine for resume analysis."
  - "Thank you. We are now open for questions."
