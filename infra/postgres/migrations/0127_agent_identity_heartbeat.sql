-- 0127_agent_identity_heartbeat.sql
-- Why: Wave 1 of the agentic build-out (AGENTIC_TODO §10). Introduces a
--   first-class actor_type enum on users and activity_log so queries can
--   distinguish human vs agent vs service mutations without relying on
--   email-pattern inference, and adds an agent_runners table so the
--   platform can track which runtimes are alive and what capabilities
--   they advertise.
-- Client impact: additive only. Existing rows default to 'human'; the
--   svc+*@system.local and bbam_svc-prefixed accounts are backfilled to
--   'service'. No columns are dropped or made more strict.

-- ──────────────────────────────────────────────────────────────────────
-- ENUM: actor_type
-- ──────────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE actor_type AS ENUM ('human', 'agent', 'service');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────────
-- users.kind
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS kind actor_type NOT NULL DEFAULT 'human';

-- Backfill: anything with an svc+*@system.local email OR any user that owns
-- a bbam_svc_-prefixed api_key is a service account. Agents are a separate
-- kind the platform will grow into; no heuristic backfills them yet.
UPDATE users u
   SET kind = 'service'
 WHERE u.kind = 'human'
   AND (
        u.email LIKE 'svc+%@system.local'
     OR EXISTS (
          SELECT 1 FROM api_keys k
           WHERE k.user_id = u.id
             AND k.key_prefix LIKE 'bbam_svc%'
        )
   );

CREATE INDEX IF NOT EXISTS users_kind_idx ON users(kind);

-- ──────────────────────────────────────────────────────────────────────
-- activity_log.actor_type
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS actor_type actor_type NOT NULL DEFAULT 'human';

-- Backfill existing rows from the current users.kind so historical data
-- already differentiates service-account writes from human writes. Only
-- touches rows that are still at the default 'human' to keep this
-- idempotent under re-runs.
UPDATE activity_log al
   SET actor_type = u.kind
  FROM users u
 WHERE al.actor_id = u.id
   AND u.kind <> 'human'
   AND al.actor_type = 'human';

CREATE INDEX IF NOT EXISTS idx_activity_actor_type_time
  ON activity_log(actor_type, created_at);

-- ──────────────────────────────────────────────────────────────────────
-- agent_runners
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_runners (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name               text NOT NULL,
    version            text,
    capabilities       jsonb NOT NULL DEFAULT '[]'::jsonb,
    last_heartbeat_at  timestamptz,
    first_seen_at      timestamptz NOT NULL DEFAULT now(),
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_runners_user_id_uniq
  ON agent_runners(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runners_org_id
  ON agent_runners(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_runners_last_heartbeat
  ON agent_runners(last_heartbeat_at DESC NULLS LAST);

-- RLS (follows the pattern from 0116_rls_foundation.sql). Enabled
-- unconditionally; the app role still has BYPASSRLS in soft-rollout mode,
-- so policies are advisory until BBB_RLS_ENFORCE=1 flips the role.
ALTER TABLE agent_runners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_runners_org_isolation ON agent_runners;
CREATE POLICY agent_runners_org_isolation ON agent_runners
  FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);
