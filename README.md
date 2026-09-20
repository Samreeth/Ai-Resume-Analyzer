# AI-Powered Resume Analyzer and Job Matching System

## 1. Project Overview

The **AI-Powered Resume Analyzer and Job Matching System** is a full-stack web application that analyzes a candidate's resume and compares it with a selected job description.

The system uses:

- React.js for the frontend
- Node.js and Express.js for the backend API
- Python for resume parsing and NLP processing
- PostgreSQL for persistent data storage
- NLP and semantic similarity techniques for skill extraction and matching

The application helps users understand how closely their resume matches a job description. It extracts relevant information, identifies matching and missing skills, calculates compatibility scores, analyzes resume quality, and generates improvement recommendations.

> The system is an analysis and decision-support tool. It must not claim to predict whether a candidate will be hired or make actual recruitment decisions.

---

## 2. Problem Statement

Candidates often apply for multiple jobs without knowing how well their resume matches a specific job description.

Manually comparing a resume with job requirements can be:

- Time-consuming
- Inconsistent
- Difficult for beginners
- Prone to missing important keywords and requirements

Recruiters may also need to compare a large number of resumes against similar job requirements.

This project addresses the problem by automatically:

1. Extracting important information from resumes
2. Analyzing job descriptions
3. Identifying relevant skills and qualifications
4. Comparing resume content with job requirements
5. Calculating an estimated compatibility score
6. Identifying missing or partially matching skills
7. Providing actionable recommendations

---

## 3. Project Objectives

### Primary Objectives

- Build a web-based resume analysis platform.
- Support resume uploads in PDF and DOCX formats.
- Extract structured information from resumes.
- Analyze job descriptions using NLP techniques.
- Identify technical and non-technical skills.
- Compare resume skills with job requirements.
- Calculate an estimated compatibility score.
- Identify missing and partially matching skills.
- Analyze general resume quality.
- Generate personalized improvement suggestions.
- Store analysis history in PostgreSQL.
- Provide a user-friendly dashboard.
- Implement unit, integration, API, UI, and negative testing.

---

## 4. Core Features

### 4.1 User Authentication

Users should be able to:

- Register an account
- Log in
- Log out
- Access protected routes
- View basic profile information
- View their previous analyses

Recommended implementation:

- Password hashing using bcrypt
- JWT-based authentication
- Authentication middleware in Express
- Input validation for registration and login
- Never store plain-text passwords

---

### 4.2 Resume Upload

Users can upload resumes in:

- PDF format
- DOCX format

The upload module must:

- Validate file type
- Validate file size
- Reject unsupported formats
- Reject empty files
- Handle corrupted files
- Generate a unique stored filename
- Associate the resume with the logged-in user
- Extract text using the Python service
- Store resume metadata in PostgreSQL

Recommended initial upload limit:

```text
Maximum file size: 5 MB
Allowed formats: PDF and DOCX
```

The limit can be changed through configuration.

---

### 4.3 Resume Information Extraction

The system should attempt to extract:

- Name
- Email address
- Phone number
- Education
- Technical skills
- Soft skills
- Work experience
- Projects
- Certifications
- Relevant keywords

The extracted data should be represented in structured JSON.

Example:

```json
{
  "personal_info": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+91XXXXXXXXXX"
  },
  "education": [
    {
      "degree": "B.Tech Computer Science",
      "institution": "Example University",
      "year": "2028"
    }
  ],
  "skills": {
    "programming_languages": ["Python", "JavaScript"],
    "frameworks": ["React", "Express"],
    "databases": ["PostgreSQL"],
    "tools": ["Git"],
    "soft_skills": ["Communication"]
  },
  "experience": [],
  "projects": [],
  "certifications": []
}
```

> Extraction is not guaranteed to be perfect. The application should preserve uncertainty and avoid presenting incorrectly extracted information as verified facts.

---

### 4.4 Job Description Analysis

The user provides a job title and job description.

The system analyzes the description and extracts:

- Required technical skills
- Preferred skills
- Educational qualifications
- Experience requirements
- Important keywords
- Job responsibilities
- Tools and technologies

Example:

```json
{
  "job_title": "Backend Developer",
  "required_skills": [
    "Node.js",
    "Express.js",
    "SQL",
    "REST APIs"
  ],
  "preferred_skills": [
    "Docker",
    "AWS",
    "Redis"
  ],
  "education": [
    "Computer Science or related degree"
  ],
  "experience": {
    "minimum_years": 0
  },
  "responsibilities": [
    "Build REST APIs",
    "Work with databases"
  ]
}
```

The parser should distinguish between required and preferred skills whenever the job description provides enough evidence.

---

### 4.5 Resume-Job Matching

The matching engine compares the extracted resume information with the job requirements.

The system should identify:

- Matching skills
- Missing skills
- Partially matching skills
- Relevant experience
- Project relevance
- Education match
- Important keyword coverage

Example:

| Job Requirement | Resume | Result |
|---|---|---|
| React | React | MATCHED |
| Node.js | Node.js | MATCHED |
| Python | Python | MATCHED |
| SQL | SQL | MATCHED |
| Docker | Not found | MISSING |
| AWS | Not found | MISSING |

Matching should not depend only on exact keywords.

For example:

```text
Resume:
Developed RESTful APIs using Express.

Job description:
Experience building backend APIs with Node.js.
```

The system should be able to identify related concepts where the selected NLP method supports that relationship.

---

### 4.6 Compatibility Score

The project document proposes the following initial scoring model:

| Category | Weight |
|---|---:|
| Skill Match | 50% |
| Experience Match | 20% |
| Project Relevance | 15% |
| Education Match | 10% |
| Resume Quality | 5% |
| Total | 100% |

