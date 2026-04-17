-- Seed Bearing (Goals & OKRs) demo data
-- Run via orchestrator: node scripts/seed-all.mjs (substitutes :org_id / :user_N)
-- Note: seed-bearing.mjs is the canonical Bearing seeder and is the one wired
-- into PHASE_B. This .sql file is retained for ad-hoc psql runs via the
-- orchestrator's substitution engine; it is NOT invoked automatically.
-- idempotent: skip-if-any-period-already-present

DO $$
DECLARE
  v_org UUID := :org_id;
  v_proj UUID;
  v_u1 UUID := :user_1;
  v_u2 UUID := :user_2;
  v_u3 UUID := :user_3;
  v_u4 UUID := :user_4;
  v_u5 UUID := :user_5;
  v_u6 UUID := :user_6;
  p1 UUID; p2 UUID;
  g1 UUID; g2 UUID; g3 UUID; g4 UUID; g5 UUID; g6 UUID; g7 UUID; g8 UUID;
BEGIN
  -- Resolve a project for this org.
  SELECT id INTO v_proj FROM projects WHERE org_id = v_org ORDER BY created_at LIMIT 1;

  -- Idempotency guard
  IF EXISTS (SELECT 1 FROM bearing_periods WHERE organization_id = v_org LIMIT 1) THEN
    RAISE NOTICE 'Bearing seed: periods already exist for this org, skipping.';
    RETURN;
  END IF;

  -- Periods
  p1 := gen_random_uuid(); p2 := gen_random_uuid();
  INSERT INTO bearing_periods (id, organization_id, name, period_type, starts_at, ends_at, status, created_by) VALUES
    (p1, v_org, 'Q2 2026', 'quarterly', '2026-04-01', '2026-06-30', 'active', v_u1),
    (p2, v_org, 'Q1 2026', 'quarterly', '2026-01-01', '2026-03-31', 'completed', v_u1);

  -- Goals (progress is 0.0000-1.0000 scale)
  g1 := gen_random_uuid(); g2 := gen_random_uuid(); g3 := gen_random_uuid();
  g4 := gen_random_uuid(); g5 := gen_random_uuid(); g6 := gen_random_uuid();
  g7 := gen_random_uuid(); g8 := gen_random_uuid();

  INSERT INTO bearing_goals (id, organization_id, period_id, project_id, title, description, owner_id, scope, status, progress, created_by) VALUES
    (g1, v_org, p1, v_proj, 'Ship Brief and Bolt to production', 'Launch collaborative documents (Brief) and workflow automation (Bolt) as stable features by end of Q2.', v_u1, 'organization', 'on_track', 0.7200, v_u1),
    (g2, v_org, p1, v_proj, 'Achieve 99.9% API uptime', 'Maintain platform reliability across all 7 APIs with sub-200ms p99 latency.', v_u2, 'organization', 'on_track', 0.8500, v_u2),
    (g3, v_org, p1, v_proj, 'Grow MCP tool coverage to 200+', 'Expand AI agent capabilities by adding tools for new apps and filling coverage gaps.', v_u4, 'project', 'at_risk', 0.4500, v_u4),
    (g4, v_org, p1, v_proj, 'Reduce helpdesk response time to <2 hours', 'Improve customer satisfaction by leveraging AI triage and Bolt automations.', v_u3, 'project', 'on_track', 0.6800, v_u3),
    (g5, v_org, p1, NULL, 'Onboard 3 new team members', 'Hire and ramp up engineers with <2 week time-to-first-PR.', v_u1, 'organization', 'behind', 0.3300, v_u1),
    (g6, v_org, p1, v_proj, 'Achieve 80% test coverage', 'Increase test suite from 700 to 900+ tests.', v_u6, 'project', 'on_track', 0.6000, v_u6),
    (g7, v_org, p2, v_proj, 'Launch Beacon knowledge base', 'Build and ship Beacon with semantic search, graph explorer, and expiry governance.', v_u1, 'organization', 'achieved', 1.0000, v_u1),
    (g8, v_org, p2, v_proj, 'Establish CI/CD pipeline', 'Set up automated testing, linting, and deployment for all services.', v_u6, 'organization', 'achieved', 1.0000, v_u6);

  -- Key Results (progress is 0.0000-1.0000 scale)
  INSERT INTO bearing_key_results (goal_id, title, progress_mode, metric_type, unit, start_value, target_value, current_value, progress, owner_id, sort_order, created_at) VALUES
    (g1, 'Brief: all pages rendering and passing tests', 'manual', 'percentage', 'percent', 0, 100, 95, 0.9500, v_u3, 0, NOW() - INTERVAL '30 days'),
    (g1, 'Bolt: visual builder functional with 10+ templates', 'manual', 'number', 'count', 0, 10, 10, 1.0000, v_u4, 1, NOW() - INTERVAL '30 days'),
    (g1, 'Security audit: 0 P0/P1 issues remaining', 'manual', 'number', 'count', 5, 0, 0, 1.0000, v_u2, 2, NOW() - INTERVAL '30 days'),
    (g2, 'API p99 latency < 200ms', 'manual', 'number', 'ms', 350, 200, 180, 1.0000, v_u2, 0, NOW() - INTERVAL '60 days'),
    (g2, 'Zero unplanned downtime incidents', 'manual', 'number', 'count', 0, 0, 1, 0.5000, v_u6, 1, NOW() - INTERVAL '60 days'),
    (g3, 'Add 12 Bolt MCP tools', 'manual', 'number', 'count', 0, 12, 12, 1.0000, v_u4, 0, NOW() - INTERVAL '20 days'),
    (g3, 'Add 12 Bearing MCP tools', 'manual', 'number', 'count', 0, 12, 12, 1.0000, v_u4, 1, NOW() - INTERVAL '10 days'),
    (g3, 'Add unified cross-product search tool', 'manual', 'number', 'count', 0, 1, 0, 0.0000, v_u4, 2, NOW() - INTERVAL '20 days'),
    (g4, 'AI triage handles 80% of tickets', 'manual', 'percentage', 'percent', 73, 80, 78, 0.7100, v_u3, 0, NOW() - INTERVAL '45 days'),
    (g4, 'Average first response < 30 min', 'manual', 'number', 'minutes', 120, 30, 42, 0.8700, v_u3, 1, NOW() - INTERVAL '45 days'),
    (g5, 'Hire 3 engineers (offers accepted)', 'manual', 'number', 'count', 0, 3, 1, 0.3300, v_u1, 0, NOW() - INTERVAL '60 days'),
    (g6, 'Increase test count from 700 to 900+', 'manual', 'number', 'count', 700, 900, 800, 0.5000, v_u6, 0, NOW() - INTERVAL '30 days');

  -- Watchers
  INSERT INTO bearing_goal_watchers (goal_id, user_id) VALUES
    (g1, v_u1), (g1, v_u2), (g1, v_u3), (g1, v_u4),
    (g2, v_u1), (g2, v_u2), (g2, v_u6),
    (g3, v_u1), (g3, v_u4),
    (g4, v_u1), (g4, v_u3),
    (g5, v_u1), (g5, v_u5),
    (g6, v_u1), (g6, v_u6);

  -- Status updates
  INSERT INTO bearing_updates (goal_id, author_id, body, status_at_time, progress_at_time) VALUES
    (g1, v_u1, 'Brief editor upgraded to Tiptap WYSIWYG. 33 templates shipped. Bolt visual builder working with 10 pre-built automation templates.', 'on_track', 0.7200),
    (g1, v_u3, 'Brief security audit complete — all P0/P1 issues resolved. Running final integration tests.', 'on_track', 0.8000),
    (g2, v_u2, 'All 7 APIs healthy with p99 under 200ms. Had one Redis memory incident in March but resolved within 23 minutes.', 'on_track', 0.8500),
    (g3, v_u4, 'Bolt (12) and Bearing (12) tools shipped. Still need the unified search meta-tool — blocked on cross-product API design.', 'at_risk', 0.4500),
    (g4, v_u3, 'AI triage rate improved from 73% to 78%. New Bolt automations handle billing ticket routing automatically.', 'on_track', 0.6800),
    (g5, v_u1, 'First hire started in March. Two more pipeline candidates — interviews scheduled for next week.', 'behind', 0.3300),
    (g7, v_u1, 'Beacon shipped on time with graph explorer, semantic search, and 5000 seeded articles.', 'achieved', 1.0000),
    (g8, v_u6, 'CI pipeline running on every push: lint, typecheck, 700+ tests. Docker images auto-built on merge to main.', 'achieved', 1.0000);

  RAISE NOTICE 'Seeded 2 periods, 8 goals, 12 key results, 15 watchers, 8 updates';
END $$;
