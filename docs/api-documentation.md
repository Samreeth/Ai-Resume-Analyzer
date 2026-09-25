# API Specification

## 1. Response Standard

All backend endpoints adhere to a standardized JSON response format.

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description of what went wrong"
  }
}
```

---

## 2. Authentication Endpoints (`/api/auth`)

All authentication endpoints are fully implemented in native ES Modules (`.mjs`).

### 2.1 Register User
```http
POST /api/auth/register
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "StrongPassword123"
}
```

**Validation Rules:**
- `name`: string, trimmed, min 2, max 100 characters.
- `email`: valid email format, max 255 characters, case-insensitive uniqueness.
- `password`: string, min 8, max 128 characters. Hashed with bcrypt (10 rounds).

**Success Response (HTTP 201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2026-09-20T12:00:00.000Z"
    }
  },
  "message": "User registered successfully"
}
```

**Error Responses:**
- `400 VALIDATION_ERROR`: Missing/invalid fields or duplicate email (`"Email is already registered"`).

---

### 2.2 Login User
```http
POST /api/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "StrongPassword123"
}
```

**Success Response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "message": "Login successful"
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Invalid email or password.

---

### 2.3 Get Current User Profile
```http
GET /api/auth/me
Authorization: Bearer <JWT_TOKEN>
```

**Headers:**
- `Authorization`: `Bearer <token>` (Required)

**Success Response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2026-09-20T12:00:00.000Z",
      "updated_at": "2026-09-20T12:00:00.000Z"
    }
  },
  "message": "User profile retrieved successfully"
}
```

**Error Responses:**
- `401 AUTHENTICATION_ERROR`: Missing token (`"Authentication token is required"`) or invalid/expired token.

---

### 2.4 Logout
```http
POST /api/auth/logout
```

**Semantics & Client Responsibility:**
The system uses stateless JWT authentication without server-side session tracking or token revocation. Calling `POST /api/auth/logout` serves as a standard acknowledgment. The client application **must remove and discard its locally stored token** (e.g., from `localStorage`, session storage, or memory) to complete the logout process. The backend does not invalidate an already-issued, unexpired JWT on the server.

**Success Response (HTTP 200):**
```json
{
  "success": true,
  "data": {},
  "message": "Logged out successfully"
}
```

---

## 3. Resume Management Endpoints (`/api/resumes`)

All resume endpoints require authentication (`Authorization: Bearer <JWT_TOKEN>`) and strictly isolate operations to `req.user.userId`.

### 3.1 Upload Resume
```http
POST /api/resumes
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
```

**Form Data:**
- `resume`: Binary file stream (PDF or DOCX). Maximum 1 file, maximum 5 MB (5,242,880 bytes). Non-empty.

**Validation & Security Rules:**
- **Whitelisted Formats**: `.pdf` (`application/pdf`) and `.docx` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
- **Magic Bytes Validation**:
  - PDF: Must begin with `%PDF-` header.
  - DOCX: Must begin with ZIP signature `PK\x03\x04`.
- **Metadata-Only DOCX Archive Inspection**:
  - Buffer-based inspection via `yauzl` without disk extraction.
  - Required root entry: `[Content_Types].xml`.
  - Required main document entry: exactly `word/document.xml` (rejects substitutes like `word/document2.xml`).
  - Limits: maximum 1,000 entries, maximum 255-character entry names.
  - Strictly rejects path traversal (`..`), absolute paths (`/` or `C:\`), and backslashes (`\`).
  - Gracefully handles truncated, corrupted, and bomb ZIP payloads.
- **In-Memory Buffering**: Memory-based staging (`multer.memoryStorage()`); rejected files are discarded before touching the filesystem.
- **Staged File Persistence**: Writes buffer to `.tmp_<uuid>.tmp` within `uploads/resumes/` and renames to `<uuid>.<ext>`. Cleaned up on database insertion rollback.
- **Initial Processing State**: New uploads are initially marked with `status: "PENDING"`.

**Success Response (HTTP 201 Created):**
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
      "uploaded_at": "2026-09-24T10:30:00.000Z"
    }
  },
  "message": "Resume uploaded successfully"
}
```

