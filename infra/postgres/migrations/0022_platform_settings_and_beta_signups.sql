-- 0022_platform_settings_and_beta_signups.sql
-- Why: A SuperUser needs a switch to disable public self-signup across BBB
--   and Helpdesk while the product is in limited beta. When the switch is on,
--   the "Create one" links on the login pages route to a beta-gate page that
--   points prospects at a notify-me form. Submissions to that form live in
--   `beta_signup_notifications` and are reviewable / CSV-exportable by
--   SuperUsers.
-- Client impact: additive only — new tables, no breakage of existing APIs.
--   Default row in platform_settings has public_signup_disabled=false, so
--   behavior does not change until a SuperUser flips the toggle.

-- Singleton settings row. Enforced via CHECK constraint: id is always 1.
CREATE TABLE IF NOT EXISTS platform_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    public_signup_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Seed the single row if it does not already exist. ON CONFLICT makes this
-- idempotent on re-run.
INSERT INTO platform_settings (id, public_signup_disabled)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS beta_signup_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS beta_signup_notifications_created_at_idx
    ON beta_signup_notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS beta_signup_notifications_email_idx
    ON beta_signup_notifications (LOWER(email));
