-- 0136_dedupe_decisions.sql
-- Why: Wave 5 AGENTIC_TODO §7. Persistent dedupe-decision memory so
--   "not a duplicate" calls are not re-surfaced, and agents plus humans
--   share the same decision store. The canonical ordered-pair form
--   (id_a < id_b) guarantees a single row per entity pair regardless of
--   which side the caller naturally discovered first.
-- Client impact: additive only.

-- ──────────────────────────────────────────────────────────────────────
-- dedupe_decisions
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dedupe_decisions (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                 uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type            text NOT NULL,
    id_a                   uuid NOT NULL,
    id_b                   uuid NOT NULL,
    decision               text NOT NULL CHECK (decision IN ('duplicate','not_duplicate','needs_review')),
    decided_by             uuid NOT NULL REFERENCES users(id),
    decided_at             timestamptz NOT NULL DEFAULT now(),
    reason                 text,
    confidence_at_decision numeric(5,2),
    resurface_after        timestamptz,
    created_at             timestamptz NOT NULL DEFAULT now(),
    -- Canonical ordered pair: callers MUST sort the two ids before
    -- insert so a given entity pair has exactly one row regardless of
    -- which side was the "source" of the dedupe scan.
    CONSTRAINT dedupe_ordered_pair CHECK (id_a < id_b)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dedupe_pair
    ON dedupe_decisions (entity_type, id_a, id_b);

CREATE INDEX IF NOT EXISTS idx_dedupe_entity_type
    ON dedupe_decisions (entity_type, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_dedupe_org_entity
    ON dedupe_decisions (org_id, entity_type, decided_at DESC);

-- RLS: org isolation via GUC, matches the pattern in 0116_rls_foundation.sql
-- and 0132_entity_links.sql. Advisory until BBB_RLS_ENFORCE=1 flips the app
-- role to NOBYPASSRLS.
ALTER TABLE dedupe_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dedupe_decisions_org_isolation ON dedupe_decisions;
CREATE POLICY dedupe_decisions_org_isolation ON dedupe_decisions
    FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);
