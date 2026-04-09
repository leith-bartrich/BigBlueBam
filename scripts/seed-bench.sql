-- Seed Bench (Dashboards & Analytics) demo data for Mage Inc
-- Run: docker compose exec -T postgres psql -U bigbluebam < scripts/seed-bench.sql

DO $$
DECLARE
  v_org UUID := '57158e52-227d-4903-b0d8-d9f3c4910f61';
  v_u1 UUID := '65429e63-65c7-4f74-a19e-977217128edc';  -- Eddie
  v_u2 UUID := 'cffb3330-4868-4741-95f4-564efe27836a';  -- Sarah

  -- Dashboards
  d1 UUID; d2 UUID; d3 UUID;

  -- Widgets
  w1 UUID; w2 UUID; w3 UUID; w4 UUID; w5 UUID;
  w6 UUID; w7 UUID; w8 UUID; w9 UUID; w10 UUID;

BEGIN
  -- ══════════════════════════════════════════════════════════════
  -- Clean existing Bench data for this org
  -- ══════════════════════════════════════════════════════════════
  DELETE FROM bench_widgets WHERE dashboard_id IN (SELECT id FROM bench_dashboards WHERE organization_id = v_org);
  DELETE FROM bench_scheduled_reports WHERE organization_id = v_org;
  DELETE FROM bench_dashboards WHERE organization_id = v_org;
  DELETE FROM bench_saved_queries WHERE organization_id = v_org;

  -- ══════════════════════════════════════════════════════════════
  -- Dashboard 1: Engineering Overview (org-wide)
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO bench_dashboards (organization_id, name, description, visibility, is_default, auto_refresh_seconds, layout, created_by, updated_by)
  VALUES (v_org, 'Engineering Overview', 'Cross-product engineering metrics for leadership', 'organization', true, 300, '[]', v_u1, v_u1)
  RETURNING id INTO d1;

  -- Widget: Total Open Tasks (KPI card)
  INSERT INTO bench_widgets (dashboard_id, name, widget_type, data_source, entity, query_config, viz_config)
  VALUES (d1, 'Open Tasks', 'kpi_card', 'bam', 'tasks',
    '{"measures":[{"field":"id","agg":"count","alias":"open_tasks"}],"filters":[{"field":"state","op":"neq","value":"done"}]}',
    '{"format":"number","suffix":"tasks"}'
  ) RETURNING id INTO w1;

  -- Widget: Tasks by Priority (Bar chart)
  INSERT INTO bench_widgets (dashboard_id, name, widget_type, data_source, entity, query_config, viz_config)
  VALUES (d1, 'Tasks by Priority', 'bar_chart', 'bam', 'tasks',
    '{"measures":[{"field":"id","agg":"count","alias":"task_count"}],"dimensions":[{"field":"priority"}],"sort":[{"field":"task_count","dir":"desc"}]}',
    '{"colors":["#ef4444","#f97316","#f59e0b","#3b82f6","#94a3b8"],"show_legend":true}'
  ) RETURNING id INTO w2;

  -- Widget: Story Points Completed (Counter)
  INSERT INTO bench_widgets (dashboard_id, name, widget_type, data_source, entity, query_config, viz_config)
  VALUES (d1, 'Points Completed (30d)', 'counter', 'bench', 'daily_task_throughput',
    '{"measures":[{"field":"points_completed","agg":"sum","alias":"total_points"}],"filters":[{"field":"day","op":"gte","value":"2026-03-08"}]}',
    '{"format":"number"}'
  ) RETURNING id INTO w3;

  -- Widget: Task State Distribution (Pie chart)
  INSERT INTO bench_widgets (dashboard_id, name, widget_type, data_source, entity, query_config, viz_config)
  VALUES (d1, 'Task State Distribution', 'pie_chart', 'bam', 'tasks',
    '{"measures":[{"field":"id","agg":"count","alias":"count"}],"dimensions":[{"field":"state"}]}',
    '{"colors":["#3b82f6","#f59e0b","#8b5cf6","#10b981","#94a3b8"]}'
  ) RETURNING id INTO w4;

  -- Update layout for dashboard 1
  UPDATE bench_dashboards SET layout = jsonb_build_array(
    jsonb_build_object('widget_id', w1, 'x', 0, 'y', 0, 'w', 3, 'h', 2),
    jsonb_build_object('widget_id', w3, 'x', 3, 'y', 0, 'w', 3, 'h', 2),
    jsonb_build_object('widget_id', w2, 'x', 6, 'y', 0, 'w', 6, 'h', 4),
    jsonb_build_object('widget_id', w4, 'x', 0, 'y', 2, 'w', 6, 'h', 4)
  ) WHERE id = d1;

  -- ══════════════════════════════════════════════════════════════
  -- Dashboard 2: Sales & Pipeline (org-wide)
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO bench_dashboards (organization_id, name, description, visibility, auto_refresh_seconds, layout, created_by, updated_by)
  VALUES (v_org, 'Sales & Pipeline', 'Bond CRM pipeline and deal analytics', 'organization', 600, '[]', v_u2, v_u2)
  RETURNING id INTO d2;

  -- Widget: Active Deals (KPI)
  INSERT INTO bench_widgets (dashboard_id, name, widget_type, data_source, entity, query_config, viz_config)
  VALUES (d2, 'Active Deals', 'kpi_card', 'bond', 'deals',
    '{"measures":[{"field":"id","agg":"count","alias":"deal_count"}],"filters":[{"field":"closed_at","op":"is_null","value":true}]}',
    '{"format":"number","suffix":"deals"}'
  ) RETURNING id INTO w5;

  -- Widget: Pipeline Value by Stage (Bar chart)
  INSERT INTO bench_widgets (dashboard_id, name, widget_type, data_source, entity, query_config, viz_config)
  VALUES (d2, 'Pipeline Value by Stage', 'bar_chart', 'bench', 'pipeline_snapshot',
    '{"measures":[{"field":"total_value","agg":"sum","alias":"value"}],"dimensions":[{"field":"stage_name"}],"sort":[{"field":"value","dir":"desc"}]}',
    '{"colors":["#3b82f6","#10b981","#f59e0b","#ef4444"],"stacked":false}'
  ) RETURNING id INTO w6;

  -- Widget: Deal Count by Stage (Funnel)
  INSERT INTO bench_widgets (dashboard_id, name, widget_type, data_source, entity, query_config, viz_config)
  VALUES (d2, 'Deal Funnel', 'funnel', 'bench', 'pipeline_snapshot',
    '{"measures":[{"field":"deal_count","agg":"sum","alias":"deals"}],"dimensions":[{"field":"stage_name"}]}',
    '{"colors":["#3b82f6","#60a5fa","#93c5fd","#bfdbfe"]}'
  ) RETURNING id INTO w7;

  UPDATE bench_dashboards SET layout = jsonb_build_array(
    jsonb_build_object('widget_id', w5, 'x', 0, 'y', 0, 'w', 4, 'h', 2),
    jsonb_build_object('widget_id', w6, 'x', 4, 'y', 0, 'w', 8, 'h', 4),
    jsonb_build_object('widget_id', w7, 'x', 0, 'y', 2, 'w', 4, 'h', 4)
  ) WHERE id = d2;

  -- ══════════════════════════════════════════════════════════════
  -- Dashboard 3: Marketing Performance (private)
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO bench_dashboards (organization_id, name, description, visibility, layout, created_by, updated_by)
  VALUES (v_org, 'Marketing Performance', 'Blast campaign engagement and email analytics', 'private', '[]', v_u2, v_u2)
  RETURNING id INTO d3;

  -- Widget: Total Emails Sent (Counter)
  INSERT INTO bench_widgets (dashboard_id, name, widget_type, data_source, entity, query_config, viz_config)
  VALUES (d3, 'Total Emails Sent', 'counter', 'blast', 'campaigns',
    '{"measures":[{"field":"total_sent","agg":"sum","alias":"emails_sent"}]}',
    '{"format":"number"}'
  ) RETURNING id INTO w8;

  -- Widget: Campaign Engagement (Table)
  INSERT INTO bench_widgets (dashboard_id, name, widget_type, data_source, entity, query_config, viz_config)
  VALUES (d3, 'Campaign Engagement', 'table', 'bench', 'campaign_engagement',
    '{"measures":[{"field":"open_rate","agg":"avg","alias":"avg_open_rate"},{"field":"click_rate","agg":"avg","alias":"avg_click_rate"}],"dimensions":[{"field":"name"}],"limit":10}',
    '{}'
  ) RETURNING id INTO w9;

  -- Widget: Contacts by Lifecycle (Donut)
  INSERT INTO bench_widgets (dashboard_id, name, widget_type, data_source, entity, query_config, viz_config)
  VALUES (d3, 'Contacts by Lifecycle Stage', 'donut_chart', 'bond', 'contacts',
    '{"measures":[{"field":"id","agg":"count","alias":"contact_count"}],"dimensions":[{"field":"lifecycle_stage"}]}',
    '{"colors":["#94a3b8","#3b82f6","#8b5cf6","#f59e0b","#f97316","#16a34a","#06b6d4","#64748b"]}'
  ) RETURNING id INTO w10;

  UPDATE bench_dashboards SET layout = jsonb_build_array(
    jsonb_build_object('widget_id', w8, 'x', 0, 'y', 0, 'w', 4, 'h', 2),
    jsonb_build_object('widget_id', w10, 'x', 4, 'y', 0, 'w', 4, 'h', 4),
    jsonb_build_object('widget_id', w9, 'x', 8, 'y', 0, 'w', 4, 'h', 4)
  ) WHERE id = d3;

  -- ══════════════════════════════════════════════════════════════
  -- Scheduled Reports
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO bench_scheduled_reports (dashboard_id, organization_id, name, cron_expression, cron_timezone, delivery_method, delivery_target, export_format, enabled, created_by)
  VALUES
    (d1, v_org, 'Weekly Engineering Digest', '0 9 * * 1', 'America/New_York', 'email', 'eddie@bigblueceiling.com', 'pdf', true, v_u1),
    (d2, v_org, 'Monthly Sales Report', '0 8 1 * *', 'America/New_York', 'banter_channel', 'leadership', 'pdf', true, v_u2);

  RAISE NOTICE 'Seeded 3 dashboards, 10 widgets, and 2 scheduled reports for Bench.';
END $$;
