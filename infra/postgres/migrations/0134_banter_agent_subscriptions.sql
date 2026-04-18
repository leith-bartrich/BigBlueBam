-- 0134_banter_agent_subscriptions.sql
-- Why: Wave 5 AGENTIC_TODO §1. First-class agent message-pattern subscriptions
--   so listener-style agents no longer poll. Pattern matching runs in a worker
--   consumer that fires banter.message.matched events for Bolt routing. Also
--   adds a per-channel agent_subscription_policy so channel admins can control
--   which agents may subscribe and whether any subscriptions are allowed at
--   all.
-- Client impact: additive only. A permissive default agent_subscription_policy
--   (allow=false, allowed_agent_ids=[]) is set on every existing channel, so
--   the feature stays off until a channel admin opts in.

-- ──────────────────────────────────────────────────────────────────────
-- banter_agent_subscriptions
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS banter_agent_subscriptions (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscriber_user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id              uuid NOT NULL REFERENCES banter_channels(id) ON DELETE CASCADE,
    pattern_spec            jsonb NOT NULL,
    opted_in_by             uuid NOT NULL REFERENCES users(id),
    opted_in_at             timestamptz NOT NULL DEFAULT now(),
    disabled_at             timestamptz,
    last_matched_at         timestamptz,
    match_count             integer NOT NULL DEFAULT 0,
    rate_limit_per_hour     integer NOT NULL DEFAULT 30,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness is per-active subscription: the same (subscriber, channel,
-- pattern) can exist again after the prior one is disabled. We md5() the
-- JSONB text form so the index key stays bounded; a subscriber looking to
-- confirm "do I already have this sub?" re-hashes the same canonicalized
-- spec from the app layer.
CREATE UNIQUE INDEX IF NOT EXISTS uq_banter_agent_sub_actor_chan_spec
    ON banter_agent_subscriptions (subscriber_user_id, channel_id, md5(pattern_spec::text))
    WHERE disabled_at IS NULL;

-- Per-channel hot path: the worker consumer loads all active subs for a
-- channel on every incoming message, so this partial index keeps that
-- lookup cheap.
CREATE INDEX IF NOT EXISTS idx_banter_agent_sub_channel_active
    ON banter_agent_subscriptions (channel_id) WHERE disabled_at IS NULL;

-- Per-subscriber lookup for banter_list_subscriptions and for rate-limit
-- ceiling checks across all of a subscriber's subs.
CREATE INDEX IF NOT EXISTS idx_banter_agent_sub_subscriber_active
    ON banter_agent_subscriptions (subscriber_user_id) WHERE disabled_at IS NULL;

-- RLS (follows 0116_rls_foundation.sql / 0132_entity_links.sql). Policies
-- are advisory until BBB_RLS_ENFORCE=1 flips the role to NOBYPASSRLS.
ALTER TABLE banter_agent_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS banter_agent_subs_org_isolation ON banter_agent_subscriptions;
CREATE POLICY banter_agent_subs_org_isolation ON banter_agent_subscriptions
  FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- updated_at trigger; set_updated_at() is provided by 0000_init.sql.
DROP TRIGGER IF EXISTS banter_agent_subs_set_updated_at ON banter_agent_subscriptions;
CREATE TRIGGER banter_agent_subs_set_updated_at
    BEFORE UPDATE ON banter_agent_subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────
-- banter_channels.agent_subscription_policy
-- ──────────────────────────────────────────────────────────────────────
--
-- Shape:
--   {
--     "allow": boolean,                  -- master switch; false blocks all subs
--     "allowed_agent_ids": uuid[]        -- optional allowlist; empty means "any agent with an agent_policies row"
--   }
--
-- Default is { allow: false, allowed_agent_ids: [] } so channels stay
-- opt-in; a channel admin must flip allow=true before any agent can
-- subscribe to pattern matches.

ALTER TABLE banter_channels
    ADD COLUMN IF NOT EXISTS agent_subscription_policy jsonb
        NOT NULL DEFAULT '{"allow": false, "allowed_agent_ids": []}'::jsonb;