Formula:

```text
Overall Score =
    (Skill Match × 0.50)
  + (Experience Match × 0.20)
  + (Project Relevance × 0.15)
  + (Education Match × 0.10)
  + (Resume Quality × 0.05)
```

Each component should be represented on a 0–100 scale.

Example:

```text
Skill Match       = 85
Experience Match  = 70
Project Relevance = 80
Education Match   = 100
Resume Quality    = 90

Overall Score =
    (85 × 0.50)
  + (70 × 0.20)
  + (80 × 0.15)
  + (100 × 0.10)
  + (90 × 0.05)

Overall Score = 83.5
```

Display the score as an estimate, not as a hiring probability.

### Score Calculation Rules

- Missing required skills should reduce the skill score.
- Preferred skills may contribute separately from required skills.
- Unknown information should not automatically be treated as a failure.
- Scores should be reproducible for the same input and model version.
- Store the scoring methodology and version used for each analysis.
- Avoid using protected or sensitive personal characteristics in scoring.
- Do not use the score to automatically reject or rank people for employment.

The scoring algorithm can be refined after testing with sample resumes and job descriptions.

---

### 4.7 Resume Quality Analysis

The system should evaluate general resume quality indicators such as:

- Missing sections
- Skill coverage
- Resume structure
- Excessive length
- Important keywords
- Project descriptions
- Experience descriptions
- Contact information
- Basic formatting indicators

Example output:

```json
{
  "quality_score": 82,
  "strengths": [
    "Technical skills are clearly listed",
    "Projects are included",
    "Education information is available"
  ],
  "improvements": [
    "Add measurable results to project descriptions",
    "Include relevant certifications if applicable",
    "Improve keyword coverage for the selected job"
  ]
}
```

The quality score should be explainable. Each score deduction should be associated with a specific detected issue where possible.

---

### 4.8 Skill Gap Analysis

The system identifies the difference between the candidate's skills and the job requirements.

Example:

```text
Required Skills:
- React       MATCHED
- Node.js     MATCHED
- Python      MATCHED
- SQL         MATCHED
- Docker      MISSING
- AWS         MISSING
- Redis       MISSING
```

The result should contain:

```json
{
  "matched_skills": ["React", "Node.js", "Python", "SQL"],
  "missing_skills": ["Docker", "AWS", "Redis"],
  "partial_skills": [],
  "skill_match_percentage": 57
}
```

The application should distinguish between:

- A skill not found in the resume
- A skill found with weak or indirect evidence
- A skill clearly demonstrated in the resume

Not finding a skill does not prove that the candidate does not possess it.

---

### 4.9 Recommendation Engine

The recommendation engine generates suggestions based on:

- Missing skills
- Resume quality issues
- Job requirements
- Project relevance
- Weak descriptions
- Keyword coverage

Example recommendations:

1. Consider adding Docker experience if you genuinely have it.
2. Highlight REST API projects more clearly.
3. Add measurable results to project descriptions.
4. Include relevant cloud experience if applicable.
5. Explain how your projects used the technologies mentioned.

Recommendations must be phrased as suggestions and must not claim that a user will be hired.

---

### 4.10 Dashboard

The dashboard should display:

- Overall compatibility score
- Skill match percentage
- Experience match
- Project relevance
- Education match
- Resume quality score
- Matching skills
- Missing skills
- Partially matching skills
- Recommendations
- Previous analysis history

Suggested dashboard sections:

```text
Dashboard
├── Summary Cards
├── Compatibility Score
├── Skill Match Breakdown
├── Matching Skills
├── Missing Skills
├── Resume Quality
├── Recommendations
└── Previous Analyses
```

---

## 5. Technology Stack

### Frontend

- React.js
- React Router
- Axios or Fetch API
- CSS, Tailwind CSS, or another consistent styling solution
- Charting library if needed for score visualization
- React Testing Library

Responsibilities:

- User interface
- Authentication screens
- Resume upload
- Job description input
- Loading and error states
- Dashboard
- Results visualization
- Analysis history

### Backend

- Node.js
- Express.js
- JWT authentication
- bcrypt
- File upload middleware
- PostgreSQL database driver or ORM
- Input validation library
- Jest
- Supertest

Responsibilities:

- REST APIs
- Authentication
- File handling
- Request validation
- Business logic
- Database interaction
- Communication with the Python service
- Authorization

### AI/NLP Service

- Python
- PyPDF or an equivalent PDF extraction library
- python-docx
- spaCy
- NLTK if required
- scikit-learn
- sentence-transformers if semantic matching is implemented

Responsibilities:

- PDF and DOCX text extraction
- Text cleaning
- Section identification
- Skill extraction
- Job description analysis
- Semantic similarity
- Structured analysis output

### Database

- PostgreSQL

Stores:

- Users
- Resume metadata
- Extracted resume information
- Job descriptions
- Skills
- Resume skills
- Analysis results
- Analysis skill statuses
- Analysis history

### Testing

- Jest
- Supertest
- React Testing Library
- Pytest

---

## 6. Recommended Architecture

