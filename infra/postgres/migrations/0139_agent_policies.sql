-- 0139_agent_policies.sql
-- Why: Wave 5 AGENTIC_TODO §15. Adds operator kill-switches and per-agent tool
--   allowlists so every service-account tool invocation can pass through a single
--   canonical policy check and fail-closed when an operator disables an agent or
--   scopes its tool surface. Before this migration each runner invented its own
--   kill-switch shape; after, the MCP register-tool wrapper enforces a single
--   policy row per agent.
-- Client impact: additive only. A permissive default row (enabled=true,
--   allowed_tools=ARRAY['*']) is inserted for every existing users.kind IN
--   ('agent','service') account, so the kill-switch stays inert until an admin
--   flips `enabled` or trims `allowed_tools`.

-- ──────────────────────────────────────────────────────────────────────
-- agent_policies
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_policies (
    agent_user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    org_id                 uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    enabled                boolean NOT NULL DEFAULT true,
    allowed_tools          text[] NOT NULL DEFAULT ARRAY[]::text[],
    channel_subscriptions  uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
    rate_limit_override    integer,
    notes                  text,
    updated_at             timestamptz NOT NULL DEFAULT now(),
    updated_by             uuid NOT NULL REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_policies_org
    ON agent_policies(org_id);
-- Partial index on disabled rows so the "who is currently disabled" query the
-- MCP middleware runs against this table stays cheap as the population grows.
CREATE INDEX IF NOT EXISTS idx_agent_policies_enabled
    ON agent_policies(enabled) WHERE enabled = false;

-- RLS (follows the pattern from 0116_rls_foundation.sql and 0132_entity_links.sql).
-- Enabled unconditionally; the app role still has BYPASSRLS in soft-rollout mode,
-- so policies are advisory until BBB_RLS_ENFORCE=1 flips the role.
ALTER TABLE agent_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_policies_org_isolation ON agent_policies;
CREATE POLICY agent_policies_org_isolation ON agent_policies
  FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- updated_at trigger. set_updated_at() is provided by 0000_init.sql.
DROP TRIGGER IF EXISTS agent_policies_set_updated_at ON agent_policies;
CREATE TRIGGER agent_policies_set_updated_at
    BEFORE UPDATE ON agent_policies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────
-- Permissive default backfill
-- ──────────────────────────────────────────────────────────────────────
--
-- Every existing agent/service user gets a row with enabled=true and
-- allowed_tools=ARRAY['*'] so the kill-switch is inert until an operator
-- flips it. updated_by is set to the agent's own user id (self-stamped at
-- backfill time); future human edits will overwrite updated_by with the
-- real actor.
INSERT INTO agent_policies (agent_user_id, org_id, enabled, allowed_tools, updated_by)
SELECT u.id, u.org_id, true, ARRAY['*'], u.id
  FROM users u
 WHERE u.kind IN ('agent','service')
ON CONFLICT (agent_user_id) DO NOTHING;
