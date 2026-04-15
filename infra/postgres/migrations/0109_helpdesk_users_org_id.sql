-- 0109_helpdesk_users_org_id.sql
-- Why: HB-5 multi-tenant isolation. Helpdesk currently shares a single global user pool. Adding org_id allows customers to register with different BBB orgs using the same email.
-- Client impact: expand-contract step 1 of 2. New nullable column; backfill attempted from existing ticket linkage; contract step enforces NOT NULL in 0110.

ALTER TABLE helpdesk_users ADD COLUMN IF NOT EXISTS org_id UUID;

CREATE INDEX IF NOT EXISTS idx_helpdesk_users_org_id ON helpdesk_users (org_id);

UPDATE helpdesk_users hu
SET org_id = (
  SELECT p.org_id
  FROM tickets t
  JOIN projects p ON p.id = t.project_id
  WHERE t.helpdesk_user_id = hu.id
  LIMIT 1
)
WHERE hu.org_id IS NULL
  AND EXISTS (SELECT 1 FROM tickets t WHERE t.helpdesk_user_id = hu.id);
