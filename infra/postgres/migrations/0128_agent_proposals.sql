-- 0128_agent_proposals.sql
-- Why: Wave 2 of AGENTIC_TODO §9. Replaces ad-hoc Banter-thread / task-comment HITL with a
--   durable proposals registry where agents register proposed destructive or human-gated
--   actions and humans get a single inbox to approve, reject, or mark revising.
-- Client impact: additive only. New table + enum + indexes + RLS. No existing data touched.
--   Legacy /v1/approvals event producer in apps/api/src/routes/approval.routes.ts stays untouched.

-- ──────────────────────────────────────────────────────────────────────
-- ENUM: proposal_status
-- ──────────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE proposal_status AS ENUM (
        'pending',
        'approved',
        'rejected',
        'expired',
        'revoked',
        'revising'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────────
-- agent_proposals
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_proposals (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id            uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    proposer_kind       actor_type NOT NULL,
    proposed_action     text NOT NULL,
    proposed_payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
    subject_type        text,
    subject_id          uuid,
    approver_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    status              proposal_status NOT NULL DEFAULT 'pending',
    decided_at          timestamptz,
    decision_reason     text,
    expires_at          timestamptz NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes optimized for the primary query shapes:
--   - "what am I being asked to approve?" (approver_id + status=pending)
--   - "org-wide pending queue for admins" (org_id + status + created_at)
--   - "what have I proposed recently?" (actor_id + created_at)
--   - "expire sweeps" (expires_at where status=pending)
CREATE INDEX IF NOT EXISTS idx_agent_proposals_approver_status
  ON agent_proposals(approver_id, status)
  WHERE approver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_proposals_org_status_created
  ON agent_proposals(org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_proposals_actor_created
  ON agent_proposals(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_proposals_expires_pending
  ON agent_proposals(expires_at)
  WHERE status = 'pending';

-- updated_at trigger. The set_updated_at() function is defined in 0000_init.sql.
DROP TRIGGER IF EXISTS agent_proposals_set_updated_at ON agent_proposals;
CREATE TRIGGER agent_proposals_set_updated_at
    BEFORE UPDATE ON agent_proposals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS (follows the pattern from 0116_rls_foundation.sql and 0127_agent_identity_heartbeat.sql).
-- Enabled unconditionally; the app role still has BYPASSRLS in soft-rollout mode,
-- so policies are advisory until BBB_RLS_ENFORCE=1 flips the role.
ALTER TABLE agent_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_proposals_org_isolation ON agent_proposals;
CREATE POLICY agent_proposals_org_isolation ON agent_proposals
  FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);
