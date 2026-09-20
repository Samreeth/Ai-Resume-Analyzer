# Testing Strategy & Test Plan

## 1. Testing Methodology

The testing strategy spans five core categories to guarantee reliability, data privacy, and graceful degradation:

1. **Unit Testing:** Testing isolated algorithms (text normalization, skill alias mapping, score calculations).
2. **API Testing:** Validating status codes, schemas, authentication guards, and validation handlers.
3. **Integration Testing:** End-to-end data pipeline between Node.js, Python NLP service, and PostgreSQL.
4. **UI Testing:** Validating form validations, upload feedback, score rendering, and routing.
5. **Negative & Security Testing:** Verifying boundary limits, corrupted files, and forbidden data access.

---

## 2. Planned Test Suites

### Unit Tests
- `server`: Validation schemas (`zod`), JWT token generation/verification, password hashing logic.
- `nlp-service`: PDF extraction, DOCX extraction, regex parsers, compatibility scoring equation.

### Negative Test Matrix
| Scenario | Expected Outcome |
|---|---|
| Upload .exe / unsupported file | Rejection with `FILE_TYPE_NOT_ALLOWED` (HTTP 400) |
| Upload corrupted PDF | Controlled response with `FILE_PROCESSING_ERROR` |
| Upload file > 5 MB | Immediate rejection with `FILE_TOO_LARGE` |
| Access analysis with other user's ID | `AUTHORIZATION_ERROR` (HTTP 403 or 404) |
| Python service down during analysis | Controlled `NLP_SERVICE_ERROR` (HTTP 503) |
| Missing or malformed JWT | `AUTHENTICATION_ERROR` (HTTP 401) |

---

## 3. Test Execution Status

| Test Suite | Target Framework | Current Status |
|---|---|---|
| Backend Unit/API | Jest + Supertest | Pending Phase 3/4 |
| NLP Service | Pytest | Pending Phase 5/6 |
| Frontend UI | React Testing Library | Pending Phase 7 |
