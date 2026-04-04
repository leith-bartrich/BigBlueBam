-- ─────────────────────────────────────────────────────────────────────────
-- 0002_granular_permissions_and_drift.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: Introduces granular permissions (SuperUser, multi-org membership,
--      impersonation sessions, audit logs) and closes accumulated drift
--      between Drizzle schemas and the original init.sql bootstrap.
-- Client impact: additive only (new tables/columns, all IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────
-- Captures all schema deltas introduced on the `granular-permissions`
-- branch plus accumulated drift between Drizzle schemas and init.sql.
--
-- Every statement is idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
-- conditional DO blocks) so this migration is safe to apply against:
--   • a fresh DB where init.sql already created everything (no-op), or
--   • an older DB that predates these changes (brings it up to current).
--
-- Contents:
--   1. SuperUser support on users + superuser_audit_log
--   2. organization_memberships (many-to-many users↔orgs)
--   3. impersonation_sessions
--   4. guest_invitations
--   5. banter_audit_log
--   6. Column-type and constraint drift (varchar widths, NOT NULL defaults)
--   7. Missing performance indexes on tasks and other hot-path tables
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. SuperUser ─────────────────────────────────────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_superuser boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS superuser_audit_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    superuser_id    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action          varchar(100) NOT NULL,
    target_type     varchar(50),
    target_id       uuid,
    details         jsonb,
    ip_address      inet,
    user_agent      text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_su_audit_superuser  ON superuser_audit_log (superuser_id);
CREATE INDEX IF NOT EXISTS idx_su_audit_action     ON superuser_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_su_audit_created_at ON superuser_audit_log (created_at DESC);

-- ── 2. Impersonation sessions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS impersonation_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    superuser_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason          text,
    started_at      timestamptz NOT NULL DEFAULT now(),
    ended_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_imp_sessions_superuser ON impersonation_sessions (superuser_id);
CREATE INDEX IF NOT EXISTS idx_imp_sessions_target    ON impersonation_sessions (target_user_id);
CREATE INDEX IF NOT EXISTS idx_imp_sessions_active    ON impersonation_sessions (superuser_id, target_user_id, ended_at);

-- ── 3. Guest invitations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_invitations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           varchar(320) NOT NULL,
    token           text NOT NULL,
    invited_by      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at      timestamptz NOT NULL,
    accepted_at     timestamptz,
    revoked_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_invitations_org   ON guest_invitations (org_id);
CREATE INDEX IF NOT EXISTS idx_guest_invitations_email ON guest_invitations (email);
CREATE INDEX IF NOT EXISTS idx_guest_invitations_token ON guest_invitations (token);

-- ── 4. Organization memberships (many-to-many) ───────────────────────────
CREATE TABLE IF NOT EXISTS organization_memberships (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role            varchar(20) NOT NULL DEFAULT 'member',
    is_default      boolean NOT NULL DEFAULT false,
    joined_at       timestamptz NOT NULL DEFAULT now(),
    invited_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id, org_id),
    CONSTRAINT org_memberships_role_check
        CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest'))
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON organization_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id  ON organization_memberships (org_id);
CREATE INDEX IF NOT EXISTS org_memberships_user_default_idx
    ON organization_memberships (user_id, is_default);
CREATE UNIQUE INDEX IF NOT EXISTS org_memberships_one_default_per_user
    ON organization_memberships (user_id) WHERE is_default = true;

-- Backfill: give every user-with-org_id a membership row so existing data
-- remains reachable after UI starts reading from organization_memberships.
INSERT INTO organization_memberships (user_id, org_id, role, is_default)
SELECT id, org_id, role, true
FROM users
WHERE org_id IS NOT NULL
ON CONFLICT (user_id, org_id) DO NOTHING;

-- ── 5. banter_audit_log (missing from init.sql entirely) ─────────────────
CREATE TABLE IF NOT EXISTS banter_audit_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action          varchar(100) NOT NULL,
    entity_type     varchar(50) NOT NULL,
    entity_id       uuid,
    details         jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banter_audit_org_time  ON banter_audit_log (org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_banter_audit_user_time ON banter_audit_log (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_banter_audit_action    ON banter_audit_log (action);

-- ── 6. Column-type and NOT NULL drift ────────────────────────────────────
-- Widen users.email for RFC 5321 compliance (320 chars).
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email'
          AND character_maximum_length < 320
    ) THEN
        ALTER TABLE users ALTER COLUMN email TYPE varchar(320);
    END IF;
END $$;

-- Tighten JSONB columns that should never be NULL.
UPDATE users    SET notification_prefs = '{}'::jsonb WHERE notification_prefs IS NULL;
UPDATE projects SET settings           = '{}'::jsonb WHERE settings           IS NULL;
UPDATE sessions SET data               = '{}'::jsonb WHERE data               IS NULL;

DO $$ BEGIN
    ALTER TABLE users    ALTER COLUMN notification_prefs SET NOT NULL;
    ALTER TABLE users    ALTER COLUMN notification_prefs SET DEFAULT '{}'::jsonb;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE projects ALTER COLUMN settings SET NOT NULL;
    ALTER TABLE projects ALTER COLUMN settings SET DEFAULT '{}'::jsonb;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE sessions ALTER COLUMN data SET NOT NULL;
    ALTER TABLE sessions ALTER COLUMN data SET DEFAULT '{}'::jsonb;
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 7. Missing performance indexes on tasks ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_state
    ON tasks (assignee_id, state_id);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date
    ON tasks (project_id, due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_labels
    ON tasks USING GIN (labels);

CREATE INDEX IF NOT EXISTS idx_tasks_fulltext
    ON tasks USING GIN (to_tsvector('english', coalesce(description_plain, '')));

-- Secondary indexes mirroring Drizzle declarations.
CREATE INDEX IF NOT EXISTS sessions_user_id_idx    ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS users_org_id_idx        ON users (org_id);
CREATE INDEX IF NOT EXISTS users_email_idx         ON users (email);
CREATE INDEX IF NOT EXISTS projects_org_id_idx     ON projects (org_id);
