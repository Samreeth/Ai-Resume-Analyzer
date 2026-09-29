# Complete REST API Specification

This document provides the authoritative contract specification for all **23 implemented REST API endpoints** in the **AI-Powered Resume Analyzer and Job Matching Platform**.

---

## 1. Global API Conventions

### 1.1 Base URL
All API routes are served relative to the root server address:
`http://localhost:5000` (or configured `PORT`).

### 1.2 Standard Response Envelopes
All responses adhere to standardized JSON envelopes:

**Success Envelope (2xx)**:
```json
{
  "success": true,
  "data": {},
  "message": "Human-readable confirmation message"
}
```

**Error Envelope (4xx / 5xx)**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Descriptive error message",
    "details": []
  }
}
```

### 1.3 Standard Error Codes
- `VALIDATION_ERROR` (400): Request body, parameters, or query parameters violated Zod schema rules.
- `UNAUTHORIZED` / `AUTHENTICATION_ERROR` (401): Missing, malformed, or expired JWT token.
- `FORBIDDEN` (403): User lacks permission.
- `RESOURCE_NOT_FOUND` (404): Resource does not exist or belongs to another tenant (anti-enumeration defense).
- `CONFLICT` / `RESUME_ALREADY_PROCESSING` (409): Resource state prevents operation.
- `FILE_TOO_LARGE` (413): Uploaded file exceeds 5 MB.
- `UNSUPPORTED_MEDIA_TYPE` (415): Uploaded file is not `.pdf` or `.docx` or failed magic-byte validation.
- `UNPROCESSABLE_ENTITY` (422): Malformed archive, corrupt document, or unextractable text.
- `INTERNAL_SERVER_ERROR` (500): Unhandled server exception.

---

## 2. Endpoint Index Summary (23 Endpoints)

| # | Method | Endpoint Route | Auth | Description | Database Action |
| :---: | :--- | :--- | :---: | :--- | :--- |
| 1 | `GET` | `/health` | No | Health check and uptime status | Read-only |
| 2 | `GET` | `/api` | No | API version and discovery summary | Read-only |
| 3 | `POST` | `/api/auth/register` | No | Register new user account | Writes `users` |
| 4 | `POST` | `/api/auth/login` | No | Verify credentials & issue JWT | Reads `users` |
| 5 | `GET` | `/api/auth/me` | Yes | Get authenticated user profile | Reads `users` |
| 6 | `POST` | `/api/auth/logout` | Yes | Client-side session acknowledgment | No DB action |
| 7 | `POST` | `/api/resumes` | Yes | Upload & stage PDF/DOCX resume | Writes `resumes` (`PENDING`) |
| 8 | `GET` | `/api/resumes` | Yes | List paginated user resumes | Reads `resumes` |
| 9 | `GET` | `/api/resumes/:resumeId` | Yes | Get resume metadata & text | Reads `resumes` |
| 10 | `POST` | `/api/resumes/:resumeId/process` | Yes | Trigger in-process text & skill extraction | Updates `resumes`, writes `resume_skills` |
| 11 | `GET` | `/api/resumes/:resumeId/status` | Yes | Poll resume extraction status | Reads `resumes` |
| 12 | `DELETE` | `/api/resumes/:resumeId` | Yes | Delete resume & file vault asset | Deletes `resumes`, nullifies `analyses.resume_id` |
| 13 | `POST` | `/api/jobs` | Yes | Create job posting & extract requirements | Writes `job_descriptions` |
| 14 | `GET` | `/api/jobs` | Yes | List paginated user job postings | Reads `job_descriptions` |
| 15 | `GET` | `/api/jobs/:jobId` | Yes | Get job posting details | Reads `job_descriptions` |
| 16 | `PUT` | `/api/jobs/:jobId` | Yes | Update job posting & re-extract skills | Updates `job_descriptions` |
| 17 | `DELETE` | `/api/jobs/:jobId` | Yes | Delete job posting | Deletes `job_descriptions`, nullifies `analyses.job_id` |
| 18 | `POST` | `/api/jobs/:jobId/extract` | Yes | Re-run skill extraction on job | Updates `job_descriptions.extracted_data` |
| 19 | `POST` | `/api/analyses` | Yes | Execute matching & compute scores | Atomic transaction: writes `analyses`, `analysis_skills` |
| 20 | `GET` | `/api/analyses` | Yes | List user historical analyses | Reads `analyses` |
| 21 | `GET` | `/api/analyses/:analysisId` | Yes | Get analysis report & matched skills | Reads `analyses`, `analysis_skills` |
| 22 | `GET` | `/api/analyses/:analysisId/recommendations` | Yes | On-demand quality diagnostics & recommendations | Read-only: zero DB writes |
| 23 | `DELETE` | `/api/analyses/:analysisId` | Yes | Explicitly delete analysis record | Deletes `analyses`, cascades `analysis_skills` |

---

## 3. System & Discovery Endpoints

### 3.1 Health Check: `GET /health`
- **Auth**: None
- **Query / Body**: None
- **Success (200 OK)**:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-09-29T16:00:00.000Z",
    "uptime": 12.34
  }
  ```

