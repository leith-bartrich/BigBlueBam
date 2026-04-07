-- 0026_bolt_tables.sql
-- Why: Create tables for the Bolt workflow automation engine — automations,
--   conditions, actions, executions, execution steps, and schedules.
-- Client impact: additive only

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE bolt_trigger_source AS ENUM ('bam','banter','beacon','brief','helpdesk','schedule');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bolt_condition_operator AS ENUM (
    'equals','not_equals','contains','not_contains','starts_with','ends_with',
    'greater_than','less_than','is_empty','is_not_empty','in','not_in','matches_regex'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bolt_condition_logic AS ENUM ('and','or');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bolt_on_error AS ENUM ('stop','continue','retry');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bolt_execution_status AS ENUM ('running','success','partial','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bolt_step_status AS ENUM ('success','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- bolt_automations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bolt_automations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,

  trigger_source  bolt_trigger_source NOT NULL,
  trigger_event   VARCHAR(60) NOT NULL,
  trigger_filter  JSONB,
  cron_expression VARCHAR(100),
  cron_timezone   VARCHAR(50) NOT NULL DEFAULT 'UTC',

  max_executions_per_hour INT NOT NULL DEFAULT 100,
  cooldown_seconds        INT NOT NULL DEFAULT 0,
  last_executed_at        TIMESTAMPTZ,

  created_by      UUID NOT NULL REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bolt_automations_org_id
  ON bolt_automations(org_id);

CREATE INDEX IF NOT EXISTS idx_bolt_automations_project_id
  ON bolt_automations(project_id);

CREATE INDEX IF NOT EXISTS idx_bolt_automations_trigger
  ON bolt_automations(trigger_source, trigger_event);

CREATE INDEX IF NOT EXISTS idx_bolt_automations_enabled
  ON bolt_automations(enabled) WHERE enabled = TRUE;

-- ---------------------------------------------------------------------------
-- bolt_conditions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bolt_conditions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL REFERENCES bolt_automations(id) ON DELETE CASCADE,
  sort_order      INT NOT NULL,
  field           VARCHAR(255) NOT NULL,
  operator        bolt_condition_operator NOT NULL,
  value           JSONB,
  logic_group     bolt_condition_logic NOT NULL DEFAULT 'and',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bolt_conditions_automation_id
  ON bolt_conditions(automation_id);

-- ---------------------------------------------------------------------------
-- bolt_actions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bolt_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL REFERENCES bolt_automations(id) ON DELETE CASCADE,
  sort_order      INT NOT NULL,
  mcp_tool        VARCHAR(100) NOT NULL,
  parameters      JSONB,
  on_error        bolt_on_error NOT NULL DEFAULT 'stop',
  retry_count     INT NOT NULL DEFAULT 0,
  retry_delay_ms  INT NOT NULL DEFAULT 1000,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bolt_actions_automation_id
  ON bolt_actions(automation_id);

-- ---------------------------------------------------------------------------
-- bolt_executions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bolt_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL REFERENCES bolt_automations(id) ON DELETE CASCADE,
  status          bolt_execution_status NOT NULL DEFAULT 'running',
  trigger_event   JSONB,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INT,
  conditions_met  BOOLEAN NOT NULL DEFAULT TRUE,
  condition_log   JSONB,
  error_message   TEXT,
  error_step      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bolt_executions_automation_id
  ON bolt_executions(automation_id);

CREATE INDEX IF NOT EXISTS idx_bolt_executions_status
  ON bolt_executions(status);

CREATE INDEX IF NOT EXISTS idx_bolt_executions_started_at
  ON bolt_executions(started_at DESC);

-- ---------------------------------------------------------------------------
-- bolt_execution_steps
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bolt_execution_steps (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id        UUID NOT NULL REFERENCES bolt_executions(id) ON DELETE CASCADE,
  action_id           UUID NOT NULL REFERENCES bolt_actions(id) ON DELETE CASCADE,
  step_index          INT NOT NULL,
  mcp_tool            VARCHAR(100) NOT NULL,
  parameters_resolved JSONB,
  status              bolt_step_status NOT NULL DEFAULT 'skipped',
  response            JSONB,
  error_message       TEXT,
  duration_ms         INT,
  executed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bolt_execution_steps_execution_id
  ON bolt_execution_steps(execution_id);

-- ---------------------------------------------------------------------------
-- bolt_schedules
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bolt_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL UNIQUE REFERENCES bolt_automations(id) ON DELETE CASCADE,
  next_run_at     TIMESTAMPTZ,
  last_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bolt_schedules_next_run_at
  ON bolt_schedules(next_run_at);
