-- ─────────────────────────────────────────────────────────────────────────
-- 0004_activity_log_impersonator.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: Add impersonator_id to activity_log so writes via activity.service.ts
--      (which already emits the column) succeed against older DBs where
--      it was missing.
-- Client impact: additive only (nullable column + partial index).
-- ─────────────────────────────────────────────────────────────────────────
-- Adds the impersonator_id column to activity_log. The Drizzle schema
-- declares it and activity.service.ts INSERTs it, but init.sql + the live
-- DB were missing it — any write to activity_log through that service was
-- silently failing against older databases.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE activity_log
    ADD COLUMN IF NOT EXISTS impersonator_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_impersonator
    ON activity_log (impersonator_id)
    WHERE impersonator_id IS NOT NULL;
