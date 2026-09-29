# System Architecture & Flow Diagrams

This document contains architectural, pipeline, and state-flow diagrams illustrating the components and data flows of the **AI-Powered Resume Analyzer and Job Matching Platform**.

All diagrams use GitHub-compatible Mermaid syntax.

---

## 1. High-Level System Architecture

The application is structured as a modular Node.js native ECMAScript Modules (ESM) backend operating over a PostgreSQL relational store, using local deterministic processing engines for document extraction, skill taxonomy matching, scoring, and recommendation generation.

```mermaid
graph TD
    Client[HTTP Client / API Consumer] -->|REST / JSON| Edge[Express 4.21 Application Gateway]

    subgraph Security_And_Middleware [Middleware Pipeline]
        Edge --> Helmet[Helmet HTTP Protection]
        Helmet --> CORS[CORS Origin Validation]
        CORS --> RateLimiter[Body Size & Upload Limits]
        RateLimiter --> AuthMid[JWT Authentication Middleware]
        AuthMid --> ZodMid[Zod Schema Request Validation]
    end

    subgraph Controllers_And_Routing [Controllers & Routing Layer]
        ZodMid --> AuthCtrl[Auth Controller]
        ZodMid --> ResumeCtrl[Resume Controller]
        ZodMid --> ProcessingCtrl[Processing Controller]
        ZodMid --> JobCtrl[Job Controller]
        ZodMid --> AnalysisCtrl[Analysis Controller]
        ZodMid --> RecCtrl[Recommendation Controller]
    end

    subgraph Service_And_Business_Logic [Services & Business Logic]
        AuthCtrl --> AuthService[Auth Service - bcrypt]
        ResumeCtrl --> ResumeService[Resume Service]
        ProcessingCtrl --> ProcService[Processing Service]
        JobCtrl --> JobService[Job Service]
        AnalysisCtrl --> AnalysisService[Analysis Service]
        RecCtrl --> RecService[Recommendation Service]
    end

    subgraph Local_Deterministic_Engines [Local Extraction & Analytical Engines]
        ResumeService --> StorageVault[Secure File Storage - uploads/resumes]
        ProcService --> Semaphore[Concurrency Semaphore]
        Semaphore --> PdfExtract[unpdf Text Extractor]
        Semaphore --> DocxExtract[yauzl / fast-xml-parser Extractor]
        ProcService --> SkillMatcher[Deterministic Skill Matcher]
        JobService --> SkillMatcher
        AnalysisService --> MatchEngine[Deterministic Matching & Scoring Engine]
        RecService --> QualityAnalyzer[Deterministic Quality Diagnostic Engine]
    end

    subgraph Database_Storage [Relational Persistence Layer]
        AuthService --> Postgres[(PostgreSQL 16 Engine)]
        ResumeService --> Postgres
        ProcService --> Postgres
        JobService --> Postgres
        AnalysisService --> Postgres
        RecService -.->|Read-Only| Postgres
    end
```

---

## 2. Backend Request Processing Flow

Every incoming HTTP request traverses a defense-in-depth pipeline ensuring protocol hardening, tenant identity resolution, payload contract validation, controller routing, transactional service logic, and consistent JSON envelope responses.

```mermaid
sequenceDiagram
    autonumber
    actor Client as HTTP Client
    participant App as Express Gateway (Helmet / CORS)
    participant Auth as Auth Middleware (JWT)
    participant Val as Zod Validator Middleware
    participant Ctrl as Resource Controller
    participant Svc as Business Service
    participant DB as PostgreSQL 16 Pool

    Client->>App: HTTP Request (Method, Route, Headers, Body)
    App->>App: Apply security headers & CORS policy
    App->>Auth: Pass to requireAuth (if route protected)
    alt Missing or Invalid JWT
        Auth-->>Client: 401 UNAUTHORIZED / AUTHENTICATION_ERROR
    else Valid JWT
        Auth->>Auth: Attach req.user = { userId, email }
        Auth->>Val: Pass to validateRequest(schema)
        alt Payload Schema Violation
            Val-->>Client: 400 VALIDATION_ERROR (Zod issues list)
        else Valid Schema
            Val->>Ctrl: Invoke controller action
            Ctrl->>Svc: Invoke business operation(userId, params)
            Svc->>DB: Query / Transaction (scoped by userId)
            DB-->>Svc: Query Results / Row Count
            alt Resource Not Found or Cross-Tenant Access
                Svc-->>Ctrl: Resource not found / IDOR prevention
                Ctrl-->>Client: 404 RESOURCE_NOT_FOUND
            else Successful Operation
                Svc-->>Ctrl: Operation Data
                Ctrl-->>Client: 200/201 JSON Envelope { success: true, data, message }
            end
        end
    end
```

