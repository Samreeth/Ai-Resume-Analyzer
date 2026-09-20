-- Migration 003: Case-Insensitive Unique Index on User Email
-- Authoritative Source of Truth: database/migrations/

-- 1. Pre-check: Ensure no duplicate case-insensitive emails exist before index creation
DO $$
BEGIN
    IF EXISTS (
        SELECT LOWER(email)
        FROM users
        GROUP BY LOWER(email)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot create unique index: duplicate case-insensitive emails already exist in table users. Manual resolution required.';
    END IF;
END $$;

-- 2. Create case-insensitive unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email
ON users ((LOWER(email)));
