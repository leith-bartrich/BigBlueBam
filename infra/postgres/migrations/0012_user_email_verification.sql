-- ─────────────────────────────────────────────────────────────────────────
-- 0012_user_email_verification.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: Phase 4 of user management introduces admin-initiated email changes
--      with a verification round-trip (see docs/user-management-plan.md
--      §3a + §8). The new email address is staged in `pending_email` and
--      activated only after the user clicks the token link delivered to
--      the NEW address, matching the `helpdesk_users` pattern. This
--      prevents admins from silently hijacking a login identity and
--      gives users a single authoritative "is this address confirmed?"
--      flag that future SSO/notification flows can branch on.
-- Client impact: additive only. Every existing user is retroactively
--      `email_verified = true` — they have already logged in successfully,
--      so treat their current address as verified. The three pending-*
--      columns are NULL when no change is in flight, so legacy login /
--      profile code paths continue to function unchanged.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT true;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS pending_email varchar(320);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verification_token text;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verification_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS email_verification_token_hash_idx
    ON users (email_verification_token)
    WHERE email_verification_token IS NOT NULL;
