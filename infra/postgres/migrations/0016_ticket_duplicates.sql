-- ─────────────────────────────────────────────────────────────────────────
-- 0016_ticket_duplicates.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Why: HB-55 adds first-class duplicate/merge support for tickets.
--      Customers sometimes file the same issue multiple times; agents need
--      a way to (a) flag a ticket as a duplicate of another (customer-side
--      annotation only) and (b) actually merge the conversation into a
--      primary ticket (agent-side data move). This migration introduces
--      the three columns required to model both flows: `duplicate_of`
--      (FK to the primary ticket), `merged_at` (timestamp set only on a
--      real agent merge, NULL for customer-side flags), and `merged_by`
--      (the agent's BBB user id on merge). A partial index on
--      `duplicate_of` keeps the "find my duplicates" reverse lookup fast
--      on the primary ticket detail view without bloating the index with
--      NULL rows (the vast majority of tickets).
-- Client impact: additive only. All three columns are nullable with no
--      default, so existing rows are unaffected and existing SELECTs
--      ignore the new columns. No backfill required. The foreign key
--      uses ON DELETE SET NULL so deleting a primary ticket does not
--      cascade into deleting its duplicates — they simply lose the
--      pointer.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES tickets(id) ON DELETE SET NULL;

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS merged_at timestamptz;

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS merged_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_duplicate_of
    ON tickets (duplicate_of) WHERE duplicate_of IS NOT NULL;