---

## 3. Resume Ingestion & Storage Pipeline

The resume ingestion subsystem validates incoming files through multiple stages to enforce file size boundaries, magic-byte integrity, sanitized naming, quarantined staging, and transactional persistence.

```mermaid
graph LR
    Upload[Client Upload Multipart] --> Multer[Multer Memory Buffer 5MB Limit]
    Multer --> MagicCheck{Magic Bytes Check}
    MagicCheck -->|Invalid Header| RejectType[Reject 415 UNSUPPORTED_MEDIA_TYPE]
    MagicCheck -->|%PDF-1.x / PK\x03\x04| HashCompute[Compute SHA-256 Hash]
    HashCompute --> UUIDGen[Generate UUID Storage Name]
    UUIDGen --> TempWrite[Atomic Staged Write .tmp_uuid.tmp]
    TempWrite --> VaultMove[Rename to Secure File Vault uuid.ext]
    VaultMove --> DBInsert[DB Transaction INSERT resumes PENDING]
    DBInsert -->|Success| CommitResp[Return 201 Created Status: PENDING]
    DBInsert -->|DB Error| Rollback[ROLLBACK & Delete Stored File]
```

---

## 4. In-Process Text Extraction State Machine

Resumes transition through four discrete lifecycle states stored in `resumes.extraction_status`: `'PENDING'`, `'PROCESSING'`, `'COMPLETED'`, and `'FAILED'`. Processing concurrency is fenced using atomic database claim tokens.

```mermaid
stateDiagram-v2
    [*] --> PENDING: Resume Uploaded & Staged in Database

    PENDING --> PROCESSING: Worker claims task (atomic UUID token)
    
    state PROCESSING {
        [*] --> AcquireSemaphore: Request concurrency permit (max 2)
        AcquireSemaphore --> ReadBuffer: Read stored binary from disk
        ReadBuffer --> ParseDocument: Dispatch to unpdf (PDF) or yauzl (DOCX)
        ParseDocument --> CleanText: Sanitize & normalize extracted text
        CleanText --> RunSkillMatcher: Match against 86-skill taxonomy
        RunSkillMatcher --> PersistSkills: Insert matches into resume_skills
        PersistSkills --> ReleaseSemaphore: Release permit
    }

    PROCESSING --> COMPLETED: Extraction & matching successful (token cleared)
    PROCESSING --> FAILED: Parser error, timeout, corrupt ZIP, or bomb (token cleared)
    PROCESSING --> FAILED: Server crash or timeout > 5m (Stale / Startup recovery)

    FAILED --> PROCESSING: Retry extraction if attempts < 3
    COMPLETED --> [*]: Ready for Job Matching & Analysis
```

---

## 5. Deterministic Skill Extraction Pipeline

The deterministic skill matcher normalizes text and matches candidate qualifications against the 86-skill catalog using regular expressions with word boundary and short-token lookahead fencing.

```mermaid
flowchart TD
    Start[Raw Text Stream - Resume or Job Description] --> Sanitize[Sanitize Text: normalize whitespace, strip control chars]
    Sanitize --> DetectSections[Detect Context Sections: Skills, Experience, Education, Projects]
    DetectSections --> IterTaxonomy[Iterate Taxonomy Skills - 86 Canonical Catalog]
    
    IterTaxonomy --> TokenClassifier{Token Type Check}
    TokenClassifier -->|Single-Letter / Short Token: C, R, Go| FencedRegex[Strict Lookahead/Lookbehind Fencing: (?<![a-zA-Z0-9])TOKEN(?![a-zA-Z0-9+#])]
    TokenClassifier -->|Multi-Word / Standard Token| WordBoundaryRegex[Standard Word Boundary Regex: \bTOKEN\b]
    
    FencedRegex --> AliasScan[Scan Canonical Name & Known Aliases]
    WordBoundaryRegex --> AliasScan
    
    AliasScan --> MatchCheck{Match Found?}
    MatchCheck -->|No| NextSkill[Next Taxonomy Skill]
    MatchCheck -->|Yes| CalcConfidence[Calculate Match Confidence: exact=1.00, alias=0.85, section weight=1.10]
    CalcConfidence --> Deduplicate[Deduplicate Canonical Skill Names]
    Deduplicate --> Output[Structured Extracted Skills Array]
    NextSkill --> IterTaxonomy
```

