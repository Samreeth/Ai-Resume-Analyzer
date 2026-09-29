-- Seed 002: Master Skills Dictionary Synchronization (Phase 7 Stage 1 Taxonomy)
-- Idempotent: Uses ON CONFLICT ((LOWER(skill_name))) DO NOTHING to guarantee zero duplicates.

INSERT INTO skills (skill_name, category) VALUES
('C', 'Programming language'),
('R', 'Programming language'),
('.NET', 'Framework')
ON CONFLICT ((LOWER(skill_name))) DO NOTHING;
