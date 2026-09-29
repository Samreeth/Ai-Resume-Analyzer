# Live Demonstration & End-to-End Walkthrough Script

This document provides a step-by-step walkthrough script demonstrating the end-to-end functionality of the **AI-Powered Resume Analyzer and Job Matching Platform** using `cURL` commands.

---

## Prerequisites & Environment Setup

Ensure the server is running on `http://localhost:5000`:
```bash
# Verify health
curl -s http://localhost:5000/health
```

---

## Scenario A: User Authentication & JWT Token Acquisition

### Step 1: Register Candidate Account
```bash
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Candidate",
    "email": "jane.candidate@example.com",
    "password": "Password123!"
  }'
```
*Expected Status*: `201 Created`  
*Response Envelope*:
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "name": "Jane Candidate",
      "email": "jane.candidate@example.com",
      "created_at": "2026-09-29T16:45:00.000Z"
    }
  },
  "message": "User registered successfully"
}
```

### Step 2: Log In & Store JWT
```bash
LOGIN_RESP=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.candidate@example.com",
    "password": "Password123!"
  }')

# Export JWT Token
TOKEN=$(echo $LOGIN_RESP | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "JWT Token: $TOKEN"
```

---

## Scenario B: Resume Ingestion & Processing Lifecycle

### Step 1: Upload Candidate Resume
Upload a sample resume (`resume.pdf` or `resume.docx`). The file is staged in memory, magic-byte validated, saved to the secure file vault, and registered in the database with status `'PENDING'`.

```bash
UPLOAD_RESP=$(curl -s -X POST http://localhost:5000/api/resumes \
  -H "Authorization: Bearer $TOKEN" \
  -F "resume=@sample_resume.pdf")

RESUME_ID=$(echo $UPLOAD_RESP | grep -o '"resume_id":"[^"]*' | cut -d'"' -f4)
echo "Uploaded Resume ID: $RESUME_ID"
```
*Initial Status*: `'PENDING'`

### Step 2: Trigger Text Extraction & Skill Matching
Trigger the processing pipeline. The backend claims the resume via atomic token, transitioning the status through the extraction lifecycle: `PENDING` → `PROCESSING` → `COMPLETED` (or `FAILED` on parser error):

```bash
curl -s -X POST http://localhost:5000/api/resumes/$RESUME_ID/process \
  -H "Authorization: Bearer $TOKEN"
```

### Step 3: Poll Processing Status & Extraction Metadata
Clients can poll the processing status endpoint:
```bash
curl -s -X GET http://localhost:5000/api/resumes/$RESUME_ID/status \
  -H "Authorization: Bearer $TOKEN"
```
*Expected Response (Once Completed)*:
```json
{
  "success": true,
  "data": {
    "resumeId": "7b5247b4-3a9a-4c28-9842-83b6cb65f142",
    "extractionStatus": "COMPLETED",
    "processingAttempts": 1,
    "hasExtractedText": true,
    "canRetry": false
  },
  "message": "Resume processing status retrieved successfully"
}
```

### Step 4: Inspect Extracted Resume Details & Identified Skills
```bash
curl -s -X GET http://localhost:5000/api/resumes/$RESUME_ID \
  -H "Authorization: Bearer $TOKEN"
```
*Response shows*: Extracted plain text and itemized skills linked in `resume_skills` (e.g., JavaScript, React, Node.js, PostgreSQL).

---

## Scenario C: Job Description Ingestion & Requirement Extraction

### Step 1: Create a Job Posting
Submit a job description containing required and preferred qualification sections:

```bash
JOB_RESP=$(curl -s -X POST http://localhost:5000/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Full-Stack Engineer",
    "company": "Tech Innovations Inc.",
    "description": "We are seeking a Full-Stack Engineer. Requirements:\n- Strong proficiency in Node.js, Express, and PostgreSQL.\n- Experience with React and TypeScript.\n\nPreferred Qualifications:\n- Knowledge of Docker, AWS, and Redis.\n- Experience with GraphQL APIs."
  }')

JOB_ID=$(echo $JOB_RESP | grep -o '"job_id":"[^"]*' | cut -d'"' -f4)
echo "Created Job ID: $JOB_ID"
```

*Automatic Extraction Response*:
```json
{
  "success": true,
  "data": {
    "job": {
      "job_id": "e2808c7a-1fc1-4bb2-a6b6-32422e6cf843",
      "title": "Senior Full-Stack Engineer",
      "extracted_data": {
        "requiredSkills": ["Node.js", "Express", "PostgreSQL", "React", "TypeScript"],
        "preferredSkills": ["Docker", "AWS", "Redis", "GraphQL"],
        "extractedAt": "2026-09-29T16:50:00.000Z"
      }
    }
  },
  "message": "Job description created and skills extracted successfully"
}
```

---

## Scenario D: Resume ↔ Job Compatibility Matching Engine

### Step 1: Run Stage 3 Matching Analysis
Compare the processed resume against the extracted job description:

```bash
ANALYSIS_RESP=$(curl -s -X POST http://localhost:5000/api/analyses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"resumeId\": \"$RESUME_ID\",
    \"jobId\": \"$JOB_ID\"
  }")

ANALYSIS_ID=$(echo $ANALYSIS_RESP | grep -o '"analysis_id":"[^"]*' | cut -d'"' -f4)
echo "Created Analysis ID: $ANALYSIS_ID"
```

*Expected Status*: `201 Created`  
*Response Envelope*:
```json
{
  "success": true,
  "data": {
    "analysis_id": "f51270b2-7bb5-4a18-97ce-87116744c803",
    "resume_file_name": "sample_resume.pdf",
    "job_title": "Senior Full-Stack Engineer",
    "overall_score": 83.50,
    "skill_score": 83.50,
    "quality_score": 0.00,
    "scoring_version": "1.0",
    "matched_skills": [
      {
        "skillName": "Node.js",
        "category": "Backend Frameworks",
        "status": "MATCHED",
        "evidence": "[REQUIRED] Skills section exact match: 'Node.js' (Confidence: 1.00)"
      },
      {
        "skillName": "React",
        "category": "Frontend Frameworks",
        "status": "MATCHED",
        "evidence": "[REQUIRED] Skills section exact match: 'React' (Confidence: 1.00)"
      }
    ],
    "missing_skills": [
      {
        "skillName": "Docker",
        "category": "Cloud & Infrastructure",
        "status": "MISSING",
        "evidence": "[PREFERRED] Skill not detected in candidate resume"
      }
    ]
  },
  "message": "Resume and job description matched successfully"
}
```

---

## Scenario E: Actionable Recommendations & Quality Diagnostics

### Step 1: Fetch Stage 4 Recommendations
Retrieve on-demand quality diagnostics and synthesized suggestions:

```bash
curl -s -X GET http://localhost:5000/api/analyses/$ANALYSIS_ID/recommendations \
  -H "Authorization: Bearer $TOKEN"
```

*Expected Response Envelope*:
```json
{
  "success": true,
  "data": {
    "analysisId": "f51270b2-7bb5-4a18-97ce-87116744c803",
    "compatibilityScore": 83.50,
    "qualityScore": 85.00,
    "qualityBreakdown": {
      "baseScore": 100.00,
      "deductions": [
        {
          "rule": "Sparse Quantifiable Metrics",
          "deduction": 15.00,
          "category": "IMPACT_METRICS",
          "message": "No quantifiable metrics, percentages, or scale indicators were detected."
        }
      ]
    },
    "recommendations": [
      {
        "category": "SKILL_GAP",
        "priority": "MEDIUM",
        "title": "Add Preferred Skill: Docker",
        "suggestion": "The job prefers experience with Docker. If you have worked with containerization, highlight it."
      },
      {
        "category": "IMPACT_METRICS",
        "priority": "HIGH",
        "title": "Quantify Project & Work Achievements",
        "suggestion": "Include measurable metrics (e.g., 'reduced API latency by 35%', 'scaled system to 10k users') to demonstrate impact."
      }
    ]
  },
  "message": "Recommendations generated successfully"
}
```

---

## Scenario F: Multi-Tenant Isolation & IDOR Defense Verification

Verify that an authenticated user cannot access or view another user's resources:

### Step 1: Register Attacker Account (User B)
```bash
USER_B_RESP=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Attacker User",
    "email": "attacker@example.com",
    "password": "Password123!"
  }')