### 3.2 API Information: `GET /api`
- **Auth**: None
- **Success (200 OK)**:
  ```json
  {
    "name": "AI-Powered Resume Analyzer API",
    "version": "1.0.0",
    "status": "active"
  }
  ```

---

## 4. Authentication Endpoints (`/api/auth`)

### 4.1 Register User: `POST /api/auth/register`
- **Auth**: None
- **Request Body**:
  ```json
  {
    "name": "Jane Candidate",
    "email": "jane@example.com",
    "password": "Password123!"
  }
  ```
- **Validation**: `name` 2–100 chars; `email` valid format (case-insensitive unique); `password` 8–128 chars.
- **Success (201 Created)**: Returns created user object (excluding `password_hash`).
- **Errors**: `400 VALIDATION_ERROR` (duplicate email or invalid inputs).

### 4.2 Login User: `POST /api/auth/login`
- **Auth**: None
- **Request Body**:
  ```json
  {
    "email": "jane@example.com",
    "password": "Password123!"
  }
  ```
- **Success (200 OK)**: Returns JWT bearer token and user summary.
- **Errors**: `401 AUTHENTICATION_ERROR` (invalid email or password).

### 4.3 Get Authenticated Profile: `GET /api/auth/me`
- **Auth**: `Authorization: Bearer <token>`
- **Success (200 OK)**: Returns profile for authenticated `req.user.userId`.
- **Errors**: `401 AUTHENTICATION_ERROR` (missing or invalid token).

### 4.4 Logout: `POST /api/auth/logout`
- **Auth**: `Authorization: Bearer <token>`
- **Behavior**: Stateless acknowledgment. Client must discard local token.
- **Success (200 OK)**: `{ "success": true, "data": {}, "message": "Logged out successfully" }`.

---

## 5. Resume Management Endpoints (`/api/resumes`)

### 5.1 Upload Resume: `POST /api/resumes`
- **Auth**: `Authorization: Bearer <token>`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `resume` (Binary file, max 1 file, max 5 MB).
- **Validation**: Whitelisted `.pdf` or `.docx`, magic bytes check (`%PDF-` or `PK\x03\x04`).
- **Success (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "resume": {
        "resume_id": "7b5247b4-3a9a-4c28-9842-83b6cb65f142",
        "file_name": "candidate_resume.pdf",
        "file_size": 245760,
        "mime_type": "application/pdf",
        "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "status": "PENDING",
        "uploaded_at": "2026-09-29T16:10:00.000Z"
      }
    },
    "message": "Resume uploaded successfully"
  }
  ```
- **Errors**: `400 VALIDATION_ERROR`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`.

### 5.2 List Resumes: `GET /api/resumes`
- **Auth**: `Authorization: Bearer <token>`
- **Query**: `page` (integer $\ge 1$, default 1), `limit` (integer 1–100, default 10).
- **Success (200 OK)**: Paginated array of resumes owned by authenticated user.

