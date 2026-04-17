-- 0099_bond_import_mappings.sql
-- Why: Support express-interest data migration by tracking source-to-Bond entity mappings. Prevents duplicate imports, enables audit trail, allows future import-from-other-systems workflows.
-- Client impact: additive only. New table for import tracking.

CREATE TABLE IF NOT EXISTS bond_import_mappings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_system       VARCHAR(60) NOT NULL,
    source_id           VARCHAR(255) NOT NULL,
    bond_entity_type    VARCHAR(20) NOT NULL,
    bond_entity_id      UUID NOT NULL,
    imported_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, source_system, source_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bond_import_mappings_entity_type_check') THEN
    ALTER TABLE bond_import_mappings
      ADD CONSTRAINT bond_import_mappings_entity_type_check
      CHECK (bond_entity_type IN ('contact', 'company', 'deal'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bond_import_mappings_org ON bond_import_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_bond_import_mappings_source ON bond_import_mappings(organization_id, source_system, source_id);
CREATE INDEX IF NOT EXISTS idx_bond_import_mappings_entity ON bond_import_mappings(bond_entity_type, bond_entity_id);