TOKEN_B=$(echo $USER_B_RESP | grep -o '"token":"[^"]*' | cut -d'"' -f4)
```

### Step 2: Attempt to Access User A's Analysis Using User B Token
```bash
curl -s -X GET http://localhost:5000/api/analyses/$ANALYSIS_ID \
  -H "Authorization: Bearer $TOKEN_B"
```
*Expected Status*: `404 Not Found` (Anti-enumeration defense: does NOT return 403)  
*Response Envelope*:
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Analysis report not found."
  }
}
```

---

## Scenario G: Historical Analysis Preservation Verification

Verify that deleting an underlying resume does not destroy historical analyses:

### Step 1: Delete Underlying Resume
```bash
curl -s -X DELETE http://localhost:5000/api/resumes/$RESUME_ID \
  -H "Authorization: Bearer $TOKEN"
```
*Expected Status*: `200 OK`

### Step 2: Verify Historical Analysis Remains Intact
```bash
curl -s -X GET http://localhost:5000/api/analyses/$ANALYSIS_ID \
  -H "Authorization: Bearer $TOKEN"
```
*Expected Result*: The analysis record is successfully retrieved. `resume_id` is now `null`, but `resume_file_name` ("sample_resume.pdf"), `job_title`, scores, and itemized matched skills remain fully preserved.