### 5.3 Get Resume Details: `GET /api/resumes/:resumeId`
- **Auth**: `Authorization: Bearer <token>`
- **Path Param**: `resumeId` (UUIDv4).
- **Success (200 OK)**: Full resume details including `extracted_text` and processing status.
- **Errors**: `404 RESOURCE_NOT_FOUND` (if unowned or non-existent).

### 5.4 Trigger Processing: `POST /api/resumes/:resumeId/process`
- **Auth**: `Authorization: Bearer <token>`
- **Path Param**: `resumeId` (UUIDv4).
- **Behavior**: Acquires atomic claim token; transitions status from `'PENDING'` to `'PROCESSING'`; extracts text and runs skill matching; updates status to `'COMPLETED'` (or `'FAILED'`).
- **Success (200 OK)**: Returns extracted text summary and identified skills.
- **Errors**: `400 RESUME_ALREADY_COMPLETED`, `404 RESOURCE_NOT_FOUND`, `409 RESUME_ALREADY_PROCESSING`, `422 MAX_PROCESSING_ATTEMPTS_EXCEEDED` (if attempts $\ge 3$).

### 5.5 Poll Processing Status: `GET /api/resumes/:resumeId/status`
- **Auth**: `Authorization: Bearer <token>`
- **Path Param**: `resumeId` (UUIDv4).
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "resumeId": "7b5247b4-3a9a-4c28-9842-83b6cb65f142",
      "extractionStatus": "COMPLETED",
      "processingAttempts": 1,
      "processingStartedAt": "2026-09-29T16:12:00.000Z",
      "processingCompletedAt": "2026-09-29T16:12:02.000Z",
      "hasExtractedText": true,
      "canRetry": false
    },
    "message": "Resume processing status retrieved successfully"
  }
  ```

### 5.6 Delete Resume: `DELETE /api/resumes/:resumeId`
- **Auth**: `Authorization: Bearer <token>`
- **Path Param**: `resumeId` (UUIDv4).
- **Behavior**: Deletes database record; cascades to `resume_skills`; sets `analyses.resume_id` to `NULL` (`ON DELETE SET NULL`); unlinks stored binary from file vault.
- **Success (200 OK)**: `{ "success": true, "data": {}, "message": "Resume deleted successfully" }`.

---

## 6. Job Description Endpoints (`/api/jobs`)

### 6.1 Create Job Posting: `POST /api/jobs`
- **Auth**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "title": "Backend Engineer",
    "company": "Acme Corp",
    "description": "Requirements: Node.js, PostgreSQL. Preferred: Docker, AWS."
  }
  ```
- **Validation**: `title` 2–255 chars; `description` 20–50,000 chars.
- **Success (201 Created)**: Stores job and extracted `requiredSkills` / `preferredSkills`.

### 6.2 List Job Postings: `GET /api/jobs`
- **Auth**: `Authorization: Bearer <token>`
- **Query**: `page` (default 1), `limit` (default 10).
- **Success (200 OK)**: Paginated array of user-owned job postings.

### 6.3 Get Job Posting: `GET /api/jobs/:jobId`
- **Auth**: `Authorization: Bearer <token>`
- **Path Param**: `jobId` (UUIDv4).
- **Success (200 OK)**: Details of target job description and `extracted_data`.

### 6.4 Update Job Posting: `PUT /api/jobs/:jobId`
- **Auth**: `Authorization: Bearer <token>`
- **Path Param**: `jobId` (UUIDv4).
- **Request Body**: Same schema as `POST /api/jobs`. Re-runs skill extraction on updated text.
- **Success (200 OK)**: Updated job record and updated `extracted_data`.

### 6.5 Delete Job Posting: `DELETE /api/jobs/:jobId`
- **Auth**: `Authorization: Bearer <token>`
- **Path Param**: `jobId` (UUIDv4).
- **Behavior**: Deletes job record; sets `analyses.job_id` to `NULL` (`ON DELETE SET NULL`).
- **Success (200 OK)**: `{ "success": true, "data": {}, "message": "Job description deleted successfully" }`.