```text
                   ┌─────────────────────────┐
                   │      React Frontend     │
                   │                         │
                   │ Login/Register          │
                   │ Resume Upload           │
                   │ Job Description Input   │
                   │ Analysis Dashboard      │
                   └────────────┬────────────┘
                                │ HTTP/JSON
                                ▼
                   ┌─────────────────────────┐
                   │   Node.js + Express     │
                   │       Backend API       │
                   │                         │
                   │ Auth and Authorization  │
                   │ File Upload             │
                   │ Validation              │
                   │ Business Logic          │
                   │ Database Access         │
                   └──────┬───────────┬──────┘
                          │           │
                          │           ▼
                          │  ┌──────────────────┐
                          │  │   PostgreSQL     │
                          │  │                  │
                          │  │ Users            │
                          │  │ Resumes          │
                          │  │ Jobs             │
                          │  │ Analyses         │
                          │  └──────────────────┘
                          │
                          ▼
                 ┌─────────────────────────┐
                 │     Python NLP Service  │
                 │                         │
                 │ PDF/DOCX Extraction     │
                 │ Text Processing         │
                 │ Skill Extraction        │
                 │ Job Analysis            │
                 │ Matching                │
                 │ Quality Analysis        │
                 └─────────────────────────┘
```

### Service Responsibilities

#### React

The frontend must not contain secret keys or database credentials.

#### Node.js

Node.js acts as the primary API gateway and coordinates authentication, file upload, database operations, and calls to the Python service.

#### Python

Python handles document processing and NLP-specific operations.

#### PostgreSQL

PostgreSQL stores persistent application data and analysis history.

---

## 7. Suggested Project Structure

```text
ai-resume-analyzer/
│
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
│
├── client/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   ├── apiClient.js
│       │   ├── authApi.js
│       │   ├── resumeApi.js
│       │   └── analysisApi.js
│       │
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── ProtectedRoute.jsx
│       │   ├── FileUploader.jsx
│       │   ├── ScoreCard.jsx
│       │   ├── SkillList.jsx
│       │   └── LoadingState.jsx
│       │
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Dashboard.jsx
│       │   ├── UploadResume.jsx
│       │   ├── JobDescription.jsx
│       │   ├── AnalysisResult.jsx
│       │   └── AnalysisHistory.jsx
│       │
│       ├── context/
│       │   └── AuthContext.jsx
│       │
│       ├── hooks/
│       │   └── useAuth.js
│       │
│       └── styles/
│           └── global.css
│
├── server/
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── app.js
│       │
│       ├── config/
│       │   ├── env.js
│       │   └── database.js
│       │
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── resume.routes.js
│       │   ├── job.routes.js
│       │   └── analysis.routes.js
│       │
│       ├── controllers/
│       │   ├── auth.controller.js
│       │   ├── resume.controller.js
│       │   ├── job.controller.js
│       │   └── analysis.controller.js
│       │
│       ├── services/
│       │   ├── auth.service.js
│       │   ├── resume.service.js
│       │   ├── job.service.js
│       │   ├── analysis.service.js
│       │   └── nlp.service.js
│       │
│       ├── middleware/
│       │   ├── auth.middleware.js
│       │   ├── error.middleware.js
│       │   ├── upload.middleware.js
│       │   └── validation.middleware.js
│       │
│       ├── validators/
│       │   ├── auth.validator.js
│       │   ├── job.validator.js
│       │   └── analysis.validator.js
│       │
│       └── utils/
│           ├── logger.js
│           └── response.js
│
├── nlp-service/
│   ├── requirements.txt
│   ├── app.py
│   ├── config.py
│   │
│   ├── routes/
│   │   ├── resume_routes.py
│   │   └── analysis_routes.py
│   │
│   ├── services/
│   │   ├── pdf_extractor.py
│   │   ├── docx_extractor.py
│   │   ├── text_cleaner.py
│   │   ├── resume_parser.py
│   │   ├── job_parser.py
│   │   ├── skill_extractor.py
│   │   ├── matching_engine.py
│   │   ├── quality_analyzer.py
│   │   └── recommendation_engine.py
│   │
│   ├── models/
│   │   └── schemas.py
│   │
│   └── tests/
│       ├── test_extractors.py
│       ├── test_matching.py
│       └── test_quality.py
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schema.sql
│
├── uploads/
│   └── .gitkeep
│
└── docs/
    ├── architecture.md
    ├── api-documentation.md
    ├── database-design.md
    └── testing-report.md
```

This structure is a recommended starting point. It can be simplified during the first implementation phase if necessary.

---

## 8. Database Design

### 8.1 Users

| Column | Type | Description |
|---|---|---|
| user_id | UUID / SERIAL | Primary key |
| name | VARCHAR | User name |
| email | VARCHAR | Unique email |
| password_hash | TEXT | Hashed password |
| created_at | TIMESTAMP | Creation timestamp |

### 8.2 Resumes

| Column | Type | Description |
|---|---|---|
| resume_id | UUID / SERIAL | Primary key |
| user_id | FK | Owner |
| file_name | VARCHAR | Original filename |
| file_path | TEXT | Stored file path |
| uploaded_at | TIMESTAMP | Upload time |
| extracted_data | JSONB | Structured extraction |
| extraction_status | VARCHAR | Processing status |

### 8.3 Job Descriptions

| Column | Type | Description |
|---|---|---|
| job_id | UUID / SERIAL | Primary key |
| user_id | FK | Owner |
| title | VARCHAR | Job title |
| description | TEXT | Original description |
| extracted_data | JSONB | Structured analysis |
| created_at | TIMESTAMP | Creation time |

### 8.4 Skills

| Column | Type | Description |
|---|---|---|
| skill_id | UUID / SERIAL | Primary key |
| skill_name | VARCHAR | Normalized skill name |
| category | VARCHAR | Skill category |

Possible categories:

- Programming language
- Framework
- Database
- Cloud
- DevOps
- Tool
- Soft skill
- Other

### 8.5 Resume Skills

| Column | Type | Description |
|---|---|---|
| resume_id | FK | Resume |
| skill_id | FK | Skill |
| confidence | DECIMAL | Extraction confidence |

### 8.6 Analysis