---

## 6. Job Description Ingestion & Extraction Flow

Job descriptions are sanitized, parsed into contextual sections (Required vs. Preferred qualifications), extracted using the deterministic skill matcher, and persisted into `job_descriptions.extracted_data`.

```mermaid
flowchart TD
    Input[POST /api/jobs Payload: title, company, description] --> Validate[Zod Validation: title 2-255, description 20-50000]
    Validate --> SanitizeText[Normalize whitespace and strip formatting anomalies]
    SanitizeText --> SplitSections[Section Parser: Split into Required vs Preferred blocks]
    
    subgraph Section_Identification [Section Keyword Categorization]
        SplitSections --> ReqPatterns[Matches: Requirements, Must Have, Required Qualifications]
        SplitSections --> PrefPatterns[Matches: Preferred, Nice to Have, Bonus, Desired]
        SplitSections --> NeutralPatterns[Fallback: Entire body considered General Requirements]
    end
    
    ReqPatterns --> MatchReq[Skill Matcher: Extract Required Skills]
    PrefPatterns --> MatchPref[Skill Matcher: Extract Preferred Skills]
    NeutralPatterns --> MatchGeneral[Skill Matcher: Extract General Skills]
    
    MatchReq --> Consolidate[Consolidate & Tag Extracted Skills]
    MatchPref --> Consolidate
    MatchGeneral --> Consolidate
    
    Consolidate --> StoreDB[(Update job_descriptions SET extracted_data = JSONB)]
    StoreDB --> Response[Return 201 Created with Extracted Skill Summary]
```

---

## 7. Resume ↔ Job Compatibility Matching Engine

Stage 3 executes atomic compatibility matching between a processed resume and an extracted job description, calculating a deterministic composite score and persisting both parent analysis and child itemized skill records.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Authenticated Client
    participant Ctrl as Analysis Controller
    participant Svc as Analysis Service
    participant Matcher as Skill Matcher Engine
    participant DB as PostgreSQL Transaction

    Client->>Ctrl: POST /api/analyses { resumeId, jobId }
    Ctrl->>Svc: createAnalysis(userId, resumeId, jobId)
    Svc->>DB: Verify resume ownership & extraction_status = 'COMPLETED'
    Svc->>DB: Verify job description ownership & extracted_data != NULL
    
    Svc->>Matcher: Compare Resume Skills with Job Required & Preferred Skills
    Matcher-->>Svc: Intersections: Matched Required, Missing Required, Matched Preferred, Missing Preferred
    
    Svc->>Svc: Compute S_req = Matched_Req / Total_Req
    Svc->>Svc: Compute S_pref = Matched_Pref / Total_Pref
    Svc->>Svc: Compute S_conf = Average Confidence of All Matched Skills
    Svc->>Svc: Overall Score = (0.70 * S_req + 0.20 * S_pref + 0.10 * S_conf) * 100
    
    Svc->>DB: BEGIN Transaction
    Svc->>DB: INSERT INTO analyses (user_id, resume_id, job_id, resume_file_name, job_title, overall_score, skill_score, quality_score=0.00, ...)
    Svc->>DB: Batch INSERT INTO analysis_skills (analysis_id, skill_id, status, evidence, similarity_score)
    Svc->>DB: COMMIT Transaction
    
    Svc-->>Ctrl: Persisted Analysis Record & Itemized Match Breakdown
    Ctrl-->>Client: 201 Created JSON Response