### 6.6 Re-extract Job Skills: `POST /api/jobs/:jobId/extract`
- **Auth**: `Authorization: Bearer <token>`
- **Path Param**: `jobId` (UUIDv4).
- **Behavior**: Re-runs deterministic skill extractor on existing job text and updates `extracted_data`.
- **Success (200 OK)**: `{ "success": true, "data": { "extracted_data": { ... } }, "message": "Job skills extracted successfully" }`.

---

## 7. Matching, Analysis & Recommendation Endpoints (`/api/analyses`)

### 7.1 Execute Compatibility Matching: `POST /api/analyses`
- **Auth**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "resumeId": "7b5247b4-3a9a-4c28-9842-83b6cb65f142",
    "jobId": "e2808c7a-1fc1-4bb2-a6b6-32422e6cf843"
  }
  ```
- **Validation**: Both UUIDs must belong to authenticated user; resume must have `extraction_status = 'COMPLETED'`; job must have valid `extracted_data`.
- **Scoring**: Computes composite formula: $(0.70 \times S_{\text{req}} + 0.20 \times S_{\text{pref}} + 0.10 \times S_{\text{conf}}) \times 100$.
- **Database Action**: Atomic transaction writing parent to `analyses` and itemized matches to `analysis_skills`.
- **Success (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "analysis_id": "f51270b2-7bb5-4a18-97ce-87116744c803",
      "resume_file_name": "candidate_resume.pdf",
      "job_title": "Backend Engineer",
      "overall_score": 83.50,
      "skill_score": 83.50,
      "quality_score": 0.00,
      "matched_skills": [...],
      "missing_skills": [...]
    },
    "message": "Resume and job description matched successfully"
  }
  ```
- **Errors**: `404 RESOURCE_NOT_FOUND`, `409 RESUME_NOT_PROCESSED`, `422 JOB_EXTRACTION_UNAVAILABLE`.

### 7.2 List Historical Analyses: `GET /api/analyses`
- **Auth**: `Authorization: Bearer <token>`
- **Query**: `page` (default 1), `limit` (default 10).
- **Success (200 OK)**: Paginated history of candidate analyses.

### 7.3 Get Analysis Details: `GET /api/analyses/:analysisId`
- **Auth**: `Authorization: Bearer <token>`
- **Path Param**: `analysisId` (UUIDv4).
- **Success (200 OK)**: Full analysis report with matched/missing skill breakdowns and snapshot metadata.

### 7.4 Get Recommendations & Quality Diagnostics: `GET /api/analyses/:analysisId/recommendations`
- **Auth**: `Authorization: Bearer <token>`
- **Path Param**: `analysisId` (UUIDv4).
- **Behavior**: Evaluates 12 deterministic quality rules against resume text; evaluates skill gaps from `analysis_skills`; synthesizes prioritized suggestions (`HIGH`, `MEDIUM`, `LOW`) across `SKILL_GAP`, `RESUME_QUALITY`, `IMPACT_METRICS`, and `FORMATTING`.
- **Database Action**: **Read-only; zero database writes**.
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "analysisId": "f51270b2-7bb5-4a18-97ce-87116744c803",
      "compatibilityScore": 83.50,
      "qualityScore": 85.00,
      "qualityBreakdown": {
        "baseScore": 100.00,
        "deductions": [...]
      },
      "recommendations": [...]
    },
    "message": "Recommendations generated successfully"
  }
  ```

### 7.5 Delete Analysis: `DELETE /api/analyses/:analysisId`
- **Auth**: `Authorization: Bearer <token>`
- **Path Param**: `analysisId` (UUIDv4).
- **Behavior**: Deletes analysis row from `analyses`; cascades automatically to child rows in `analysis_skills`.
- **Success (200 OK)**: `{ "success": true, "data": {}, "message": "Analysis deleted successfully" }`.
- **Errors**: `404 RESOURCE_NOT_FOUND` (if unowned or non-existent).