| Column | Type | Description |
|---|---|---|
| analysis_id | UUID / SERIAL | Primary key |
| resume_id | FK | Resume |
| job_id | FK | Job description |
| overall_score | DECIMAL | Overall estimated score |
| skill_score | DECIMAL | Skill match score |
| experience_score | DECIMAL | Experience score |
| project_score | DECIMAL | Project relevance score |
| education_score | DECIMAL | Education score |
| quality_score | DECIMAL | Resume quality score |
| scoring_version | VARCHAR | Scoring version |
| created_at | TIMESTAMP | Analysis time |

### 8.7 Analysis Skills

| Column | Type | Description |
|---|---|---|
| analysis_id | FK | Analysis |
| skill_id | FK | Skill |
| status | VARCHAR | MATCHED, MISSING, PARTIAL |
| evidence | TEXT | Supporting resume evidence |
| similarity_score | DECIMAL | Optional similarity score |

The original project document specifies the statuses `MATCHED`, `MISSING`, and `PARTIAL`.

---

## 9. API Design

All API routes should use a consistent response structure.

Example success response:

```json
{
  "success": true,
  "data": {},
  "message": "Request completed successfully"
}
```

Example error response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input"
  }
}
```

### 9.1 Authentication APIs

#### Register

```http
POST /api/auth/register
```

Request:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "StrongPassword123"
}
```

Response:

```json
{
  "success": true,
  "message": "User registered successfully"
}
```

#### Login

```http
POST /api/auth/login
```

Request:

```json
{
  "email": "john@example.com",
  "password": "StrongPassword123"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "token": "JWT_TOKEN",
    "user": {
      "user_id": "user-id",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

#### Get Current User

```http
GET /api/auth/me
```

Requires authentication.

#### Logout

```http
POST /api/auth/logout
```

The implementation can use token expiration and client-side token removal. If refresh tokens are introduced, implement secure revocation.

---

### 9.2 Resume APIs

#### Upload Resume

```http
POST /api/resumes
```

Content type:

```text
multipart/form-data
```

Fields:

```text
resume: uploaded PDF or DOCX file
```

#### List Resumes

```http
GET /api/resumes
```

Returns resumes belonging to the authenticated user.

#### Get Resume

```http
GET /api/resumes/:resumeId
```

The user must own the requested resume.

#### Delete Resume

```http
DELETE /api/resumes/:resumeId
```

The user must own the requested resume.

---

### 9.3 Job Description APIs

#### Create Job Description

```http
POST /api/jobs
```

Request:

```json
{
  "title": "Backend Developer",
  "description": "We are looking for a developer with Node.js, Express, SQL and REST API experience."
}
```

#### List Job Descriptions

```http
GET /api/jobs
```

#### Get Job Description

```http
GET /api/jobs/:jobId
```

#### Delete Job Description

```http
DELETE /api/jobs/:jobId
```

---

### 9.4 Analysis APIs

#### Start Analysis

```http
POST /api/analyses
```

Request:

```json
{
  "resume_id": "resume-id",
  "job_id": "job-id"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "analysis_id": "analysis-id",
    "status": "COMPLETED"
  }
}
```

For a synchronous first version, the API can return the completed analysis. For larger files or more advanced processing, use asynchronous processing with a job status endpoint.

#### Get Analysis

```http
GET /api/analyses/:analysisId
```

#### List Analysis History

```http
GET /api/analyses
```

#### Delete Analysis

```http
DELETE /api/analyses/:analysisId
```

---

## 10. Python NLP Service API

The Node.js backend communicates with the Python service over an internal HTTP connection.

### Extract Resume

```http
POST /internal/resume/extract
```

Request:

```json
{
  "file_path": "/path/to/resume.pdf",
  "file_type": "pdf"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "raw_text": "Extracted resume text",
    "structured_data": {
      "personal_info": {},
      "education": [],
      "skills": {},
      "experience": [],
      "projects": [],
      "certifications": []
    }
  }
}
```

### Analyze Job Description

```http
POST /internal/job/analyze
```

Request:

```json
{
  "title": "Backend Developer",
  "description": "Job description text"
}
```

### Compare Resume and Job

```http
POST /internal/analysis/match
```

Request:

```json
{
  "resume_data": {},
  "job_data": {}
}
```

Response:

```json
{
  "success": true,
  "data": {
    "overall_score": 83.5,
    "skill_score": 85,
    "experience_score": 70,
    "project_score": 80,
    "education_score": 100,
    "quality_score": 90,
    "matched_skills": [],
    "missing_skills": [],
    "partial_skills": [],
    "recommendations": []
  }
}
```

### Internal Service Security

- Do not expose internal NLP endpoints publicly.
- Restrict access to the backend service.
- Validate all incoming data.
- Use an internal authentication token if services run separately.
- Avoid passing untrusted file paths without validation.
- Set request timeouts.
- Return controlled error messages.

---

## 11. NLP Implementation Plan

### Phase 1: Text Extraction

Implement:

1. PDF extraction
2. DOCX extraction
3. Text normalization
4. Whitespace cleanup
5. Basic section detection

Potential sections:

- Summary
- Skills
- Education
- Experience
- Projects
- Certifications

### Phase 2: Rule-Based Extraction

Start with deterministic methods before introducing advanced semantic models.

Examples:

- Email extraction using regular expressions
- Phone number extraction using validated patterns
- Section heading detection
- Skill dictionary matching
- Degree keyword detection
- Technology alias normalization

Example aliases:

```text
Node -> Node.js
Express -> Express.js
Postgres -> PostgreSQL
JS -> JavaScript
TS -> TypeScript
```

Aliases must be reviewed carefully to reduce false positives.

### Phase 3: NLP-Based Extraction

Add NLP techniques where useful:

- Tokenization
- Keyword extraction
- Entity recognition
- Skill identification
- Similarity analysis

Possible libraries:

- spaCy
- NLTK
- scikit-learn
- sentence-transformers

Do not add every library automatically. Begin with the simplest method that meets the requirements.

### Phase 4: Semantic Matching

Use semantic similarity for related wording when appropriate.

Example:

```text
Resume:
Built RESTful APIs using Express.

