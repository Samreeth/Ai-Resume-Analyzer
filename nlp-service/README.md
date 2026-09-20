# Python AI/NLP Service

This directory contains the Python-based natural language processing service for document extraction, skill identification, and resume-to-job matching.

## Planned Structure

```text
nlp-service/
├── requirements.txt
├── app.py
├── config.py
├── routes/
│   ├── resume_routes.py
│   └── analysis_routes.py
├── services/
│   ├── pdf_extractor.py
│   ├── docx_extractor.py
│   ├── text_cleaner.py
│   ├── resume_parser.py
│   ├── job_parser.py
│   ├── skill_extractor.py
│   ├── matching_engine.py
│   ├── quality_analyzer.py
│   └── recommendation_engine.py
├── models/
│   └── schemas.py
└── tests/
    ├── test_extractors.py
    ├── test_matching.py
    └── test_quality.py
```

## Setup Instructions (Phase 5)
1. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the service:
   ```bash
   uvicorn app:app --reload --port 8000
   ```
