-- 0035_bench_tables.sql
-- Why: Create the 5 core tables for Bench (Dashboards & Analytics) —
--   dashboards, widgets, scheduled reports, materialized view tracking,
--   and 3 pre-built materialized views for cross-product aggregation.
-- Client impact: additive only — new tables, indexes, and materialized views.

-- ============================================================
-- BENCH: Dashboards & Analytics
-- ============================================================

-- 1. bench_dashboards — dashboard definitions with grid layout
CREATE TABLE IF NOT EXISTS bench_dashboards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id          UUID REFERENCES projects(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    layout              JSONB NOT NULL DEFAULT '[]',
    visibility          VARCHAR(20) NOT NULL DEFAULT 'private'
                        CHECK (visibility IN ('private', 'project', 'organization')),
    is_default          BOOLEAN NOT NULL DEFAULT false,
    auto_refresh_seconds INTEGER,
    created_by          UUID NOT NULL REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bench_dash_org ON bench_dashboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_bench_dash_project ON bench_dashboards(project_id);
CREATE INDEX IF NOT EXISTS idx_bench_dash_visibility ON bench_dashboards(organization_id, visibility);

-- 2. bench_widgets — individual chart/table/KPI components
CREATE TABLE IF NOT EXISTS bench_widgets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id        UUID NOT NULL REFERENCES bench_dashboards(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    widget_type         VARCHAR(30) NOT NULL
                        CHECK (widget_type IN (
                            'bar_chart', 'line_chart', 'area_chart', 'pie_chart', 'donut_chart',
                            'scatter_plot', 'heatmap', 'funnel',
                            'table', 'pivot_table',
                            'kpi_card', 'counter', 'gauge', 'progress_bar',
                            'text', 'markdown'
                        )),
    data_source         VARCHAR(30) NOT NULL,
    entity              VARCHAR(60) NOT NULL,
    query_config        JSONB NOT NULL,
    viz_config          JSONB DEFAULT '{}',
    kpi_config          JSONB,
    cache_ttl_seconds   INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bench_widgets_dashboard ON bench_widgets(dashboard_id);

-- 3. bench_scheduled_reports — periodic dashboard snapshots
CREATE TABLE IF NOT EXISTS bench_scheduled_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id        UUID NOT NULL REFERENCES bench_dashboards(id) ON DELETE CASCADE,
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    cron_expression     VARCHAR(100) NOT NULL,
    cron_timezone       VARCHAR(50) DEFAULT 'UTC',
    delivery_method     VARCHAR(20) NOT NULL
                        CHECK (delivery_method IN ('email', 'banter_channel', 'brief_document')),
    delivery_target     TEXT NOT NULL,
    export_format       VARCHAR(10) NOT NULL DEFAULT 'pdf'
                        CHECK (export_format IN ('pdf', 'png', 'csv')),
    enabled             BOOLEAN NOT NULL DEFAULT true,
    last_sent_at        TIMESTAMPTZ,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bench_reports_org ON bench_scheduled_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_bench_reports_enabled ON bench_scheduled_reports(enabled) WHERE enabled = true;

-- 4. bench_materialized_views — refresh tracking for pre-built MVs
CREATE TABLE IF NOT EXISTS bench_materialized_views (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    view_name           VARCHAR(100) NOT NULL UNIQUE,
    description         TEXT,
    refresh_cron        VARCHAR(100) NOT NULL DEFAULT '*/5 * * * *',
    last_refreshed_at   TIMESTAMPTZ,
    refresh_duration_ms INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. bench_saved_queries — saved ad-hoc queries for the explorer
CREATE TABLE IF NOT EXISTS bench_saved_queries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    data_source         VARCHAR(30) NOT NULL,
    entity              VARCHAR(60) NOT NULL,
    query_config        JSONB NOT NULL,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bench_saved_queries_org ON bench_saved_queries(organization_id);

-- ============================================================
-- Pre-built materialized views for cross-product aggregations
-- ============================================================

-- Daily task throughput by project (Bam)
DO $$ BEGIN
  EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS bench_mv_daily_task_throughput';
  EXECUTE '
    CREATE MATERIALIZED VIEW bench_mv_daily_task_throughput AS
    SELECT
        t.project_id,
        date_trunc(''day'', t.updated_at) AS day,
        COUNT(*) AS total_tasks,
        COUNT(*) FILTER (WHERE t.state_id IS NOT NULL) AS with_state,
        COALESCE(SUM(t.story_points), 0) AS total_points
    FROM tasks t
    GROUP BY t.project_id, date_trunc(''day'', t.updated_at)
  ';
EXCEPTION WHEN undefined_table THEN
  -- tasks table does not exist yet, skip
  NULL;
END $$;

-- Pipeline value snapshot (Bond)
DO $$ BEGIN
  EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS bench_mv_pipeline_snapshot';
  EXECUTE '
    CREATE MATERIALIZED VIEW bench_mv_pipeline_snapshot AS
    SELECT
        d.organization_id,
        d.pipeline_id,
        ps.name AS stage_name,
        ps.sort_order,
        ps.stage_type,
        COUNT(d.id) AS deal_count,
        COALESCE(SUM(d.value), 0) AS total_value,
        COALESCE(SUM(d.weighted_value), 0) AS weighted_value
    FROM bond_deals d
    JOIN bond_pipeline_stages ps ON d.stage_id = ps.id
    WHERE d.closed_at IS NULL
    GROUP BY d.organization_id, d.pipeline_id, ps.id, ps.name, ps.sort_order, ps.stage_type
  ';
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Campaign engagement rates (Blast)
DO $$ BEGIN
  EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS bench_mv_campaign_engagement';
  EXECUTE '
    CREATE MATERIALIZED VIEW bench_mv_campaign_engagement AS
    SELECT
        c.organization_id,
        c.id AS campaign_id,
        c.name,
        c.sent_at,
        c.total_sent,
        c.total_opened,
        c.total_clicked,
        CASE WHEN c.total_sent > 0 THEN ROUND(100.0 * c.total_opened / c.total_sent, 1) ELSE 0 END AS open_rate,
        CASE WHEN c.total_sent > 0 THEN ROUND(100.0 * c.total_clicked / c.total_sent, 1) ELSE 0 END AS click_rate
    FROM blast_campaigns c
    WHERE c.status = ''sent''
  ';
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Seed the materialized view registry
INSERT INTO bench_materialized_views (view_name, description, refresh_cron)
VALUES
  ('bench_mv_daily_task_throughput', 'Daily task throughput by project (Bam)', '*/5 * * * *'),
  ('bench_mv_pipeline_snapshot', 'Pipeline value snapshot by stage (Bond)', '*/5 * * * *'),
  ('bench_mv_campaign_engagement', 'Campaign engagement rates (Blast)', '*/15 * * * *')
ON CONFLICT (view_name) DO NOTHING;
