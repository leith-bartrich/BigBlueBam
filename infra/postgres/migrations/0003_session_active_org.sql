-- ─────────────────────────────────────────────────────────────────────────
-- 0003_session_active_org.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: Persist the user's active organization server-side on the session
--      row so org context is stable across WebSocket connections and
--      background jobs rather than being re-derived from a request header.
-- Client impact: additive only (new nullable column on sessions).
-- ─────────────────────────────────────────────────────────────────────────
-- Adds active_org_id to sessions so that a user's currently-selected
-- organization is persisted server-side per session rather than being
-- derived every request from the X-Org-Id header.
--
-- This enables:
--   • Switching active org via a dedicated endpoint that writes to the
--     session row instead of requiring every client request to echo the
--     X-Org-Id header.
--   • Session-stable org context across WebSocket connections and
--     background jobs that reuse the session id.
--
-- All statements are idempotent (IF NOT EXISTS) so this migration is
-- safe to re-run and safe against fresh DBs where init.sql already
-- defines active_org_id.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS active_org_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sessions_active_org_id_idx
    ON sessions (active_org_id);
