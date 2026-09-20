-- Docker PostgreSQL Initialization Script
-- Initializes only database extensions and prerequisites.
-- Schema creation is handled exclusively by the migration runner (server/src/database/migrate.mjs).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
