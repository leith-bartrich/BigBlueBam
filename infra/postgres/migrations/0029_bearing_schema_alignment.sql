-- 0029_bearing_schema_alignment.sql
-- Why: Align bearing_kr_links and bearing_kr_snapshots tables with the Drizzle ORM schema
--   that the API actually uses. The original migration (0028) defined columns that differ
--   from what the application code expects (epic_id/project_id/task_query vs target_type/target_id/metadata,
--   and snapshot_date/current_value vs value/recorded_at).
-- Client impact: expand-contract step 1/1

-- ─────────────────────────────────────────────────────────────────────────
-- bearing_kr_links — Replace epic_id, project_id, task_query, weight
--   with target_type, target_id, metadata
-- ─────────────────────────────────────────────────────────────────────────

-- Add new columns
ALTER TABLE bearing_kr_links ADD COLUMN IF NOT EXISTS target_type VARCHAR(30);
ALTER TABLE bearing_kr_links ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE bearing_kr_links ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Drop old unique constraints (may not exist if table was created by ORM)
DO $$ BEGIN
  ALTER TABLE bearing_kr_links DROP CONSTRAINT IF EXISTS bearing_kr_links_key_result_id_epic_id_key;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bearing_kr_links DROP CONSTRAINT IF EXISTS bearing_kr_links_key_result_id_project_id_key;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Drop old columns
ALTER TABLE bearing_kr_links DROP COLUMN IF EXISTS epic_id;
ALTER TABLE bearing_kr_links DROP COLUMN IF EXISTS project_id;
ALTER TABLE bearing_kr_links DROP COLUMN IF EXISTS task_query;
ALTER TABLE bearing_kr_links DROP COLUMN IF EXISTS weight;

-- Make new columns NOT NULL (only if they don't already have the constraint)
DO $$ BEGIN
  ALTER TABLE bearing_kr_links ALTER COLUMN target_type SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bearing_kr_links ALTER COLUMN target_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add new indexes and unique constraint
CREATE INDEX IF NOT EXISTS idx_bearing_kr_links_target ON bearing_kr_links(target_type, target_id);
DO $$ BEGIN
  ALTER TABLE bearing_kr_links ADD CONSTRAINT bearing_kr_links_kr_target
    UNIQUE (key_result_id, target_type, target_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- bearing_kr_snapshots — Replace snapshot_date/current_value
--   with value/recorded_at
-- ─────────────────────────────────────────────────────────────────────────

-- Add new columns
ALTER TABLE bearing_kr_snapshots ADD COLUMN IF NOT EXISTS value NUMERIC(12,2);
ALTER TABLE bearing_kr_snapshots ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT now();

-- Migrate data from old columns to new if old columns exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bearing_kr_snapshots' AND column_name = 'current_value') THEN
    UPDATE bearing_kr_snapshots SET value = current_value WHERE value IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bearing_kr_snapshots' AND column_name = 'snapshot_date') THEN
    UPDATE bearing_kr_snapshots SET recorded_at = snapshot_date::timestamptz WHERE recorded_at IS NULL;
  END IF;
END $$;

-- Make new columns NOT NULL
DO $$ BEGIN
  ALTER TABLE bearing_kr_snapshots ALTER COLUMN value SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bearing_kr_snapshots ALTER COLUMN recorded_at SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Drop old unique constraint
DO $$ BEGIN
  ALTER TABLE bearing_kr_snapshots DROP CONSTRAINT IF EXISTS bearing_kr_snapshots_key_result_id_snapshot_date_key;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Drop old columns
ALTER TABLE bearing_kr_snapshots DROP COLUMN IF EXISTS snapshot_date;
ALTER TABLE bearing_kr_snapshots DROP COLUMN IF EXISTS current_value;

-- Update indexes
DROP INDEX IF EXISTS idx_bearing_snap_date;
CREATE INDEX IF NOT EXISTS idx_bearing_kr_snapshots_kr ON bearing_kr_snapshots(key_result_id);
CREATE INDEX IF NOT EXISTS idx_bearing_kr_snapshots_date ON bearing_kr_snapshots(recorded_at);

-- ─────────────────────────────────────────────────────────────────────────
-- bearing_goals — Fix status CHECK to match API enum (add 'draft', 'missed';
--   remove 'cancelled'). Add 'individual' to scope CHECK.
-- ─────────────────────────────────────────────────────────────────────────

-- Replace status CHECK constraint
DO $$ BEGIN
  ALTER TABLE bearing_goals DROP CONSTRAINT IF EXISTS bearing_goals_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bearing_goals ADD CONSTRAINT bearing_goals_status_check
    CHECK (status IN ('draft', 'on_track', 'at_risk', 'behind', 'achieved', 'missed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Replace scope CHECK constraint
DO $$ BEGIN
  ALTER TABLE bearing_goals DROP CONSTRAINT IF EXISTS bearing_goals_scope_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bearing_goals ADD CONSTRAINT bearing_goals_scope_check
    CHECK (scope IN ('organization', 'team', 'project', 'individual'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Change default status from 'on_track' to 'draft'
DO $$ BEGIN
  ALTER TABLE bearing_goals ALTER COLUMN status SET DEFAULT 'draft';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- bearing_periods — Fix period_type CHECK to match API enum
-- ─────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE bearing_periods DROP CONSTRAINT IF EXISTS bearing_periods_period_type_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bearing_periods ADD CONSTRAINT bearing_periods_period_type_check
    CHECK (period_type IN ('annual', 'semi_annual', 'quarterly', 'monthly', 'custom'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
