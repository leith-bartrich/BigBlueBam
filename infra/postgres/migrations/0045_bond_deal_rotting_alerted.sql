-- 0045_bond_deal_rotting_alerted.sql
-- Why: Idempotency marker for the daily stale-deal alert worker. Without this
--      column the job would re-emit bond.deal.rotting events for the same deal
--      every run. The worker fires only when rotting_alerted_at IS NULL or is
--      older than stage_entered_at, so moving a deal to a new stage naturally
--      resets the alert cycle.
-- Client impact: additive only. Existing rows default to NULL, which causes
--                the first eligible alert to fire as expected.

ALTER TABLE bond_deals
  ADD COLUMN IF NOT EXISTS rotting_alerted_at TIMESTAMPTZ;
