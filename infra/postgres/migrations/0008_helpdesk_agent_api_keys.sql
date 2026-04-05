-- ─────────────────────────────────────────────────────────────────────────
-- 0008_helpdesk_agent_api_keys.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: HB-28 + HB-49 — the helpdesk "agent" API (BBB employees acting on
--      customer tickets at /helpdesk/api/agents/*) authenticated callers
--      with a SHARED secret (env.AGENT_API_KEY): not hashed at rest, not
--      rotatable without coordinated restart, and no audit trail for
--      "which agent did what" — every call looked identical. The fallback
--      of accepting a BBB session cookie alone (HB-49) was also dropped
--      in the same change because it created a fragile cross-app auth
--      surface with no role check against org_memberships.
--
--      This migration introduces per-agent, hashed, rotatable API keys
--      (same model as the main bbam_ keys in api_keys): one row per
--      issued token, tied to a BBB users.id, Argon2id-hashed at rest,
--      with independent expires_at / revoked_at and last_used_at audit
--      fields. Keys are minted via `cli.js create-helpdesk-agent-key`
--      and presented via the X-Agent-Key header (prefix hdag_).
--
--      env.AGENT_API_KEY remains declared but deprecated; it will be
--      removed once all operators have rotated to per-agent keys and
--      the helpdesk settings route has migrated off it.
--
-- Client impact: additive only (new table, no changes to existing
--      tables). Operators must mint at least one agent key via the CLI
--      before the next helpdesk-api deploy, or agent endpoints will
--      return 401. The settings.routes.ts admin auth still honors the
--      legacy shared key until its own follow-up migration.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS helpdesk_agent_api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bbb_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    key_hash text NOT NULL,
    key_prefix varchar(8) NOT NULL,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_helpdesk_agent_api_keys_key_prefix
    ON helpdesk_agent_api_keys (key_prefix);

CREATE INDEX IF NOT EXISTS idx_helpdesk_agent_api_keys_bbb_user_id
    ON helpdesk_agent_api_keys (bbb_user_id);
