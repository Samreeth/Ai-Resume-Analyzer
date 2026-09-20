# Backend API Server

This directory contains the Node.js and Express.js REST API server for the AI-Powered Resume Analyzer and Job Matching System, implemented using **ECMAScript Modules (ESM / `.mjs`)**.

## Current Structure

```text
server/
├── package.json
├── .env.example
├── .gitignore
├── README.md
└── src/
    ├── server.mjs
    ├── app.mjs
    ├── config/
    │   ├── env.mjs
    │   └── database.mjs
    ├── middleware/
    │   └── error.middleware.mjs
    └── utils/
        └── response.mjs
```

## Setup Instructions
1. Copy `.env.example` to `.env` (optional for defaults).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Verify server health:
   ```bash
   curl http://localhost:5000/health
   ```
