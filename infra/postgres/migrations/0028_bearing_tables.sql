-- 0028_bearing_tables.sql
-- Why: Create the Bearing (Goals & OKRs) tables — time periods, goals, key results,
--   KR links to Bam entities, progress snapshots, goal watchers, and status updates.
--   Bearing is the strategy-to-execution layer connecting quarterly objectives to daily
--   task work in Bam.
-- Client impact: additive only

-- ─────────────────────────────────────────────────────────────────────────
-- bearing_periods — Time periods (quarters, halves, custom)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bearing_periods (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    period_type     VARCHAR(20) NOT NULL CHECK (period_type IN ('quarter', 'half', 'year', 'custom')),
    starts_at       DATE NOT NULL,
    ends_at         DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, name),
    CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_bearing_periods_org ON bearing_periods(organization_id);
CREATE INDEX IF NOT EXISTS idx_bearing_periods_status ON bearing_periods(status);

-- ─────────────────────────────────────────────────────────────────────────
-- bearing_goals — Top-level objectives
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bearing_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_id       UUID NOT NULL REFERENCES bearing_periods(id) ON DELETE CASCADE,
    scope           VARCHAR(20) NOT NULL DEFAULT 'organization' CHECK (scope IN ('organization', 'team', 'project')),
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    team_name       VARCHAR(100),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    icon            VARCHAR(10),
    color           VARCHAR(7),
    status          VARCHAR(20) NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'behind', 'achieved', 'cancelled')),
    status_override BOOLEAN NOT NULL DEFAULT false,
    progress        NUMERIC(5,4) NOT NULL DEFAULT 0.0,
    owner_id        UUID NOT NULL REFERENCES users(id),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bearing_goals_org ON bearing_goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_bearing_goals_period ON bearing_goals(period_id);
CREATE INDEX IF NOT EXISTS idx_bearing_goals_owner ON bearing_goals(owner_id);
CREATE INDEX IF NOT EXISTS idx_bearing_goals_project ON bearing_goals(project_id);
CREATE INDEX IF NOT EXISTS idx_bearing_goals_status ON bearing_goals(status);

-- ─────────────────────────────────────────────────────────────────────────
-- bearing_key_results — Measurable outcomes under a goal
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bearing_key_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id         UUID NOT NULL REFERENCES bearing_goals(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    metric_type     VARCHAR(20) NOT NULL DEFAULT 'percentage' CHECK (metric_type IN ('percentage', 'number', 'currency', 'boolean')),
    target_value    NUMERIC(15,4) NOT NULL,
    current_value   NUMERIC(15,4) NOT NULL DEFAULT 0.0,
    start_value     NUMERIC(15,4) NOT NULL DEFAULT 0.0,
    unit            VARCHAR(20),
    direction       VARCHAR(10) NOT NULL DEFAULT 'increase' CHECK (direction IN ('increase', 'decrease')),
    progress_mode   VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (progress_mode IN ('manual', 'linked', 'rollup')),
    linked_query    JSONB,
    progress        NUMERIC(5,4) NOT NULL DEFAULT 0.0,
    owner_id        UUID REFERENCES users(id),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bearing_kr_goal ON bearing_key_results(goal_id);
CREATE INDEX IF NOT EXISTS idx_bearing_kr_owner ON bearing_key_results(owner_id);

-- ─────────────────────────────────────────────────────────────────────────
-- bearing_kr_links — Links between KRs and Bam entities
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bearing_kr_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_result_id   UUID NOT NULL REFERENCES bearing_key_results(id) ON DELETE CASCADE,
    link_type       VARCHAR(20) NOT NULL CHECK (link_type IN ('epic', 'project', 'task_query')),
    epic_id         UUID,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    task_query      JSONB,
    weight          NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (key_result_id, epic_id),
    UNIQUE (key_result_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_bearing_krl_kr ON bearing_kr_links(key_result_id);

-- ─────────────────────────────────────────────────────────────────────────
-- bearing_kr_snapshots — Daily progress snapshots for charting
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bearing_kr_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_result_id   UUID NOT NULL REFERENCES bearing_key_results(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    current_value   NUMERIC(15,4) NOT NULL,
    progress        NUMERIC(5,4) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (key_result_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_bearing_snap_kr ON bearing_kr_snapshots(key_result_id);
CREATE INDEX IF NOT EXISTS idx_bearing_snap_date ON bearing_kr_snapshots(snapshot_date);

-- ─────────────────────────────────────────────────────────────────────────
-- bearing_goal_watchers — Users who receive status updates
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bearing_goal_watchers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id         UUID NOT NULL REFERENCES bearing_goals(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (goal_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- bearing_updates — Status update notes from goal owners
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bearing_updates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id         UUID NOT NULL REFERENCES bearing_goals(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id),
    body            TEXT NOT NULL,
    status_at_time  VARCHAR(20) NOT NULL,
    progress_at_time NUMERIC(5,4) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bearing_updates_goal ON bearing_updates(goal_id);