Job:
Experience developing backend APIs using Node.js.
```

The system can use embeddings to identify semantic relationships.

Semantic similarity should be combined with explicit skill rules. Embedding similarity alone can produce false matches.

### Phase 5: Recommendation Generation

Generate recommendations from structured findings rather than relying only on free-form model output.

Examples:

- Missing required skills
- Missing resume sections
- Weak project descriptions
- Lack of measurable outcomes
- Low keyword coverage

---

## 12. Matching Engine Design

### Skill Normalization

Normalize skills before comparison:

```text
Java Script -> JavaScript
Node -> Node.js
ReactJS -> React
Postgres -> PostgreSQL
```

Maintain a controlled alias map.

### Skill Matching Categories

Each requirement should be assigned one of:

- MATCHED
- PARTIAL
- MISSING
- UNKNOWN

The original project specification requires `MATCHED`, `MISSING`, and `PARTIAL`. `UNKNOWN` may be used internally when the evidence is insufficient, but the final display should explain its meaning clearly.

### Suggested Matching Logic

1. Normalize resume skills.
2. Normalize job skills.
3. Check exact matches.
4. Check known aliases.
5. Check evidence from project and experience descriptions.
6. Optionally calculate semantic similarity.
7. Assign a status.
8. Store evidence and score.
9. Calculate category-level scores.

Pseudo-logic:

```text
for each required skill:
    if exact or alias match:
        status = MATCHED
    else if related evidence is detected:
        status = PARTIAL
    else:
        status = MISSING
```

This logic must be tested against false positives and false negatives.

---

## 13. Frontend Pages

### 13.1 Login Page

Requirements:

- Email field
- Password field
- Login button
- Validation messages
- Link to registration
- Loading state
- API error display

### 13.2 Registration Page

Requirements:

- Name
- Email
- Password
- Confirm password
- Validation
- Registration error handling

### 13.3 Dashboard

Requirements:

- Summary of recent analyses
- Latest compatibility score
- Resume count
- Job description count
- Quick action buttons
- Analysis history

### 13.4 Resume Upload Page

Requirements:

- File selection
- Supported format display
- File size validation
- Upload progress or loading indicator
- Error handling
- Uploaded resume preview metadata

### 13.5 Job Description Page

Requirements:

- Job title
- Job description textarea
- Required field validation
- Save job description
- Select resume for analysis

### 13.6 Analysis Result Page

Requirements:

- Overall score
- Score breakdown
- Matching skills
- Missing skills
- Partial skills
- Resume quality
- Recommendations
- Explanation of limitations
- Option to return to history

### 13.7 Analysis History Page

Requirements:

- List previous analyses
- Resume name
- Job title
- Score
- Date
- View details
- Delete analysis if supported

---

## 14. Authentication and Security Requirements

### Password Security

- Hash passwords using bcrypt.
- Never log passwords.
- Never store plain-text passwords.
- Validate password length and format.

### Authorization

Every protected resource must verify ownership.

Example:

```text
A user must not be able to view another user's resume
by changing the resume ID in the URL.
```

### File Security

- Allow only PDF and DOCX.
- Validate MIME type and file extension.
- Apply a file size limit.
- Store files outside the public web root.
- Generate safe filenames.
- Avoid executing uploaded files.
- Handle malformed files safely.
- Consider malware scanning for production use.

### API Security

- Validate request bodies.
- Apply rate limiting where appropriate.
- Configure CORS explicitly.
- Use environment variables for secrets.
- Do not expose stack traces to clients.
- Add centralized error handling.
- Use HTTPS in deployment.

### Privacy

Resumes may contain personal information. The system should:

- Restrict access to the owner.
- Avoid exposing resume data in logs.
- Provide a deletion mechanism.
- Explain how uploaded data is used.
- Avoid sending resume data to external AI services without appropriate disclosure and consent.

---

## 15. Environment Variables

Create `.env.example` files for each service.

### Server `.env.example`

```env
NODE_ENV=development
PORT=5000

DATABASE_URL=postgresql://postgres:password@localhost:5432/resume_analyzer

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d

NLP_SERVICE_URL=http://localhost:8000
NLP_SERVICE_TOKEN=replace_with_internal_service_token

UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=5

CLIENT_URL=http://localhost:5173
```

### Python `.env.example`

```env
ENVIRONMENT=development
PORT=8000

INTERNAL_SERVICE_TOKEN=replace_with_internal_service_token

MAX_FILE_SIZE_MB=5
```

Do not commit actual `.env` files or secrets to Git.

---

## 16. Local Development Setup

### Prerequisites

Install:

- Node.js LTS
- npm
- Python 3.11+ or a compatible supported version
- PostgreSQL
- Git
- Cursor IDE

Verify installations:

```bash
node --version
npm --version
python --version
psql --version
git --version
```

### Step 1: Create the Project

```bash
mkdir ai-resume-analyzer
cd ai-resume-analyzer
git init
```

### Step 2: Create Frontend

```bash
npm create vite@latest client -- --template react
cd client
npm install
npm install react-router-dom axios
cd ..
```

### Step 3: Create Backend

```bash
mkdir server
cd server
npm init -y
npm install express cors dotenv bcrypt jsonwebtoken multer pg zod helmet
npm install -D nodemon jest supertest
cd ..
```

### Step 4: Create Python Service

```bash
mkdir nlp-service
cd nlp-service

