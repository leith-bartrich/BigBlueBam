-- ─────────────────────────────────────────────────────────────────────────
-- 0006_drizzle_drift_sweep.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: Final sweep to close residual column drift between Drizzle schemas
--      and the live DB that wasn't caught by 0001-0005 (guest_invitations
--      and one other currently-empty table).
-- Client impact: additive only (new columns on empty tables, IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────
-- Systematic sweep comparing every Drizzle schema file (apps/api,
-- apps/helpdesk-api, apps/banter-api) against the live DB's
-- information_schema.columns. Fixes the last of the column drift that
-- wasn't caught by 0001-0005.
--
-- All 48 live tables were sampled. Only the two tables below drifted
-- from their Drizzle definitions. Both tables are empty in the running
-- DB at migration time, so NOT NULL constraints can be added directly.
-- Still, this file uses ADD COLUMN IF NOT EXISTS so reruns are no-ops.
-- ─────────────────────────────────────────────────────────────────────────

-- guest_invitations: Drizzle declares role + project_ids + channel_ids
-- that never made it into init.sql on this instance.
ALTER TABLE guest_invitations
    ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'guest';

ALTER TABLE guest_invitations
    ADD COLUMN IF NOT EXISTS project_ids text[];

ALTER TABLE guest_invitations
    ADD COLUMN IF NOT EXISTS channel_ids text[];

-- impersonation_sessions.expires_at: Drizzle declares this NOT NULL with
-- no default. Table is currently empty so adding NOT NULL is safe, but
-- if rows existed we'd have to backfill first. Kept idempotent.
ALTER TABLE impersonation_sessions
    ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- If the column exists but is nullable (e.g. a partial prior run), and
-- the table is empty, tighten it. This is a no-op if already NOT NULL.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'impersonation_sessions'
          AND column_name = 'expires_at'
          AND is_nullable = 'YES'
    ) AND NOT EXISTS (SELECT 1 FROM impersonation_sessions) THEN
        ALTER TABLE impersonation_sessions
            ALTER COLUMN expires_at SET NOT NULL;
    END IF;
END $$;
