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

## 3. Upcoming Service Endpoints

### 3.1 Resumes (`/api/resumes`)
- `POST /api/resumes`: Multipart file upload (PDF/DOCX).
- `GET /api/resumes`: List candidate resumes.
- `GET /api/resumes/:resumeId`: Resume details.
- `DELETE /api/resumes/:resumeId`: Delete resume.

### 3.2 Jobs (`/api/jobs`)
- `POST /api/jobs`: Create target job description.
- `GET /api/jobs`: List user jobs.

### 3.3 Analyses (`/api/analyses`)
- `POST /api/analyses`: Run resume-to-job matching.
- `GET /api/analyses/:analysisId`: Get detailed analysis report.
- `GET /api/analyses`: View analysis history.
