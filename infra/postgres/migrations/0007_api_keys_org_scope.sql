-- ─────────────────────────────────────────────────────────────────────────
-- 0007_api_keys_org_scope.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: P2-8 — API keys were implicitly scoped to the owning user's home
--      org (users.org_id). With multi-org membership (a user can belong
--      to N orgs via organization_memberships), the same key would grant
--      access to every org the owner joins, leaking data across orgs.
--      Bind each API key to exactly one org and enforce that scope on
--      every request.
-- Client impact: additive (new column + index). Existing keys are
--      backfilled from the owner's users.org_id (their historical home
--      org), preserving current behavior. After this migration the auth
--      plugin uses api_keys.org_id as the authoritative org context for
--      Bearer-token requests; X-Org-Id is ignored for non-SuperUser API
--      key auth.
-- ─────────────────────────────────────────────────────────────────────────

-- Add org_id as nullable so we can backfill before tightening to NOT NULL.
ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS org_id uuid
        REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys (org_id);

-- Backfill from the owning user's home org. This matches the implicit
-- scoping that existed before this migration, so live keys keep working.
UPDATE api_keys
   SET org_id = (SELECT org_id FROM users WHERE users.id = api_keys.user_id)
 WHERE org_id IS NULL;

-- Tighten to NOT NULL only if the backfill covered every row. If any
-- row still has NULL org_id (e.g. orphaned key whose user has no
-- org_id), skip and let an operator investigate rather than failing.
DO $$
DECLARE
    unfilled_count bigint;
BEGIN
    SELECT COUNT(*) INTO unfilled_count FROM api_keys WHERE org_id IS NULL;
    IF unfilled_count = 0 THEN
        ALTER TABLE api_keys ALTER COLUMN org_id SET NOT NULL;
    ELSE
        RAISE WARNING
            'api_keys.org_id backfill left % row(s) NULL; leaving column nullable. Investigate and re-run ALTER TABLE ... SET NOT NULL manually.',
            unfilled_count;
    END IF;
END $$;