```

---

## 8. On-Demand Quality Diagnostics & Recommendation Engine

Stage 4 computes resume quality diagnostics and actionable recommendations dynamically upon retrieval without writing or mutating database records.

```mermaid
flowchart TD
    Req[GET /api/analyses/:analysisId/recommendations] --> Verify[Verify Analysis Ownership: user_id = req.user.userId]
    Verify --> Fetch[Fetch Analysis, Resume Extracted Text, and analysis_skills items]
    
    subgraph Quality_Diagnostic_Engine [Deterministic Quality Analyzer - 12 Rules, Base 100]
        Fetch --> Rule1[Contact Info Check: Missing email AND phone -15]
        Fetch --> Rule2[Section Presence: Skills, Experience, Education, Projects -10 each]
        Fetch --> Rule3[Word Count Bounds: <150 -30, 150-249 -15, 250-399 -5, >2000 -10]
        Fetch --> Rule4[Bullet Point Density: 0 bullets -15, 1-4 bullets -8]
        Fetch --> Rule5[Action Verb Density: 0 verbs -15, 1-2 verbs -8]
        Fetch --> Rule6[Quantifiable Metrics: 0 metrics -15, 1-2 metrics -8]
        
        Rule1 --> SumDeductions[Calculate Deductions & Clamp Quality Score 0-100]
        Rule2 --> SumDeductions
        Rule3 --> SumDeductions
        Rule4 --> SumDeductions
        Rule5 --> SumDeductions
        Rule6 --> SumDeductions
    end
    
    subgraph Recommendation_Synthesizer [Recommendation Generator]
        SumDeductions --> GapAnalysis[Analyze Missing Skills from analysis_skills]
        GapAnalysis --> TagRequired[Missing Required Skills: HIGH Priority, SKILL_GAP]
        GapAnalysis --> TagPreferred[Missing Preferred Skills: MEDIUM Priority, SKILL_GAP]
        SumDeductions --> TagQuality[Synthesize Quality Recommendations: HIGH/MEDIUM/LOW, RESUME_QUALITY/FORMATTING]
        TagRequired --> SortRecs[Sort Recommendations: Priority Order HIGH -> MEDIUM -> LOW]
        TagPreferred --> SortRecs
        TagQuality --> SortRecs
    end
    
    SortRecs --> ReadOnlyResponse[Return 200 OK JSON: Quality Score, Breakdown, Actionable Recommendations]
```

---

## 9. Concurrency Control & Crash Recovery Flow

The processing service protects extraction workers against thread pool saturation, worker crash abandonment, and concurrent task duplication.

```mermaid
stateDiagram-v2
    [*] --> InProcessCheck: processResume() called
    
    state InProcessCheck {
        [*] --> CheckStatus: Query resumes row
        CheckStatus --> ActiveError: If extraction_status == 'PROCESSING' (409 Conflict)
        CheckStatus --> CompletedError: If extraction_status == 'COMPLETED' (400 Bad Request)
        CheckStatus --> MaxAttemptsError: If processing_attempts >= 3 (422 Locked)
        CheckStatus --> AtomicClaim: extraction_status in ('PENDING', 'FAILED')
    }

    state AtomicClaim {
        [*] --> GenerateToken: Generate processing_token UUID
        GenerateToken --> UpdateRow: UPDATE resumes SET extraction_status='PROCESSING', processing_token=token WHERE resume_id=$1
        UpdateRow --> FencedProcessing: Token acquired
    }

    state ServerRestartOrCrash {
        [*] --> ServerBoot: Application initializes
        ServerBoot --> StartupRecovery: runStartupRecovery() executes
        StartupRecovery --> ResetToFailed: UPDATE resumes SET extraction_status='FAILED', processing_error_code='SERVER_RESTARTED' WHERE extraction_status='PROCESSING'
    }

    state PeriodicStaleMonitor {
        [*] --> TimerFired: Every 60 seconds
        TimerFired --> StaleRecovery: runStaleRecovery() executes
        StaleRecovery --> ResetStale: UPDATE resumes SET extraction_status='FAILED', processing_error_code='STALE_PROCESSING_TIMEOUT' WHERE extraction_status='PROCESSING' AND started_at < NOW() - 5 min
    }
```
