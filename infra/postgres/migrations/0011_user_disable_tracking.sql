-- ─────────────────────────────────────────────────────────────────────────
-- 0011_user_disable_tracking.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: The `users.is_active` boolean records *that* a user is disabled but
--      not *when* or *by whom*. Soft-disable is an administrative action
--      (off-boarding, security response, policy violation) where the audit
--      trail matters: support/compliance needs to answer "who disabled
--      this account and when?" without cross-referencing the activity log
--      (which may be rotated or partitioned away). These two columns
--      capture the audit locally on the row.
-- Client impact: additive only (two nullable columns + a partial index on
--      disabled_by for reverse-lookup auditing — "show me every account
--      this admin has disabled").
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS disabled_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_disabled_by
    ON users (disabled_by)
    WHERE disabled_by IS NOT NULL;