python -m venv .venv
```

Activate the virtual environment.

Windows:

```bash
.venv\Scripts\activate
```

Linux/macOS:

```bash
source .venv/bin/activate
```

Install initial dependencies:

```bash
pip install fastapi uvicorn python-dotenv pypdf python-docx spacy scikit-learn pytest
```

Add additional packages only when they are required.

### Step 5: Configure PostgreSQL

Create a database:

```sql
CREATE DATABASE resume_analyzer;
```

Run the schema and migrations after they are created.

### Step 6: Configure Environment Variables

Copy the example environment files:

```text
.env.example -> .env
```

Update the values locally.

### Step 7: Run the Services

Frontend:

```bash
cd client
npm run dev
```

Backend:

```bash
cd server
npm run dev
```

Python service:

```bash
cd nlp-service
uvicorn app:app --reload --port 8000
```

The exact commands may be adjusted in the respective package files.

---

## 17. Development Phases

### Phase 1: Planning

Tasks:

- Finalize requirements
- Confirm architecture
- Define database tables
- Define API contracts
- Define scoring methodology
- Prepare sample resumes and job descriptions

Deliverables:

- Requirements document
- Architecture diagram
- Database ER diagram
- API specification

### Phase 2: Backend and Database

Tasks:

- Create PostgreSQL database
- Implement migrations
- Implement authentication
- Implement protected routes
- Implement file upload
- Implement resume and job APIs
- Implement validation
- Implement error handling

Deliverables:

- Working backend API
- Database schema
- Authentication tests
- API documentation

### Phase 3: AI/NLP

Tasks:

- Implement PDF extraction
- Implement DOCX extraction
- Implement text cleaning
- Implement section identification
- Implement skill extraction
- Implement job description analysis
- Implement matching algorithm
- Implement scoring
- Implement quality analysis
- Implement recommendations

Deliverables:

- Working Python service
- Structured extraction output
- Matching output
- NLP unit tests

### Phase 4: Frontend

Tasks:

- Implement registration and login
- Implement protected routing
- Implement resume upload
- Implement job description form
- Implement analysis trigger
- Implement dashboard
- Implement result visualization
- Implement history page

Deliverables:

- Working React interface
- Form validation
- Loading and error states
- Responsive layout

### Phase 5: Integration

Tasks:

- Connect React to Node.js
- Connect Node.js to PostgreSQL
- Connect Node.js to Python
- Test complete analysis flow
- Fix response and validation mismatches
- Handle service failures

Deliverables:

- End-to-end working application
- Integration test results

### Phase 6: Testing

Tasks:

- Unit testing
- API testing
- Integration testing
- UI testing
- File upload testing
- Negative testing
- Error handling testing

Deliverables:

- Test cases
- Test execution results
- Bug fixes
- Test report

### Phase 7: Documentation and Presentation

Tasks:

- Capture screenshots
- Prepare architecture diagrams
- Prepare database diagrams
- Document APIs
- Document test results
- Prepare final report
- Prepare presentation
- Prepare viva questions and answers

---

## 18. Testing Strategy

### 18.1 Unit Testing

Test individual functions:

- Text cleaning
- Email extraction
- Phone extraction
- Skill extraction
- Score calculation
- Resume section detection
- Recommendation generation

### 18.2 API Testing

Test:

- Registration API
- Login API
- Current user API
- Resume upload API
- Resume retrieval API
- Job description API
- Analysis API
- History API

### 18.3 Integration Testing

Test the full flow:

```text
React
  ↓
Node.js
  ↓
Python NLP Service
  ↓
PostgreSQL
  ↓
Node.js
  ↓
