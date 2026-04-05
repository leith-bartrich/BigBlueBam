-- ─────────────────────────────────────────────────────────────────────────
-- 0014_helpdesk_system_user.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: HB-7 closes the biggest P0 architectural gap between helpdesk-api
--      and BBB: today helpdesk-api writes directly to BBB's `tasks`,
--      `comments`, and `activity_log` tables via the shared Postgres
--      connection, with no service auth, no distinguishable actor, no rate
--      limiting, and no enforceable contract. This migration seeds the
--      dedicated `helpdesk-system` BBB user that all helpdesk-originated
--      writes will now be attributed to, once those writes are routed
--      through the new /internal/helpdesk/* endpoints on BBB API.
--
--      Because users.org_id is NOT NULL, we also seed a sentinel
--      "Helpdesk System" organization with a fixed UUID to host the
--      system user. The system user will never log in (password_hash='!'
--      is unverifiable by Argon2id) and is never a project member — it
--      only exists so that FK-bearing rows (activity_log.actor_id,
--      comments.author_id) have a valid, identifiable owner.
-- Client impact: additive only. No existing row is modified. The sentinel
--      org and user use fixed UUIDs and ON CONFLICT DO NOTHING so
--      re-running the migration is a no-op. The org is not exposed
--      through any list endpoint and has no memberships.
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO organizations (id, name, slug, plan, settings)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Helpdesk System',
    '__helpdesk_system__',
    'free',
    '{"internal": true, "hidden": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (
    id,
    org_id,
    email,
    display_name,
    password_hash,
    role,
    is_active,
    is_superuser,
    email_verified
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'system-helpdesk@bigbluebam.internal',
    'Helpdesk System',
    '!',
    'member',
    true,
    false,
    true
)
ON CONFLICT (id) DO NOTHING;

-- Secondary guard: if a prior environment already has a row on the
-- email UNIQUE constraint but with a different id, do nothing rather
-- than fail the migration.
INSERT INTO users (
    id,
    org_id,
    email,
    display_name,
    password_hash,
    role,
    is_active,
    is_superuser,
    email_verified
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'system-helpdesk@bigbluebam.internal',
    'Helpdesk System',
    '!',
    'member',
    true,
    false,
    true
)
ON CONFLICT (email) DO NOTHING;
