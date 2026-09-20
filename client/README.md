# Client Frontend

This directory houses the React.js frontend application for the AI-Powered Resume Analyzer and Job Matching System.

## Planned Structure

```text
client/
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── api/
    │   ├── apiClient.js
    │   ├── authApi.js
    │   ├── resumeApi.js
    │   └── analysisApi.js
    ├── components/
    │   ├── Navbar.jsx
    │   ├── ProtectedRoute.jsx
    │   ├── FileUploader.jsx
    │   ├── ScoreCard.jsx
    │   ├── SkillList.jsx
    │   └── LoadingState.jsx
    ├── pages/
    │   ├── Login.jsx
    │   ├── Register.jsx
    │   ├── Dashboard.jsx
    │   ├── UploadResume.jsx
    │   ├── JobDescription.jsx
    │   ├── AnalysisResult.jsx
    │   └── AnalysisHistory.jsx
    ├── context/
    │   └── AuthContext.jsx
    ├── hooks/
    │   └── useAuth.js
    └── styles/
        └── global.css
```

## Setup Instructions (Phase 7)
1. Copy `.env.example` to `.env`.
2. Install dependencies: `npm install`.
3. Start development server: `npm run dev`.