React
```

### 18.4 Negative Testing

Test:

- Unsupported file format
- Empty resume
- Empty job description
- Corrupted PDF
- Corrupted DOCX
- Oversized file
- Invalid login
- Missing required fields
- Unauthorized resource access
- Python service unavailable
- Database connection failure
- Invalid analysis IDs

### 18.5 Example Test Cases

| Test Case | Expected Result |
|---|---|
| Register with valid details | User is created |
| Register with existing email | Controlled validation error |
| Login with wrong password | Authentication failure |
| Upload valid PDF | File accepted |
| Upload unsupported file | File rejected |
| Submit empty job description | Validation error |
| Analyze valid resume and job | Analysis result generated |
| Access another user's resume | Forbidden or not found |
| Python service unavailable | Controlled server error |
| Delete owned analysis | Analysis removed |

---

## 19. Error Handling

Use centralized error handling in the backend.

Recommended error categories:

```text
VALIDATION_ERROR
AUTHENTICATION_ERROR
AUTHORIZATION_ERROR
FILE_TYPE_NOT_ALLOWED
FILE_TOO_LARGE
FILE_PROCESSING_ERROR
NLP_SERVICE_ERROR
DATABASE_ERROR
RESOURCE_NOT_FOUND
INTERNAL_SERVER_ERROR
```

The frontend should show understandable messages without exposing internal stack traces.

Example:

```json
{
  "success": false,
  "error": {
    "code": "FILE_PROCESSING_ERROR",
    "message": "The uploaded document could not be processed."
  }
}
```

---

## 20. Git and Version Control

Recommended branches:

```text
main
develop
feature/authentication
feature/resume-upload
feature/nlp-processing
feature/matching-engine
feature/dashboard
feature/testing
```

Recommended commit format:

```text
feat: add resume upload API
fix: handle corrupted PDF files
test: add matching engine unit tests
docs: update API documentation
refactor: separate analysis service
```

Never commit:

- `.env`
- Passwords
- JWT secrets
- Uploaded resumes
- Database dumps containing personal information
- Large generated files
- Python virtual environments
- `node_modules`

---

## 21. Scope

### Included in Initial Version

- User authentication
- Resume upload
- PDF and DOCX parsing
- Resume text extraction
- Job description analysis
- Skill extraction
- Resume-job matching
- Compatibility scoring
- Skill gap analysis
- Resume quality analysis
- Recommendations
- Analysis history
- PostgreSQL storage
- Testing
- Documentation

### Not Included Initially

- Actual recruitment decisions
- Automatic job applications
- Background verification
- Guaranteed hiring predictions
- Complete replacement of human recruiters
- Advanced recruiter ranking
- Job portal integrations
- Multilingual analysis
- Interview question generation
- Automated resume rewriting

These can be considered future enhancements.

---

## 22. Future Enhancements

Possible future improvements:

1. Compare one resume with multiple jobs.
2. Compare different versions of a resume.
3. Add personalized learning recommendations.
4. Integrate with job portals.
5. Support multilingual resumes.
6. Generate interview questions based on the resume.
7. Add automated resume improvement suggestions.
8. Add a recruiter dashboard.
9. Add advanced semantic similarity models.
10. Add more detailed evidence-based explanations.
11. Add background processing for large files.
12. Add model evaluation and monitoring.

---

## 23. Team Responsibilities

For a six-member team:

| Member | Responsibility |
|---|---|
| Member 1 | React frontend and dashboard |
| Member 2 | Node.js/Express backend and APIs |
| Member 3 | Python resume parsing and document processing |
| Member 4 | NLP, skill extraction, and matching algorithm |
| Member 5 | Database and backend integration |
| Member 6 | Testing, integration, deployment, and documentation |

All team members should understand:

- Overall architecture
- Main workflow
- Database structure
- API communication
- Their individual contribution
- Project limitations
- Testing results

---

## 24. Cursor Development Instructions

This section is intended to guide Cursor while implementing the project.

### General Rules

1. Read the entire README before making changes.
2. Do not generate the entire application in one step.
3. Implement the project incrementally by module.
4. Preserve the defined architecture unless a change is explicitly requested.
5. Do not introduce unnecessary libraries.
6. Explain important implementation decisions.
7. Write maintainable, modular code.
8. Use environment variables for configuration.
9. Never hardcode secrets.
10. Validate all user inputs.
11. Add error handling for expected failures.
12. Write tests for important business logic.
13. Do not claim a feature is complete without testing it.
14. Keep API contracts consistent between frontend, backend, and Python.
15. Do not use AI-generated results as unquestionable hiring decisions.

### Implementation Order

Implement in this order:

```text
1. Repository structure
2. Environment configuration
3. PostgreSQL connection
4. Database schema and migrations
5. Express server setup
6. Authentication
7. Resume upload
8. PDF/DOCX extraction
9. Job description storage
10. Python NLP service
11. Skill extraction
12. Matching engine
13. Scoring engine
14. Analysis persistence
15. React authentication screens
16. Resume upload interface
17. Job description interface
18. Analysis dashboard
19. History page
20. Testing
21. Documentation
```

### Cursor Working Method

For each feature:

1. Explain the implementation plan.
2. Identify files to create or modify.
3. Implement the smallest working version.
4. Run relevant tests or checks.
5. Explain how to verify the feature manually.
6. Identify known limitations.
7. Proceed to the next feature only after the current feature is stable.

### Avoid

- Building every feature in one response
- Replacing PostgreSQL with an unrelated database without approval
- Adding an LLM API before the baseline NLP workflow works
- Making unsupported claims about resume quality
- Treating missing extracted information as proof of missing skills
- Exposing private resume data
- Ignoring authentication and authorization
- Skipping negative testing
- Adding unnecessary microservices
- Using unexplained magic numbers in scoring

---

## 25. Recommended First Cursor Prompt

Copy the following prompt into Cursor after creating the repository:

```text
You are the lead software engineer for this project.

Read the README.md file completely before making any changes.

We are building an AI-Powered Resume Analyzer and Job Matching System with:

- React.js frontend
- Node.js and Express.js backend
- Python NLP service
- PostgreSQL database

The application must support:

1. User registration and authentication
2. Resume upload in PDF and DOCX formats
3. Resume text extraction
4. Job description analysis
5. Skill extraction
6. Resume-job matching
7. Compatibility scoring
8. Skill gap analysis
9. Resume quality analysis
10. Recommendations
11. Analysis history
12. Testing

Do not build the entire application at once.

First, inspect the current repository and tell me:

1. Which files already exist
2. Which required directories are missing
3. Which dependencies are installed
4. Whether the environment is configured
5. Whether PostgreSQL is available
6. Whether Python is available

Then propose a step-by-step implementation plan.

For the first implementation task, create the basic monorepo structure:

- client
- server
- nlp-service
- database
- docs
- uploads

Create appropriate .gitignore files and .env.example files.

Do not add unnecessary libraries.
Do not hardcode secrets.
Do not implement authentication, NLP, or matching until the basic structure is reviewed.

After making changes, explain:
- Files created
- Files modified
- Commands to run
- How to verify the result
- Any remaining issues
```

---

## 26. Suggested Subsequent Cursor Prompts

### Backend Setup Prompt

```text
Implement the Express backend foundation.

Requirements:
- Create app.js and server.js
- Add environment configuration
- Add centralized error handling
- Add CORS configuration
- Add Helmet
- Add a health-check endpoint
- Add a consistent JSON response format
- Add a PostgreSQL connection module
- Add a basic database connectivity check

Do not implement authentication yet.

