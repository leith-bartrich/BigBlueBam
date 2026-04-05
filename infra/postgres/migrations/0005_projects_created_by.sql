-- ─────────────────────────────────────────────────────────────────────────
-- 0005_projects_created_by.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: Add projects.created_by on older DBs so Drizzle's default-all-columns
--      SELECTs against `projects` stop failing with missing-column errors.
-- Client impact: additive only (nullable column + partial index).
-- ─────────────────────────────────────────────────────────────────────────
-- Adds the projects.created_by column. Drizzle schema + init.sql both
-- declare it but the running DB was initialized before it was added,
-- breaking any SELECT from `projects` that goes through Drizzle (which
-- emits all columns by default).
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_created_by
    ON projects (created_by)
    WHERE created_by IS NOT NULL;
