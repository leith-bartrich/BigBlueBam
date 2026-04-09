-- Seed Board demo data for Mage Inc
-- Run: docker compose exec -T postgres psql -U bigbluebam < scripts/seed-board.sql

DO $$
DECLARE
  v_org UUID := '57158e52-227d-4903-b0d8-d9f3c4910f61';
  v_proj UUID := '650b38cb-3b36-4014-bf96-17f7617b326a';
  v_u1 UUID := '65429e63-65c7-4f74-a19e-977217128edc';  -- Eddie
  v_u2 UUID := 'cffb3330-4868-4741-95f4-564efe27836a';  -- Sarah
  v_u3 UUID := 'f290dd98-65fa-403a-9778-6dbda873fc98';  -- Marcus
  v_u4 UUID := '138894b9-58ef-4eb4-9d27-bf36fff48885';  -- Priya
  v_u5 UUID := 'baa36964-d672-4271-ae96-b0cf5b1062a4';  -- Alex
  v_u6 UUID := '5e77088e-6d83-4821-8f9d-7857d2aefb68';  -- Jordan

  b1 UUID; b2 UUID; b3 UUID; b4 UUID; b5 UUID; b6 UUID; b7 UUID; b8 UUID;
BEGIN
  -- Clean existing board data for this org
  DELETE FROM board_chat_messages WHERE board_id IN (SELECT id FROM boards WHERE organization_id = v_org);
  DELETE FROM board_stars WHERE board_id IN (SELECT id FROM boards WHERE organization_id = v_org);
  DELETE FROM board_collaborators WHERE board_id IN (SELECT id FROM boards WHERE organization_id = v_org);
  DELETE FROM board_task_links WHERE board_id IN (SELECT id FROM boards WHERE organization_id = v_org);
  DELETE FROM board_elements WHERE board_id IN (SELECT id FROM boards WHERE organization_id = v_org);
  DELETE FROM board_versions WHERE board_id IN (SELECT id FROM boards WHERE organization_id = v_org);
  DELETE FROM boards WHERE organization_id = v_org;

  b1 := gen_random_uuid(); b2 := gen_random_uuid(); b3 := gen_random_uuid();
  b4 := gen_random_uuid(); b5 := gen_random_uuid(); b6 := gen_random_uuid();
  b7 := gen_random_uuid(); b8 := gen_random_uuid();

  -- ══════════════════════════════════════════════════════════════════════════
  -- BOARDS
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO boards (id, organization_id, project_id, name, description, icon, background, visibility, created_by, updated_by, created_at, updated_at) VALUES
    (b1, v_org, v_proj, 'Sprint 15 Retrospective',    'Team retro for Sprint 15 — what worked, what didn''t, and action items',      E'\U0001F504', 'dots',  'project',      v_u1, v_u1, NOW() - INTERVAL '3 days',  NOW() - INTERVAL '1 hour'),
    (b2, v_org, v_proj, 'Q2 Feature Brainstorm',       'Ideas for Q2 product roadmap — vote with emoji reactions on stickies',        E'\U0001F4A1', 'dots',  'organization', v_u2, v_u5, NOW() - INTERVAL '7 days',  NOW() - INTERVAL '4 hours'),
    (b3, v_org, v_proj, 'System Architecture v2',      'Updated architecture diagram for the platform rewrite',                       E'\U0001F3DB', 'grid',  'project',      v_u3, v_u3, NOW() - INTERVAL '14 days', NOW() - INTERVAL '2 days'),
    (b4, v_org, v_proj, 'User Onboarding Flow',        'Step-by-step flowchart of the new user onboarding experience',                E'\U0001F500', 'dots',  'project',      v_u4, v_u4, NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days'),
    (b5, v_org, v_proj, 'Product Roadmap',             'User story map organized by epics and priority',                              E'\U0001F4CB', 'grid',  'organization', v_u1, v_u2, NOW() - INTERVAL '21 days', NOW() - INTERVAL '1 day'),
    (b6, v_org, v_proj, 'Team SWOT Analysis',          'SWOT analysis for the engineering team — Q2 planning exercise',               E'\U0001F3AF', 'dots',  'project',      v_u2, v_u2, NOW() - INTERVAL '5 days',  NOW() - INTERVAL '2 days'),
    (b7, v_org, v_proj, 'Design Sprint Board',         'Five-phase design sprint: Understand, Sketch, Decide, Prototype, Test',       E'\U0001F3A8', 'dots',  'project',      v_u5, v_u5, NOW() - INTERVAL '6 days',  NOW() - INTERVAL '6 hours'),
    (b8, v_org, v_proj, 'Weekly Standup Notes',         'Running notes from daily/weekly standups — freeform board',                   E'\U0001F4DD', 'plain', 'project',      v_u1, v_u6, NOW() - INTERVAL '30 days', NOW() - INTERVAL '12 hours');

  -- ══════════════════════════════════════════════════════════════════════════
  -- BOARD ELEMENTS
  -- ══════════════════════════════════════════════════════════════════════════

  -- ── Board 1: Sprint 15 Retrospective ──────────────────────────────────────
  -- Frames
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b1, 'frame', 'Went Well',       100,  100,  500, 600, 'green'),
    (gen_random_uuid(), b1, 'frame', 'Didn''t Go Well', 700,  100,  500, 600, 'red'),
    (gen_random_uuid(), b1, 'frame', 'Action Items',    1300, 100,  500, 600, 'blue');
  -- Stickies: Went Well
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b1, 'sticky', 'Deployment pipeline is much faster now',      130,  180, 200, 100, 'light-green'),
    (gen_random_uuid(), b1, 'sticky', 'Great collaboration on the auth refactor',    350,  180, 200, 100, 'light-green'),
    (gen_random_uuid(), b1, 'sticky', 'Code review turnaround under 4 hours',        130,  310, 200, 100, 'light-green'),
    (gen_random_uuid(), b1, 'sticky', 'New monitoring dashboards caught the outage early', 350, 310, 200, 100, 'light-green'),
    (gen_random_uuid(), b1, 'sticky', 'Sprint goal was met 2 days early',            240,  440, 200, 100, 'light-green');
  -- Stickies: Didn't Go Well
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b1, 'sticky', 'Too many context switches mid-sprint',        730,  180, 200, 100, 'light-red'),
    (gen_random_uuid(), b1, 'sticky', 'Flaky integration tests blocked merges',      950,  180, 200, 100, 'light-red'),
    (gen_random_uuid(), b1, 'sticky', 'Scope creep on the settings page',            730,  310, 200, 100, 'light-red'),
    (gen_random_uuid(), b1, 'sticky', 'Missing acceptance criteria on 3 tickets',    950,  310, 200, 100, 'light-red');
  -- Stickies: Action Items
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b1, 'sticky', 'Add acceptance criteria template to ticket creation', 1330, 180, 200, 100, 'light-blue'),
    (gen_random_uuid(), b1, 'sticky', 'Quarantine flaky tests and fix by sprint 16',         1550, 180, 200, 100, 'light-blue'),
    (gen_random_uuid(), b1, 'sticky', 'Limit WIP to 2 items per dev',                       1330, 310, 200, 100, 'light-blue'),
    (gen_random_uuid(), b1, 'sticky', 'PO to lock scope after day 2',                        1550, 310, 200, 100, 'light-blue'),
    (gen_random_uuid(), b1, 'sticky', 'Schedule mid-sprint check-in with stakeholders',      1440, 440, 200, 100, 'light-blue');

  -- ── Board 2: Q2 Feature Brainstorm ────────────────────────────────────────
  -- Central frame
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b2, 'frame', 'Q2 Features',    700,  500,  400, 200, 'violet');
  -- Surrounding stickies
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b2, 'sticky', 'Real-time collaborative editing',             200,  150, 200, 100, 'yellow'),
    (gen_random_uuid(), b2, 'sticky', 'AI-powered task estimation',                  500,  100, 200, 100, 'yellow'),
    (gen_random_uuid(), b2, 'sticky', 'Mobile app (iOS/Android)',                    900,  120, 200, 100, 'orange'),
    (gen_random_uuid(), b2, 'sticky', 'Gantt chart view',                            1200, 200, 200, 100, 'yellow'),
    (gen_random_uuid(), b2, 'sticky', 'Custom workflow automations',                 1400, 400, 200, 100, 'yellow'),
    (gen_random_uuid(), b2, 'sticky', 'Slack/Teams integration',                     1300, 650, 200, 100, 'orange'),
    (gen_random_uuid(), b2, 'sticky', 'Time tracking with reports',                  1100, 850, 200, 100, 'yellow'),
    (gen_random_uuid(), b2, 'sticky', 'Guest/client access portal',                  700,  900, 200, 100, 'yellow'),
    (gen_random_uuid(), b2, 'sticky', 'Bulk operations on tasks',                    350,  800, 200, 100, 'yellow'),
    (gen_random_uuid(), b2, 'sticky', 'Advanced search with filters',                150,  600, 200, 100, 'orange'),
    (gen_random_uuid(), b2, 'sticky', 'Calendar view with drag scheduling',          100,  350, 200, 100, 'yellow'),
    (gen_random_uuid(), b2, 'sticky', 'Email-to-task integration',                   350,  250, 200, 100, 'yellow');
  -- Text label
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, font_size) VALUES
    (gen_random_uuid(), b2, 'text', 'Vote with thumbs up on your top 3 picks!', 600, 50, 600, 40, 'large');

  -- ── Board 3: System Architecture v2 ───────────────────────────────────────
  -- Layer frames
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b3, 'frame', 'Frontend (React SPA)',   100,  100,  600, 300, 'blue'),
    (gen_random_uuid(), b3, 'frame', 'API Layer (Fastify)',    100,  500,  600, 300, 'green'),
    (gen_random_uuid(), b3, 'frame', 'Database Layer',         100,  900,  600, 300, 'violet'),
    (gen_random_uuid(), b3, 'frame', 'External Services',      900,  100,  500, 500, 'orange');
  -- Components inside frames
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b3, 'sticky', 'React 19 + TanStack Query',    150,  180, 180, 80, 'light-blue'),
    (gen_random_uuid(), b3, 'sticky', 'Zustand State',                370,  180, 180, 80, 'light-blue'),
    (gen_random_uuid(), b3, 'sticky', 'TailwindCSS + Radix UI',       150,  290, 180, 80, 'light-blue'),
    (gen_random_uuid(), b3, 'sticky', 'WebSocket Client',             370,  290, 180, 80, 'light-blue'),
    (gen_random_uuid(), b3, 'sticky', 'REST Routes',                  150,  580, 180, 80, 'light-green'),
    (gen_random_uuid(), b3, 'sticky', 'Auth Middleware',              370,  580, 180, 80, 'light-green'),
    (gen_random_uuid(), b3, 'sticky', 'WebSocket Server',             150,  690, 180, 80, 'light-green'),
    (gen_random_uuid(), b3, 'sticky', 'BullMQ Worker',               370,  690, 180, 80, 'light-green'),
    (gen_random_uuid(), b3, 'sticky', 'PostgreSQL 16',               150,  980, 180, 80, 'light-violet'),
    (gen_random_uuid(), b3, 'sticky', 'Redis 7',                     370,  980, 180, 80, 'light-violet'),
    (gen_random_uuid(), b3, 'sticky', 'MinIO / S3',                  150,  1090, 180, 80, 'light-violet'),
    (gen_random_uuid(), b3, 'sticky', 'Qdrant (Vector)',             370,  1090, 180, 80, 'light-violet'),
    (gen_random_uuid(), b3, 'sticky', 'SMTP (Email)',                950,  180, 180, 80, 'light-orange'),
    (gen_random_uuid(), b3, 'sticky', 'OAuth Providers',             950,  290, 180, 80, 'light-orange'),
    (gen_random_uuid(), b3, 'sticky', 'LiveKit (Voice)',             950,  400, 180, 80, 'light-orange');
  -- Labels
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, font_size) VALUES
    (gen_random_uuid(), b3, 'text', 'BigBlueBam Platform Architecture', 300, 30, 500, 50, 'large');

  -- ── Board 4: User Onboarding Flow ────────────────────────────────────────
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b4, 'sticky', 'START: User signs up',           100,  400, 200, 100, 'green'),
    (gen_random_uuid(), b4, 'sticky', 'Verify email address',           400,  400, 200, 100, 'yellow'),
    (gen_random_uuid(), b4, 'sticky', 'Create organization',            700,  400, 200, 100, 'yellow'),
    (gen_random_uuid(), b4, 'sticky', 'Choose plan (free/pro)',         1000, 250, 200, 100, 'orange'),
    (gen_random_uuid(), b4, 'sticky', 'Invite team members',            1000, 550, 200, 100, 'orange'),
    (gen_random_uuid(), b4, 'sticky', 'Create first project',           1300, 400, 200, 100, 'yellow'),
    (gen_random_uuid(), b4, 'sticky', 'Configure phases & fields',      1600, 300, 200, 100, 'yellow'),
    (gen_random_uuid(), b4, 'sticky', 'Import existing tasks?',         1600, 500, 200, 100, 'orange'),
    (gen_random_uuid(), b4, 'sticky', 'Tour: Board view',               1900, 250, 200, 100, 'light-blue'),
    (gen_random_uuid(), b4, 'sticky', 'Tour: Sprint planning',          1900, 400, 200, 100, 'light-blue'),
    (gen_random_uuid(), b4, 'sticky', 'Tour: Keyboard shortcuts',       1900, 550, 200, 100, 'light-blue'),
    (gen_random_uuid(), b4, 'sticky', 'END: Dashboard',                 2200, 400, 200, 100, 'green');
  -- Decision diamond labels
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, font_size) VALUES
    (gen_random_uuid(), b4, 'text', 'User Onboarding Flow — Happy Path', 700, 100, 600, 50, 'large'),
    (gen_random_uuid(), b4, 'text', 'Decision point', 1000, 200, 150, 30, 'small'),
    (gen_random_uuid(), b4, 'text', 'Optional', 1600, 460, 100, 30, 'small');

  -- ── Board 5: Product Roadmap ──────────────────────────────────────────────
  -- Epic lane frames
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b5, 'frame', 'Epic: Core Platform',    100,  150, 1800, 200, 'blue'),
    (gen_random_uuid(), b5, 'frame', 'Epic: Collaboration',    100,  400, 1800, 200, 'green'),
    (gen_random_uuid(), b5, 'frame', 'Epic: Integrations',     100,  650, 1800, 200, 'violet'),
    (gen_random_uuid(), b5, 'frame', 'Epic: Analytics',        100,  900, 1800, 200, 'orange');
  -- Column headers
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, font_size) VALUES
    (gen_random_uuid(), b5, 'text', 'NOW',    300,  80, 200, 40, 'large'),
    (gen_random_uuid(), b5, 'text', 'NEXT',   900,  80, 200, 40, 'large'),
    (gen_random_uuid(), b5, 'text', 'LATER',  1500, 80, 200, 40, 'large');
  -- Stories
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    -- Core Platform
    (gen_random_uuid(), b5, 'sticky', 'Custom field types',        200,  200, 180, 80, 'light-blue'),
    (gen_random_uuid(), b5, 'sticky', 'Task templates',            450,  200, 180, 80, 'light-blue'),
    (gen_random_uuid(), b5, 'sticky', 'Saved views',               800,  200, 180, 80, 'light-blue'),
    (gen_random_uuid(), b5, 'sticky', 'Dependency graph',          1050, 200, 180, 80, 'light-blue'),
    (gen_random_uuid(), b5, 'sticky', 'Gantt chart',               1400, 200, 180, 80, 'light-blue'),
    (gen_random_uuid(), b5, 'sticky', 'Portfolio view',            1650, 200, 180, 80, 'light-blue'),
    -- Collaboration
    (gen_random_uuid(), b5, 'sticky', 'Real-time board editing',   200,  450, 180, 80, 'light-green'),
    (gen_random_uuid(), b5, 'sticky', 'Comment threads on tasks',  450,  450, 180, 80, 'light-green'),
    (gen_random_uuid(), b5, 'sticky', '@mentions in briefs',       800,  450, 180, 80, 'light-green'),
    (gen_random_uuid(), b5, 'sticky', 'Screen sharing in board',   1050, 450, 180, 80, 'light-green'),
    (gen_random_uuid(), b5, 'sticky', 'Video standup',             1400, 450, 180, 80, 'light-green'),
    -- Integrations
    (gen_random_uuid(), b5, 'sticky', 'Slack notifications',      200,  700, 180, 80, 'light-violet'),
    (gen_random_uuid(), b5, 'sticky', 'GitHub PR linking',        450,  700, 180, 80, 'light-violet'),
    (gen_random_uuid(), b5, 'sticky', 'Jira import',              800,  700, 180, 80, 'light-violet'),
    (gen_random_uuid(), b5, 'sticky', 'Zapier connector',         1050, 700, 180, 80, 'light-violet'),
    (gen_random_uuid(), b5, 'sticky', 'REST API v2',              1400, 700, 180, 80, 'light-violet'),
    -- Analytics
    (gen_random_uuid(), b5, 'sticky', 'Sprint velocity chart',    200,  950, 180, 80, 'light-orange'),
    (gen_random_uuid(), b5, 'sticky', 'Cycle time report',        450,  950, 180, 80, 'light-orange'),
    (gen_random_uuid(), b5, 'sticky', 'Custom dashboards',        800,  950, 180, 80, 'light-orange'),
    (gen_random_uuid(), b5, 'sticky', 'Export to PDF/CSV',        1050, 950, 180, 80, 'light-orange'),
    (gen_random_uuid(), b5, 'sticky', 'AI insights',              1400, 950, 180, 80, 'light-orange');

  -- ── Board 6: Team SWOT Analysis ───────────────────────────────────────────
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b6, 'frame', 'Strengths',      100,  150, 600, 500, 'green'),
    (gen_random_uuid(), b6, 'frame', 'Weaknesses',     800,  150, 600, 500, 'red'),
    (gen_random_uuid(), b6, 'frame', 'Opportunities',  100,  750, 600, 500, 'blue'),
    (gen_random_uuid(), b6, 'frame', 'Threats',        800,  750, 600, 500, 'orange');
  -- Strengths stickies
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b6, 'sticky', 'Strong full-stack team',             150,  230, 200, 80, 'light-green'),
    (gen_random_uuid(), b6, 'sticky', 'Fast CI/CD pipeline',               400,  230, 200, 80, 'light-green'),
    (gen_random_uuid(), b6, 'sticky', 'Good test coverage (85%+)',          150,  340, 200, 80, 'light-green'),
    (gen_random_uuid(), b6, 'sticky', 'Modern tech stack',                  400,  340, 200, 80, 'light-green'),
    (gen_random_uuid(), b6, 'sticky', 'Strong domain knowledge',           280,  450, 200, 80, 'light-green');
  -- Weaknesses stickies
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b6, 'sticky', 'Bus factor of 1 on infra',          850,  230, 200, 80, 'light-red'),
    (gen_random_uuid(), b6, 'sticky', 'Limited mobile experience',         1100, 230, 200, 80, 'light-red'),
    (gen_random_uuid(), b6, 'sticky', 'Tech debt in legacy modules',       850,  340, 200, 80, 'light-red'),
    (gen_random_uuid(), b6, 'sticky', 'No dedicated QA team',              1100, 340, 200, 80, 'light-red');
  -- Opportunities stickies
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b6, 'sticky', 'AI/LLM integration trend',          150,  830, 200, 80, 'light-blue'),
    (gen_random_uuid(), b6, 'sticky', 'Growing remote work market',        400,  830, 200, 80, 'light-blue'),
    (gen_random_uuid(), b6, 'sticky', 'Enterprise customers interested',   150,  940, 200, 80, 'light-blue'),
    (gen_random_uuid(), b6, 'sticky', 'Partner API marketplace',           400,  940, 200, 80, 'light-blue');
  -- Threats stickies
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b6, 'sticky', 'Big players (Jira, Linear) innovating fast',  850,  830, 200, 80, 'light-orange'),
    (gen_random_uuid(), b6, 'sticky', 'AI-native competitors emerging',              1100, 830, 200, 80, 'light-orange'),
    (gen_random_uuid(), b6, 'sticky', 'Potential team attrition',                    850,  940, 200, 80, 'light-orange'),
    (gen_random_uuid(), b6, 'sticky', 'Increasing security compliance requirements', 1100, 940, 200, 80, 'light-orange');
  -- Title
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, font_size) VALUES
    (gen_random_uuid(), b6, 'text', 'Engineering Team SWOT — Q2 2026', 400, 60, 600, 50, 'large');

  -- ── Board 7: Design Sprint Board ──────────────────────────────────────────
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b7, 'frame', 'Understand',  100,  150, 350, 500, 'blue'),
    (gen_random_uuid(), b7, 'frame', 'Sketch',      500,  150, 350, 500, 'green'),
    (gen_random_uuid(), b7, 'frame', 'Decide',      900,  150, 350, 500, 'violet'),
    (gen_random_uuid(), b7, 'frame', 'Prototype',   1300, 150, 350, 500, 'orange'),
    (gen_random_uuid(), b7, 'frame', 'Test',        1700, 150, 350, 500, 'red');
  -- Stickies per phase
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    (gen_random_uuid(), b7, 'sticky', 'Interview 5 users about pain points',         130,  230, 180, 80, 'light-blue'),
    (gen_random_uuid(), b7, 'sticky', 'Map current user journey',                    130,  340, 180, 80, 'light-blue'),
    (gen_random_uuid(), b7, 'sticky', 'Define key metrics',                          130,  450, 180, 80, 'light-blue'),
    (gen_random_uuid(), b7, 'sticky', 'Crazy 8s sketching session',                  530,  230, 180, 80, 'light-green'),
    (gen_random_uuid(), b7, 'sticky', 'Solution sketch per team member',             530,  340, 180, 80, 'light-green'),
    (gen_random_uuid(), b7, 'sticky', 'Heat map voting on sketches',                 530,  450, 180, 80, 'light-green'),
    (gen_random_uuid(), b7, 'sticky', 'Dot vote on top 3 solutions',                930,  230, 180, 80, 'light-violet'),
    (gen_random_uuid(), b7, 'sticky', 'Storyboard the winner',                      930,  340, 180, 80, 'light-violet'),
    (gen_random_uuid(), b7, 'sticky', 'Define test hypotheses',                     930,  450, 180, 80, 'light-violet'),
    (gen_random_uuid(), b7, 'sticky', 'Build clickable Figma prototype',            1330, 230, 180, 80, 'light-orange'),
    (gen_random_uuid(), b7, 'sticky', 'Add realistic data',                         1330, 340, 180, 80, 'light-orange'),
    (gen_random_uuid(), b7, 'sticky', 'Run 5 user test sessions',                   1730, 230, 180, 80, 'light-red'),
    (gen_random_uuid(), b7, 'sticky', 'Document findings',                          1730, 340, 180, 80, 'light-red'),
    (gen_random_uuid(), b7, 'sticky', 'Decide: ship, iterate, or pivot',            1730, 450, 180, 80, 'light-red');
  -- Title
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, font_size) VALUES
    (gen_random_uuid(), b7, 'text', 'Design Sprint — Onboarding Redesign', 600, 60, 700, 50, 'large');

  -- ── Board 8: Weekly Standup Notes ─────────────────────────────────────────
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, font_size) VALUES
    (gen_random_uuid(), b8, 'text', 'Week of Mar 31',     100,  100, 300, 40, 'large'),
    (gen_random_uuid(), b8, 'text', 'Week of Mar 24',     100,  600, 300, 40, 'large'),
    (gen_random_uuid(), b8, 'text', 'Week of Mar 17',     100,  1100, 300, 40, 'large');
  INSERT INTO board_elements (id, board_id, element_type, text_content, x, y, width, height, color) VALUES
    -- Week of Mar 31
    (gen_random_uuid(), b8, 'sticky', 'Eddie: Finished board API, starting frontend components',  100,  170, 250, 80, 'yellow'),
    (gen_random_uuid(), b8, 'sticky', 'Sarah: PR for auth refactor merged, moving to RBAC',       400,  170, 250, 80, 'yellow'),
    (gen_random_uuid(), b8, 'sticky', 'Marcus: Investigating WebSocket scaling issue',             700,  170, 250, 80, 'orange'),
    (gen_random_uuid(), b8, 'sticky', 'Priya: Design system v2 components ready for review',      100,  280, 250, 80, 'yellow'),
    (gen_random_uuid(), b8, 'sticky', 'Alex: CI pipeline optimized — 40% faster builds',          400,  280, 250, 80, 'light-green'),
    (gen_random_uuid(), b8, 'sticky', 'Jordan: Beacon search accuracy improved to 94%',           700,  280, 250, 80, 'light-green'),
    (gen_random_uuid(), b8, 'sticky', 'BLOCKED: Waiting on design approval for settings page',    100,  390, 250, 80, 'red'),
    -- Week of Mar 24
    (gen_random_uuid(), b8, 'sticky', 'Eddie: Board schema and migration done',                   100,  670, 250, 80, 'yellow'),
    (gen_random_uuid(), b8, 'sticky', 'Sarah: Auth refactor 80% complete',                        400,  670, 250, 80, 'yellow'),
    (gen_random_uuid(), b8, 'sticky', 'Marcus: Redis PubSub benchmarks look good',                700,  670, 250, 80, 'light-green'),
    (gen_random_uuid(), b8, 'sticky', 'Priya: Wireframes approved for onboarding flow',           100,  780, 250, 80, 'light-green'),
    (gen_random_uuid(), b8, 'sticky', 'Alex: Docker multi-stage builds reducing image size',      400,  780, 250, 80, 'yellow'),
    -- Week of Mar 17
    (gen_random_uuid(), b8, 'sticky', 'Sprint 14 closed — all goals met',                         100,  1170, 250, 80, 'light-green'),
    (gen_random_uuid(), b8, 'sticky', 'Team agreed on Board feature scope',                       400,  1170, 250, 80, 'yellow'),
    (gen_random_uuid(), b8, 'sticky', 'Hired new QA contractor starting next week',               700,  1170, 250, 80, 'light-green');

  -- ══════════════════════════════════════════════════════════════════════════
  -- CHAT MESSAGES
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO board_chat_messages (board_id, author_id, body, created_at) VALUES
    -- Board 1 chats
    (b1, v_u1, 'Great retro everyone! Let''s make sure we follow up on these action items.',          NOW() - INTERVAL '2 days'),
    (b1, v_u2, 'I added the acceptance criteria template idea — that will really help.',               NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
    (b1, v_u3, 'Agreed on the WIP limit. Let''s try 2 items per dev for sprint 16.',                  NOW() - INTERVAL '2 days' + INTERVAL '10 minutes'),
    -- Board 2 chats
    (b2, v_u2, 'Please add your votes by Friday! Top 3 features move to the roadmap.',                NOW() - INTERVAL '6 days'),
    (b2, v_u5, 'I think real-time editing and AI estimation are the highest-impact features.',         NOW() - INTERVAL '5 days'),
    (b2, v_u4, 'Don''t forget mobile — our users keep asking for it.',                                 NOW() - INTERVAL '5 days' + INTERVAL '30 minutes'),
    (b2, v_u1, 'Mobile is important but very expensive. Let''s discuss ROI in planning.',               NOW() - INTERVAL '4 days'),
    -- Board 3 chats
    (b3, v_u3, 'Updated the architecture with the new Qdrant integration for Beacon.',                 NOW() - INTERVAL '5 days'),
    (b3, v_u1, 'Looks good. Should we add the MCP server layer too?',                                  NOW() - INTERVAL '4 days'),
    (b3, v_u3, 'Good call — added it to External Services.',                                           NOW() - INTERVAL '4 days' + INTERVAL '1 hour'),
    -- Board 5 chats
    (b5, v_u1, 'Moved custom fields to NOW — it''s blocking several enterprise deals.',                NOW() - INTERVAL '10 days'),
    (b5, v_u2, 'Agree. Let''s also bump Slack integration since it''s partially done.',                 NOW() - INTERVAL '9 days'),
    -- Board 6 chats
    (b6, v_u2, 'Let''s be honest about weaknesses — that''s how we improve.',                           NOW() - INTERVAL '4 days'),
    (b6, v_u6, 'Added the bus factor concern. We should do knowledge-sharing sessions.',                NOW() - INTERVAL '4 days' + INTERVAL '20 minutes'),
    -- Board 7 chats
    (b7, v_u5, 'Sprint starts Monday! Make sure interviews are scheduled.',                             NOW() - INTERVAL '5 days'),
    (b7, v_u4, 'I have 3 users confirmed for Wednesday testing slots.',                                 NOW() - INTERVAL '4 days'),
    (b7, v_u5, 'Perfect — let''s aim for 5 total. I''ll reach out to 2 more.',                          NOW() - INTERVAL '4 days' + INTERVAL '15 minutes'),
    -- Board 8 chats
    (b8, v_u1, 'Let''s keep standup notes here so we have a running record.',                           NOW() - INTERVAL '25 days'),
    (b8, v_u6, 'Good idea. I''ll add my updates after each standup.',                                   NOW() - INTERVAL '24 days');

  -- ══════════════════════════════════════════════════════════════════════════
  -- COLLABORATORS
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO board_collaborators (board_id, user_id, permission) VALUES
    -- Board 1: Sprint Retro (whole team)
    (b1, v_u1, 'edit'), (b1, v_u2, 'edit'), (b1, v_u3, 'edit'), (b1, v_u4, 'edit'),
    -- Board 2: Brainstorm (org-wide participation)
    (b2, v_u1, 'edit'), (b2, v_u2, 'edit'), (b2, v_u3, 'edit'), (b2, v_u5, 'edit'),
    -- Board 3: Architecture (engineers)
    (b3, v_u1, 'edit'), (b3, v_u3, 'edit'), (b3, v_u6, 'view'),
    -- Board 4: Onboarding Flow (design + PM)
    (b4, v_u4, 'edit'), (b4, v_u2, 'edit'), (b4, v_u5, 'view'),
    -- Board 5: Roadmap (leadership)
    (b5, v_u1, 'edit'), (b5, v_u2, 'edit'), (b5, v_u4, 'view'),
    -- Board 6: SWOT (whole team)
    (b6, v_u2, 'edit'), (b6, v_u3, 'edit'), (b6, v_u6, 'edit'),
    -- Board 7: Design Sprint (design team + PM)
    (b7, v_u4, 'edit'), (b7, v_u5, 'edit'), (b7, v_u2, 'view'),
    -- Board 8: Standup Notes (whole team)
    (b8, v_u1, 'edit'), (b8, v_u2, 'edit'), (b8, v_u3, 'edit'), (b8, v_u6, 'edit');

  -- ══════════════════════════════════════════════════════════════════════════
  -- STARS
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO board_stars (board_id, user_id) VALUES
    (b1, v_u1), (b1, v_u2),           -- Retro starred by Eddie & Sarah
    (b2, v_u2), (b2, v_u5),           -- Brainstorm starred by Sarah & Alex
    (b3, v_u3),                        -- Architecture starred by Marcus
    (b5, v_u1), (b5, v_u2), (b5, v_u4), -- Roadmap starred by Eddie, Sarah, Priya
    (b7, v_u5),                        -- Design Sprint starred by Alex
    (b8, v_u1);                        -- Standup Notes starred by Eddie

  RAISE NOTICE 'Seeded 8 boards, ~170 elements, 19 chat messages, 28 collaborators, 10 stars';
END $$;
