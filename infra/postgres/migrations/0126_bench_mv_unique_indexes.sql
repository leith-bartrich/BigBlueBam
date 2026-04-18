-- 0126_bench_mv_unique_indexes.sql
-- Why: The bench-mv-refresh worker job uses REFRESH MATERIALIZED VIEW CONCURRENTLY
-- which requires at least one UNIQUE index on each materialized view. Without
-- these indexes, Postgres rejects the CONCURRENTLY keyword and the worker falls
-- back to a blocking plain REFRESH, which locks reads during the refresh window.
-- Client impact: additive only. Indexes on materialized views, no table changes.

CREATE UNIQUE INDEX IF NOT EXISTS bench_mv_daily_task_throughput_uniq
  ON bench_mv_daily_task_throughput (project_id, day);

CREATE UNIQUE INDEX IF NOT EXISTS bench_mv_pipeline_snapshot_uniq
  ON bench_mv_pipeline_snapshot (organization_id, pipeline_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS bench_mv_campaign_engagement_uniq
  ON bench_mv_campaign_engagement (campaign_id);