**Error Responses:**
- `400 VALIDATION_ERROR`: Missing `resume` form field, zero-byte empty file, or multiple files attached.
- `401 AUTHENTICATION_ERROR`: Missing, expired, or invalid Bearer token.
- `413 FILE_TOO_LARGE`: Uploaded file exceeds 5 MB limit.
- `415 UNSUPPORTED_MEDIA_TYPE`: Invalid extension, mismatched MIME type, corrupted archive, or failed DOCX validation.

---

### 3.2 List Resumes
```http
GET /api/resumes?page=1&limit=10
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `page`: Integer $\ge 1$ (default: `1`).
- `limit`: Integer between `1` and `100` (default: `10`).

**Success Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": {
    "resumes": [
      {
        "resume_id": "7b5247b4-3a9a-4c28-9842-83b6cb65f142",
        "file_name": "candidate_resume.pdf",
        "file_size": 245760,
        "mime_type": "application/pdf",
        "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "status": "PENDING",
        "uploaded_at": "2026-09-24T10:30:00.000Z",
        "updated_at": "2026-09-24T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "total_pages": 1
    }
  },
  "message": "Resumes retrieved successfully"
}
```

**Error Responses:**
- `400 VALIDATION_ERROR`: Invalid query parameter format (e.g., negative page, non-integer limit).
- `401 AUTHENTICATION_ERROR`: Missing or invalid Bearer token.

---

### 3.3 Get Resume Details
```http
GET /api/resumes/:resumeId
Authorization: Bearer <JWT_TOKEN>
```

**Path Parameters:**
- `resumeId`: Valid UUIDv4 string.

**Success Response (HTTP 200 OK):**
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
      "raw_text": null,
      "parsed_data": null,
      "uploaded_at": "2026-09-24T10:30:00.000Z",
      "updated_at": "2026-09-24T10:30:00.000Z"
    }
  },
  "message": "Resume details retrieved successfully"
}
```

**Error Responses:**
- `400 VALIDATION_ERROR`: Invalid UUIDv4 format for `:resumeId`.
- `401 AUTHENTICATION_ERROR`: Missing or invalid Bearer token.
- `404 RESOURCE_NOT_FOUND`: Resume does not exist or belongs to another user (IDOR protection).

---

### 3.4 Delete Resume
```http
DELETE /api/resumes/:resumeId
Authorization: Bearer <JWT_TOKEN>
```

**Path Parameters:**
- `resumeId`: Valid UUIDv4 string.

**Behavior & Guarantees:**
- Strict multi-tenant ownership check (`WHERE resume_id = $1 AND user_id = $2`).
- Relational cascades: `resume_skills` records automatically cascade delete.
- Foreign key preservation: Existing `analyses` records have `resume_id` set to `NULL` (`ON DELETE SET NULL`), preserving historical scores and reports.
- Filesystem cleanup: Physical file within `uploads/resumes/` is unlinked.
- In the rare event of an OS filesystem unlink error after database commit, a structured `CRITICAL` error is logged for reconciliation, and the API returns 200 OK because the resource ownership and database row are cleanly severed.

**Success Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": {},
  "message": "Resume deleted successfully"
}
```

**Error Responses:**
- `400 VALIDATION_ERROR`: Invalid UUIDv4 format for `:resumeId`.
- `401 AUTHENTICATION_ERROR`: Missing or invalid Bearer token.
- `404 RESOURCE_NOT_FOUND`: Resume does not exist or belongs to another user (IDOR protection).

---

## 4. Upcoming Service Endpoints

### 4.1 Jobs (`/api/jobs`)
- `POST /api/jobs`: Create target job description.
- `GET /api/jobs`: List user jobs.

### 4.2 Analyses (`/api/analyses`)
- `POST /api/analyses`: Run resume-to-job matching.
- `GET /api/analyses/:analysisId`: Get detailed analysis report.
- `GET /api/analyses`: View analysis history.
