-- 0132_entity_links.sql
-- Why: Wave 4 AGENTIC_TODO §16. Durable cross-app entity linking table so agents
--   can query "everything linked to this entity" in one call without having to
--   know each app's per-app FK column. Existing per-app FKs stay; this table is
--   additive and backfilled from them.
-- Client impact: additive only. Backfill is idempotent via ON CONFLICT.

-- ──────────────────────────────────────────────────────────────────────
-- ENUM: entity_link_kind
-- ──────────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE entity_link_kind AS ENUM (
        'related_to',
        'duplicates',
        'blocks',
        'references',
        'parent_of',
        'derived_from'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────────
-- entity_links
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS entity_links (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    src_type    text NOT NULL,
    src_id      uuid NOT NULL,
    dst_type    text NOT NULL,
    dst_id      uuid NOT NULL,
    link_kind   entity_link_kind NOT NULL,
    created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS entity_links_unique
    ON entity_links(src_type, src_id, dst_type, dst_id, link_kind);
CREATE INDEX IF NOT EXISTS idx_entity_links_src
    ON entity_links(src_type, src_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_dst
    ON entity_links(dst_type, dst_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_org_created
    ON entity_links(org_id, created_at DESC);

-- RLS: org isolation via GUC, matches the pattern in 0116_rls_foundation.sql
-- and 0128_agent_proposals.sql. Policies are advisory until BBB_RLS_ENFORCE=1
-- flips the app role to NOBYPASSRLS.
ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entity_links_org_isolation ON entity_links;
CREATE POLICY entity_links_org_isolation ON entity_links
    FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────────────
-- Backfill from existing per-app FKs. Each INSERT is idempotent via the
-- ON CONFLICT clause on the unique index above. A backfill row's src/dst
-- types are stable and documented so future reads have a consistent shape.
-- ──────────────────────────────────────────────────────────────────────

-- 1. tickets.task_id -> helpdesk.ticket derived_from bam.task
--    Join through tasks -> projects to get the org_id. helpdesk tickets
--    themselves do not carry org_id; the project is the canonical org source.
INSERT INTO entity_links (org_id, src_type, src_id, dst_type, dst_id, link_kind)
SELECT p.org_id, 'helpdesk.ticket', t.id, 'bam.task', t.task_id, 'derived_from'::entity_link_kind
FROM tickets t
JOIN tasks bt ON bt.id = t.task_id
JOIN projects p ON p.id = bt.project_id
WHERE t.task_id IS NOT NULL
ON CONFLICT (src_type, src_id, dst_type, dst_id, link_kind) DO NOTHING;

-- 2. bill_invoices.bond_deal_id -> bill.invoice derived_from bond.deal
INSERT INTO entity_links (org_id, src_type, src_id, dst_type, dst_id, link_kind)
SELECT bi.organization_id, 'bill.invoice', bi.id, 'bond.deal', bi.bond_deal_id, 'derived_from'::entity_link_kind
FROM bill_invoices bi
WHERE bi.bond_deal_id IS NOT NULL
ON CONFLICT (src_type, src_id, dst_type, dst_id, link_kind) DO NOTHING;

-- 3. bill_invoices.project_id -> bill.invoice references bam.project
INSERT INTO entity_links (org_id, src_type, src_id, dst_type, dst_id, link_kind)
SELECT bi.organization_id, 'bill.invoice', bi.id, 'bam.project', bi.project_id, 'references'::entity_link_kind
FROM bill_invoices bi
WHERE bi.project_id IS NOT NULL
ON CONFLICT (src_type, src_id, dst_type, dst_id, link_kind) DO NOTHING;

-- 4. bill_clients.bond_company_id -> bill.client references bond.company
INSERT INTO entity_links (org_id, src_type, src_id, dst_type, dst_id, link_kind)
SELECT bc.organization_id, 'bill.client', bc.id, 'bond.company', bc.bond_company_id, 'references'::entity_link_kind
FROM bill_clients bc
WHERE bc.bond_company_id IS NOT NULL
ON CONFLICT (src_type, src_id, dst_type, dst_id, link_kind) DO NOTHING;

-- 5. book_booking_pages.bam_project_id -> book.booking_page references bam.project
INSERT INTO entity_links (org_id, src_type, src_id, dst_type, dst_id, link_kind)
SELECT bp.organization_id, 'book.booking_page', bp.id, 'bam.project', bp.bam_project_id, 'references'::entity_link_kind
FROM book_booking_pages bp
WHERE bp.bam_project_id IS NOT NULL
ON CONFLICT (src_type, src_id, dst_type, dst_id, link_kind) DO NOTHING;

-- 6. brief_task_links -> brief.document references bam.task
--    Join brief_documents to recover org_id (brief_task_links has none).
INSERT INTO entity_links (org_id, src_type, src_id, dst_type, dst_id, link_kind)
SELECT bd.org_id, 'brief.document', btl.document_id, 'bam.task', btl.task_id, 'references'::entity_link_kind
FROM brief_task_links btl
JOIN brief_documents bd ON bd.id = btl.document_id
ON CONFLICT (src_type, src_id, dst_type, dst_id, link_kind) DO NOTHING;

-- 7. brief_beacon_links -> brief.document references beacon.entry
INSERT INTO entity_links (org_id, src_type, src_id, dst_type, dst_id, link_kind)
SELECT bd.org_id, 'brief.document', bbl.document_id, 'beacon.entry', bbl.beacon_id, 'references'::entity_link_kind
FROM brief_beacon_links bbl
JOIN brief_documents bd ON bd.id = bbl.document_id
ON CONFLICT (src_type, src_id, dst_type, dst_id, link_kind) DO NOTHING;

-- 8. bill_expenses.project_id -> bill.expense references bam.project
INSERT INTO entity_links (org_id, src_type, src_id, dst_type, dst_id, link_kind)
SELECT be.organization_id, 'bill.expense', be.id, 'bam.project', be.project_id, 'references'::entity_link_kind
FROM bill_expenses be
WHERE be.project_id IS NOT NULL
ON CONFLICT (src_type, src_id, dst_type, dst_id, link_kind) DO NOTHING;

-- 9. bill_line_items.task_id -> bill.line_item references bam.task
--    Join bill_invoices for org_id (bill_line_items has none).
INSERT INTO entity_links (org_id, src_type, src_id, dst_type, dst_id, link_kind)
SELECT bi.organization_id, 'bill.line_item', bli.id, 'bam.task', bli.task_id, 'references'::entity_link_kind
FROM bill_line_items bli
JOIN bill_invoices bi ON bi.id = bli.invoice_id
WHERE bli.task_id IS NOT NULL
ON CONFLICT (src_type, src_id, dst_type, dst_id, link_kind) DO NOTHING;
