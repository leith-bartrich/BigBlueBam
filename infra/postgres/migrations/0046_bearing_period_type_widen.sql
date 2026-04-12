-- 0046_bearing_period_type_widen.sql
-- Why: The bearing_periods.period_type CHECK constraint (added in 0029) only
--      allowed annual/semi_annual/quarterly/monthly/custom, but the shared
--      Zod enum BearingPeriodType in @bigbluebam/shared (and the Bearing SPA
--      UI) also emits year/quarter/half as first-class values. Sending any of
--      those produced HTTP 500 with PostgresError 23514 instead of a clean
--      validation response. This widens the DB constraint to match the Zod
--      enum exactly, treating year/quarter/half as legal synonyms of
--      annual/quarterly/semi_annual.
-- Client impact: additive only. No existing row can violate the new
--                constraint (superset of the old set). No application or
--                frontend code change required — unblocks API calls that
--                were previously rejected at the DB layer.

DO $$ BEGIN
  ALTER TABLE bearing_periods DROP CONSTRAINT IF EXISTS bearing_periods_period_type_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bearing_periods ADD CONSTRAINT bearing_periods_period_type_check
    CHECK (period_type IN ('annual', 'semi_annual', 'quarterly', 'monthly', 'custom', 'year', 'quarter', 'half'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
