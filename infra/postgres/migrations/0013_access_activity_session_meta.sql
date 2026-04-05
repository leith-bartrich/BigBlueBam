-- ─────────────────────────────────────────────────────────────────────────
-- 0013_access_activity_session_meta.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: Phase 3+5 of user management add three independent capabilities:
--      (a) a `force_password_change` flag checked at login so admins can
--      issue temporary passwords that must be rotated on first use;
--      (b) session metadata columns (created_at, last_used_at, ip_address,
--      user_agent) powering the Sessions tab — currently rendering as null
--      because the columns don't exist; and (c) a permanent `login_history`
--      table recording every auth attempt (success or failure) for
--      security review. Email is denormalized on login_history so failed
--      attempts against non-existent users survive even when user_id is
--      NULL.
-- Client impact: additive only. New users columns default sensibly
--      (force_password_change=false, session created_at=now()). Existing
--      sessions get now() as created_at; last_used_at/ip_address/user_agent
--      are NULL until the auth plugin populates them on next use. The
--      login_history table starts empty and has no TTL — a future trimmer
--      job can prune old rows.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false;

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS ip_address inet;

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS user_agent text;

CREATE TABLE IF NOT EXISTS login_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    email text NOT NULL,
    ip_address inet,
    user_agent text,
    success boolean NOT NULL,
    failure_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_time ON login_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_email_time ON login_history (email, created_at DESC);
