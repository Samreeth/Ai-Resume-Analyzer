# System Architecture

## 1. High-Level Architecture Overview

The **AI-Powered Resume Analyzer and Job Matching System** is structured as a decoupled full-stack application comprising four core tiers:

```text
               ┌─────────────────────────┐
               │      React Frontend     │
               │         (Vite)          │
               │   Port 5173 / Client    │
               └────────────┬────────────┘
                            │ HTTP (REST JSON)
                            ▼
               ┌─────────────────────────┐
               │   Node.js + Express     │
               │       Backend API       │
               │       Port 5000         │
               └──────┬───────────┬──────┘
                      │           │
          Internal    │           ▼
         HTTP (JSON)  │  ┌──────────────────┐
                      │  │   PostgreSQL     │
                      │  │   Database       │
                      │  │   Port 5432      │
                      │  └──────────────────┘
                      ▼
             ┌─────────────────────────┐
             │    Python NLP Service   │
             │        (FastAPI)        │
             │        Port 8000        │
             └─────────────────────────┘
```

## 2. Component Responsibilities

### 2.1 React Frontend (`client/`)
- Single Page Application (SPA) built with Vite and React.
- Handles user authentication state, document upload interactions, job input forms, and dynamic visualization dashboards.
- Communicates exclusively with the Node.js backend API via HTTP client (`axios`).
- Does **not** store any database credentials, secret keys, or business logic.

### 2.2 Node.js & Express Backend (`server/`)
- Acts as the primary application gateway and orchestrator.
- Manages user registration, authentication (JWT + bcrypt), authorization, and request validation.
- Receives uploaded resumes (PDF and DOCX) via `multer` and safely stores them in `uploads/`.
- Dispatches text extraction and matching requests to the internal Python NLP microservice.
- Persists all entities, extraction results, and analysis scores to PostgreSQL.

### 2.3 Python NLP Service (`nlp-service/`)
- Specialized microservice built with FastAPI/Python.
- Extracts raw text from PDF and DOCX files.
- Identifies structured sections (Skills, Education, Experience, Projects).
- Normalizes technical skills and maps known aliases.
- Computes compatibility scores across skills, experience, education, projects, and resume quality.
- Generates actionable, constructive improvement recommendations.

### 2.4 PostgreSQL Database (`database/`)
- Stores persistent relational data: `users`, `resumes`, `job_descriptions`, `skills`, `resume_skills`, `analyses`, and `analysis_skills`.
- Enforces relational constraints (foreign keys, cascading deletions, unique indexes).
