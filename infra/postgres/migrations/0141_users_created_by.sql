-- 0141_users_created_by.sql
-- Why: Service accounts are about to become user-mintable via the REST
--   API (POST /auth/service-accounts). We need provenance so the UI can
--   show "who made this agent" and so delegation checks can compare the
--   creator's permissions against the agent's. Also fixes a latent bug
--   where the CLI createServiceAccount never set users.kind='service',
--   leaving pre-existing CLI-created service accounts invisible to the
--   §15 kill switch (no agent_policies backfill row was inserted, so
--   checkPolicy returned AGENT_DISABLED on the very first tool call).
-- Client impact: additive only. New column is nullable (NULL for all
--   existing rows, including historical service accounts whose creator
--   is unknown). Backfill flips kind='service' for users whose email
--   matches the CLI-minted 'svc+<name>-<org>@system.local' pattern AND
--   who are currently stuck on kind='human', then inserts a permissive
--   agent_policies row for any such account that doesn't already have
--   one. No human user is touched.

-- ──────────────────────────────────────────────────────────────────────
-- Column: users.created_by
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_created_by_idx ON users(created_by)
  WHERE created_by IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────
-- Backfill: fix CLI-minted service accounts stuck on kind='human'
-- ──────────────────────────────────────────────────────────────────────

UPDATE users
SET kind = 'service'
WHERE kind = 'human'
  AND email LIKE 'svc+%@system.local';

-- ──────────────────────────────────────────────────────────────────────
-- Backfill: ensure every agent/service user has an agent_policies row
-- ──────────────────────────────────────────────────────────────────────
-- Migration 0139 already ran this for every agent/service user that
-- existed at that point. This top-up covers any that slipped through
-- because of the kind='human' bug we just corrected above, and anyone
-- added between 0139 and now via a code path that forgot to insert a
-- policy row. Self-stamped updated_by=u.id; the UI will reattribute
-- once a human actually touches the policy.

INSERT INTO agent_policies (
  agent_user_id,
  org_id,
  enabled,
  allowed_tools,
  channel_subscriptions,
  updated_by
)
SELECT
  u.id,
  u.org_id,
  true,
  ARRAY['*']::text[],
  ARRAY[]::uuid[],
  u.id
FROM users u
WHERE u.kind IN ('agent', 'service')
  AND NOT EXISTS (
    SELECT 1 FROM agent_policies p WHERE p.agent_user_id = u.id
  );
