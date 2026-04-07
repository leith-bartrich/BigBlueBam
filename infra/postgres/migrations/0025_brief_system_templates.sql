-- 0025_brief_system_templates.sql
-- Why: Install 33 system templates for Brief across 7 categories (business
--   operations, strategy & planning, people & HR, engineering, communications,
--   sales & external, creative & marketing). These are available to all
--   installations (org_id IS NULL).
-- Client impact: additive only — inserts into brief_templates.

-- Guard: only insert if no system templates exist yet
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM brief_templates WHERE org_id IS NULL LIMIT 1) THEN
    RAISE NOTICE 'System templates already exist, skipping';
    RETURN;
  END IF;

  -- We need a valid user ID for created_by. Use the first user in the system.
  -- If no users exist yet (fresh install), the templates will be seeded by the
  -- seed script instead.
  DECLARE
    v_uid UUID;
  BEGIN
    SELECT id INTO v_uid FROM users LIMIT 1;
    IF v_uid IS NULL THEN
      RAISE NOTICE 'No users exist yet, skipping template seed (run seed script after first user creation)';
      RETURN;
    END IF;

    INSERT INTO brief_templates (org_id, name, description, icon, category, yjs_state, html_preview, sort_order, created_by) VALUES
      -- Business Operations (7)
      (NULL, 'Meeting Notes', 'Capture agenda, discussion, decisions, and action items from any meeting.', E'\U0001F4CB', 'business-operations', E'\\x7b7d', '<h1>Meeting Notes</h1><p>Date, attendees, agenda, discussion, decisions, action items.</p>', 0, v_uid),
      (NULL, 'Project Brief', 'Define the scope, goals, timeline, and stakeholders for a new project.', E'\U0001F4CC', 'business-operations', E'\\x7b7d', '<h1>Project Brief</h1><p>Executive summary, problem statement, goals, scope, timeline, risks.</p>', 1, v_uid),
      (NULL, 'Project Status Report', 'Weekly or biweekly update on project health, progress, and blockers.', E'\U0001F4CA', 'business-operations', E'\\x7b7d', '<h1>Project Status Report</h1><p>Summary, accomplished, in progress, blockers, next steps.</p>', 2, v_uid),
      (NULL, 'Post-Mortem / Retrospective', 'Analyze an incident or sprint to capture lessons and prevent recurrence.', E'\U0001F525', 'business-operations', E'\\x7b7d', '<h1>Post-Mortem</h1><p>Timeline, root cause, impact, action items, lessons learned.</p>', 3, v_uid),
      (NULL, 'Decision Log', 'Record important decisions with context, alternatives, and rationale.', E'\u2696\uFE0F', 'business-operations', E'\\x7b7d', '<h1>Decision Log</h1><p>Context, options considered, decision, consequences.</p>', 4, v_uid),
      (NULL, 'Standard Operating Procedure', 'Step-by-step instructions for a repeatable process.', E'\U0001F4D8', 'business-operations', E'\\x7b7d', '<h1>SOP</h1><p>Purpose, prerequisites, procedure steps, troubleshooting.</p>', 5, v_uid),
      (NULL, 'Change Request', 'Propose a change to scope, timeline, or requirements with impact analysis.', E'\U0001F504', 'business-operations', E'\\x7b7d', '<h1>Change Request</h1><p>Proposed change, reason, impact analysis, approval.</p>', 6, v_uid),
      -- Strategy & Planning (6)
      (NULL, 'Product Requirements Document (PRD)', 'Define what to build, for whom, and why.', E'\U0001F3AF', 'strategy-planning', E'\\x7b7d', '<h1>PRD</h1><p>Problem, personas, goals, requirements, design, rollout plan.</p>', 10, v_uid),
      (NULL, 'OKRs / Goals Tracker', 'Set and track Objectives and Key Results for a quarter.', E'\U0001F3AF', 'strategy-planning', E'\\x7b7d', '<h1>OKRs</h1><p>Objectives with measurable key results and scoring.</p>', 11, v_uid),
      (NULL, 'Quarterly Business Review', 'Summarize business performance, metrics, wins, and challenges.', E'\U0001F4C8', 'strategy-planning', E'\\x7b7d', '<h1>QBR</h1><p>Executive summary, key metrics, wins, challenges, priorities.</p>', 12, v_uid),
      (NULL, 'Competitive Analysis', 'Structured comparison of your product against competitors.', E'\U0001F50D', 'strategy-planning', E'\\x7b7d', '<h1>Competitive Analysis</h1><p>Market overview, feature comparison, implications.</p>', 13, v_uid),
      (NULL, 'SWOT Analysis', 'Map Strengths, Weaknesses, Opportunities, and Threats.', E'\U0001F9ED', 'strategy-planning', E'\\x7b7d', '<h1>SWOT Analysis</h1><p>Internal strengths/weaknesses, external opportunities/threats.</p>', 14, v_uid),
      (NULL, 'Roadmap Overview', 'High-level view of planned work across a time horizon.', E'\U0001F5FA', 'strategy-planning', E'\\x7b7d', '<h1>Roadmap</h1><p>Vision, now/next/later priorities, exploring ideas.</p>', 15, v_uid),
      -- People & HR (5)
      (NULL, '1:1 Meeting Template', 'Structured agenda for regular manager-report check-ins.', E'\U0001F91D', 'people-hr', E'\\x7b7d', '<h1>1:1 Meeting</h1><p>Action items, your topics, manager topics, career growth.</p>', 20, v_uid),
      (NULL, 'Performance Review', 'Self-assessment and manager evaluation template.', E'\u2B50', 'people-hr', E'\\x7b7d', '<h1>Performance Review</h1><p>Self-assessment, manager assessment, goals.</p>', 21, v_uid),
      (NULL, 'Job Description', 'Template for writing clear, inclusive job postings.', E'\U0001F4BC', 'people-hr', E'\\x7b7d', '<h1>Job Description</h1><p>Role, responsibilities, must-haves, nice-to-haves.</p>', 22, v_uid),
      (NULL, 'Onboarding Checklist', 'Week-by-week checklist for onboarding a new team member.', E'\u2705', 'people-hr', E'\\x7b7d', '<h1>Onboarding Checklist</h1><p>Before day 1, week 1, week 2, week 3-4.</p>', 23, v_uid),
      (NULL, 'Team Charter', 'Define team mission, values, working agreements, and norms.', E'\U0001F3F4', 'people-hr', E'\\x7b7d', '<h1>Team Charter</h1><p>Mission, members, agreements, communication norms.</p>', 24, v_uid),
      -- Engineering (6)
      (NULL, 'Technical Design Doc / RFC', 'Propose a technical approach with design, tradeoffs, and alternatives.', E'\U0001F4D0', 'engineering', E'\\x7b7d', '<h1>RFC</h1><p>Summary, motivation, detailed design, alternatives, risks, testing.</p>', 30, v_uid),
      (NULL, 'Architecture Decision Record', 'Lightweight record of a specific architectural decision.', E'\U0001F3DB', 'engineering', E'\\x7b7d', '<h1>ADR</h1><p>Context, decision, consequences.</p>', 31, v_uid),
      (NULL, 'Bug Report', 'Structured report for reproducing and tracking a bug.', E'\U0001F41B', 'engineering', E'\\x7b7d', '<h1>Bug Report</h1><p>Steps to reproduce, expected vs actual, screenshots.</p>', 32, v_uid),
      (NULL, 'Runbook', 'Operational procedures for managing a service or handling alerts.', E'\U0001F527', 'engineering', E'\\x7b7d', '<h1>Runbook</h1><p>Service overview, common alerts, resolution steps, useful commands.</p>', 33, v_uid),
      (NULL, 'API Documentation', 'Template for documenting a REST API with endpoints and examples.', E'\U0001F50C', 'engineering', E'\\x7b7d', '<h1>API Documentation</h1><p>Base URL, authentication, endpoints with examples.</p>', 34, v_uid),
      (NULL, 'Release Notes', 'Communicate what shipped, what changed, and known issues.', E'\U0001F680', 'engineering', E'\\x7b7d', '<h1>Release Notes</h1><p>Highlights, new features, improvements, bug fixes.</p>', 35, v_uid),
      -- Communications (4)
      (NULL, 'Internal Memo / Announcement', 'Communicate important news or decisions to the organization.', E'\U0001F4E3', 'communications', E'\\x7b7d', '<h1>Memo</h1><p>TL;DR, details, what this means for you, timeline.</p>', 40, v_uid),
      (NULL, 'Weekly Newsletter', 'Internal team or company newsletter template.', E'\U0001F4F0', 'communications', E'\\x7b7d', '<h1>Weekly Update</h1><p>Top story, wins, in progress, heads up, spotlight.</p>', 41, v_uid),
      (NULL, 'Press Release', 'External announcement following the inverted pyramid format.', E'\U0001F4F0', 'communications', E'\\x7b7d', '<h1>Press Release</h1><p>Headline, lead paragraph, quote, details, boilerplate.</p>', 42, v_uid),
      (NULL, 'FAQ Document', 'Anticipate and answer frequently asked questions.', E'\u2753', 'communications', E'\\x7b7d', '<h1>FAQ</h1><p>Grouped questions and answers by theme.</p>', 43, v_uid),
      -- Sales & External (4)
      (NULL, 'Proposal / Statement of Work', 'Scope, deliverables, timeline, and pricing for client engagements.', E'\U0001F4D1', 'sales-external', E'\\x7b7d', '<h1>Proposal</h1><p>Executive summary, scope, timeline, investment, terms.</p>', 50, v_uid),
      (NULL, 'Client Brief', 'Capture client requirements, goals, and constraints.', E'\U0001F91D', 'sales-external', E'\\x7b7d', '<h1>Client Brief</h1><p>Client overview, current situation, goals, constraints.</p>', 51, v_uid),
      (NULL, 'Case Study', 'Tell the story of how a client achieved results.', E'\U0001F3C6', 'sales-external', E'\\x7b7d', '<h1>Case Study</h1><p>Challenge, solution, results, client quote.</p>', 52, v_uid),
      (NULL, 'Executive Summary', 'One-page summary for busy stakeholders.', E'\U0001F4C4', 'sales-external', E'\\x7b7d', '<h1>Executive Summary</h1><p>Recommendation, background, findings, options.</p>', 53, v_uid),
      -- Creative & Marketing (4)
      (NULL, 'Content Brief', 'Define audience, messaging, and requirements for content.', E'\u270D\uFE0F', 'creative-marketing', E'\\x7b7d', '<h1>Content Brief</h1><p>Key message, outline, SEO keywords, brand voice.</p>', 60, v_uid),
      (NULL, 'Campaign Plan', 'Plan a marketing campaign from goals through measurement.', E'\U0001F4E2', 'creative-marketing', E'\\x7b7d', '<h1>Campaign Plan</h1><p>Objective, audience, messages, channels, timeline, metrics.</p>', 61, v_uid),
      (NULL, 'Brand Guidelines Reference', 'Quick reference for brand voice, colors, and typography.', E'\U0001F3A8', 'creative-marketing', E'\\x7b7d', '<h1>Brand Guidelines</h1><p>Voice, colors, typography, logo usage.</p>', 62, v_uid),
      (NULL, 'Editorial Calendar', 'Plan and track content publication across channels.', E'\U0001F4C5', 'creative-marketing', E'\\x7b7d', '<h1>Editorial Calendar</h1><p>Date, title, type, channel, writer, status.</p>', 63, v_uid),
      -- General (1)
      (NULL, 'Blank Document', 'Start from scratch with an empty document.', E'\U0001F4C4', 'general', E'\\x7b7d', '<h1>Untitled</h1><p>Start writing...</p>', 99, v_uid);

    RAISE NOTICE 'Inserted 33 system templates';
  END;
END $$;