Run the server and test:
GET /health

Explain every file created and how to verify it.
```

### Database Prompt

```text
Design and implement the PostgreSQL schema based on README.md.

Include:
- users
- resumes
- job_descriptions
- skills
- resume_skills
- analyses
- analysis_skills

Use primary keys, foreign keys, unique constraints, timestamps, and appropriate indexes.

Add migrations or a clearly documented schema process.

Do not store plain-text passwords.
Do not remove existing data without confirmation.

Explain the schema and provide commands to initialize it.
```

### Authentication Prompt

```text
Implement authentication in the Node.js backend.

Requirements:
- Registration
- Login
- Current user endpoint
- Password hashing with bcrypt
- JWT authentication
- Validation
- Authentication middleware
- Protected routes
- Consistent error responses

Test:
- Valid registration
- Duplicate email
- Invalid login
- Valid login
- Missing token
- Invalid token

Do not expose passwords or secrets in responses or logs.
```

### Resume Processing Prompt

```text
Implement resume upload and processing incrementally.

First:
1. Accept PDF and DOCX files.
2. Validate extension and MIME type.
3. Enforce the configured file size limit.
4. Store files safely.
5. Save resume metadata.
6. Add processing status.
7. Reject corrupted or unsupported files.

Then create the Python service endpoint for text extraction.

Do not implement semantic matching yet.
Write tests for invalid file types, empty files, oversized files, and corrupted documents.
```

### Matching Engine Prompt

```text
Implement the baseline matching engine based on README.md.

Requirements:
- Normalize skill names
- Support skill aliases
- Identify matched skills
- Identify missing skills
- Identify partial matches
- Preserve evidence where available
- Calculate skill match percentage
- Keep the algorithm deterministic
- Add unit tests

Do not rely exclusively on embedding similarity.
Do not treat missing extracted evidence as proof that the candidate lacks a skill.
Explain the scoring logic before implementing it.
```

### Frontend Prompt

```text
Implement the React frontend incrementally.

Start with:
- React Router
- Authentication pages
- Protected routes
- API client
- Basic dashboard layout
- Loading states
- Error states

Then implement:
- Resume upload
- Job description form
- Analysis results
- Analysis history

Keep components modular.
Do not place all application logic inside App.jsx.
Make API calls through a dedicated API layer.
Test important UI flows.
```

---

## 27. Definition of Done

The project is considered ready for academic demonstration when:

### Backend

- [ ] Server starts successfully
- [ ] Environment variables are configured
- [ ] Database connection works
- [ ] Authentication works
- [ ] Protected routes work
- [ ] Resume upload works
- [ ] Job description APIs work
- [ ] Analysis API works
- [ ] Errors are handled consistently

### Python NLP Service

- [ ] PDF extraction works
- [ ] DOCX extraction works
- [ ] Text cleaning works
- [ ] Skill extraction works on sample data
- [ ] Job description analysis works
- [ ] Matching engine works
- [ ] Score calculation is tested
- [ ] Recommendations are generated
- [ ] Invalid inputs are handled

### Frontend

- [ ] Registration works
- [ ] Login works
- [ ] Protected routes work
- [ ] Resume upload works
- [ ] Job description input works
- [ ] Analysis can be triggered
- [ ] Results are displayed
- [ ] Missing skills are visible
- [ ] Recommendations are visible
- [ ] History is visible
- [ ] Loading and error states work

### Testing

- [ ] Unit tests pass
- [ ] API tests pass
- [ ] Integration tests pass
- [ ] UI tests cover important flows
- [ ] Negative test cases are documented
- [ ] Manual testing is completed

### Documentation

- [ ] README is updated
- [ ] Architecture diagram is included
- [ ] Database diagram is included
- [ ] API documentation is included
- [ ] Screenshots are captured
- [ ] Test results are documented
- [ ] Team responsibilities are documented
- [ ] Viva preparation is completed

---

## 28. Limitations

The project has the following limitations:

- Resume formatting can affect text extraction.
- NLP models may incorrectly interpret information.
- Job descriptions can use different terminology.
- Compatibility scores are estimates.
- Recommendations depend on extraction quality.
- A missing skill in the extracted resume is not proof that the candidate does not have that skill.
- Semantic similarity can produce false positives.
- The system cannot reliably determine hiring outcomes.
- The quality score is an automated heuristic and should be explained transparently.

---

## 29. Final Project Workflow

```text
1. User registers
        ↓
2. User logs in
        ↓
3. User uploads resume
        ↓
4. System validates the file
        ↓
5. Python service extracts resume text
        ↓
6. NLP service structures resume information
        ↓
7. User enters job description
        ↓
8. System analyzes job requirements
        ↓
9. Matching engine compares resume and job
        ↓
10. Compatibility score is calculated
        ↓
11. Skill gaps are identified
        ↓
12. Recommendations are generated
        ↓
13. Results are displayed on dashboard
        ↓
14. Analysis is saved in PostgreSQL
        ↓
15. User can view analysis history
```

---

## 30. Conclusion

The AI-Powered Resume Analyzer and Job Matching System combines:

- Full-stack web development
- React.js
- Node.js and Express.js
- Python
- NLP
- PostgreSQL
- API design
- Authentication
- Software testing
- Documentation

The project is intended to demonstrate practical AI/NLP and full-stack development skills through a transparent resume analysis and job matching workflow.

The implementation should prioritize:

1. A working end-to-end baseline
2. Explainable extraction and matching
3. Secure handling of user data
4. Consistent API contracts
5. Testable scoring logic
6. Clear documentation
7. Honest communication of limitations

Build the system incrementally, test each module, and ensure that every team member can explain the complete architecture and their individual contribution.
