-- 0100_bond_soft_delete.sql
-- Why: Support soft-delete for contacts, deals, and companies with audit trail and 90-day restoration window. Aligns with design spec section 9.
-- Client impact: expand-contract step 1 of 2. Columns default NULL; queries must filter WHERE deleted_at IS NULL.

ALTER TABLE bond_contacts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE bond_deals
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE bond_companies
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bond_contacts_active
  ON bond_contacts(organization_id, deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bond_deals_active
  ON bond_deals(organization_id, deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bond_companies_active
  ON bond_companies(organization_id, deleted_at)
  WHERE deleted_at IS NULL;
