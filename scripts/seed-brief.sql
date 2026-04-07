-- Seed Brief demo data for Mage Inc
DO $$
DECLARE
  v_org UUID := '57158e52-227d-4903-b0d8-d9f3c4910f61';
  v_proj UUID := '650b38cb-3b36-4014-bf96-17f7617b326a';
  v_u1 UUID := '65429e63-65c7-4f74-a19e-977217128edc';
  v_u2 UUID := 'cffb3330-4868-4741-95f4-564efe27836a';
  v_u3 UUID := 'f290dd98-65fa-403a-9778-6dbda873fc98';
  v_u4 UUID := '138894b9-58ef-4eb4-9d27-bf36fff48885';
  v_u5 UUID := 'baa36964-d672-4271-ae96-b0cf5b1062a4';
  v_u6 UUID := '5e77088e-6d83-4821-8f9d-7857d2aefb68';
  v_u7 UUID := '851ecd19-c928-4263-9869-e1904b554276';
  v_u8 UUID := 'dd98bdfe-7ee4-4bd3-b6ee-70fb8fc0efc8';
  f_eng UUID := gen_random_uuid();
  f_mtg UUID := gen_random_uuid();
  f_rfc UUID := gen_random_uuid();
  f_onb UUID := gen_random_uuid();
  f_pm UUID := gen_random_uuid();
  d1 UUID; d2 UUID; d3 UUID; d4 UUID; d5 UUID; d6 UUID; d7 UUID; d8 UUID;
  d9 UUID; d10 UUID; d11 UUID; d12 UUID; d13 UUID; d14 UUID; d15 UUID;
BEGIN
  -- Clean
  DELETE FROM brief_stars WHERE document_id IN (SELECT id FROM brief_documents WHERE org_id = v_org);
  DELETE FROM brief_comment_reactions WHERE comment_id IN (SELECT c.id FROM brief_comments c JOIN brief_documents d ON c.document_id = d.id WHERE d.org_id = v_org);
  DELETE FROM brief_comments WHERE document_id IN (SELECT id FROM brief_documents WHERE org_id = v_org);
  DELETE FROM brief_versions WHERE document_id IN (SELECT id FROM brief_documents WHERE org_id = v_org);
  DELETE FROM brief_embeds WHERE document_id IN (SELECT id FROM brief_documents WHERE org_id = v_org);
  DELETE FROM brief_collaborators WHERE document_id IN (SELECT id FROM brief_documents WHERE org_id = v_org);
  DELETE FROM brief_documents WHERE org_id = v_org;
  DELETE FROM brief_folders WHERE org_id = v_org;
  DELETE FROM brief_templates WHERE org_id IS NULL;

  -- Folders
  INSERT INTO brief_folders (id, org_id, project_id, name, slug, sort_order, created_by) VALUES
    (f_eng, v_org, v_proj, 'Engineering', 'engineering', 0, v_u1),
    (f_mtg, v_org, v_proj, 'Meeting Notes', 'meeting-notes', 1, v_u1),
    (f_rfc, v_org, v_proj, 'RFCs', 'rfcs', 2, v_u1),
    (f_onb, v_org, v_proj, 'Onboarding', 'onboarding', 3, v_u1),
    (f_pm, v_org, v_proj, 'Post-Mortems', 'post-mortems', 4, v_u1);

  -- Templates
  INSERT INTO brief_templates (org_id, name, description, icon, category, yjs_state, sort_order, created_by) VALUES
    (NULL, 'Meeting Notes', 'Date, attendees, agenda, discussion, action items', E'\U0001F4CB', 'meeting', E'\\x7b7d', 0, v_u1),
    (NULL, 'RFC', 'Title, status, motivation, detailed design, alternatives', E'\U0001F4D0', 'engineering', E'\\x7b7d', 1, v_u1),
    (NULL, 'Post-Mortem', 'Incident summary, timeline, root cause, action items', E'\U0001F525', 'engineering', E'\\x7b7d', 2, v_u1),
    (NULL, 'Sprint Retrospective', 'What went well, what did not, action items', E'\U0001F504', 'engineering', E'\\x7b7d', 3, v_u1),
    (NULL, 'Design Spec', 'Overview, goals, non-goals, detailed design', E'\U0001F4DD', 'engineering', E'\\x7b7d', 4, v_u1),
    (NULL, 'Onboarding Guide', 'Welcome, setup, first week checklist', E'\U0001F44B', 'hr', E'\\x7b7d', 5, v_u1),
    (NULL, 'Decision Log', 'Decision, context, options, rationale', E'\u2696\uFE0F', 'general', E'\\x7b7d', 6, v_u1),
    (NULL, 'Blank', 'Empty document', E'\U0001F4C4', 'general', E'\\x7b7d', 7, v_u1);

  -- Documents
  d1 := gen_random_uuid(); d2 := gen_random_uuid(); d3 := gen_random_uuid();
  d4 := gen_random_uuid(); d5 := gen_random_uuid(); d6 := gen_random_uuid();
  d7 := gen_random_uuid(); d8 := gen_random_uuid(); d9 := gen_random_uuid();
  d10 := gen_random_uuid(); d11 := gen_random_uuid(); d12 := gen_random_uuid();
  d13 := gen_random_uuid(); d14 := gen_random_uuid(); d15 := gen_random_uuid();

  INSERT INTO brief_documents (id, org_id, project_id, folder_id, title, slug, plain_text, icon, status, visibility, word_count, created_by, updated_by, created_at, updated_at) VALUES
    (d1, v_org, v_proj, f_rfc, 'RFC: Migrate to PostgreSQL 17', 'rfc-migrate-to-postgresql-17', 'Standards and analysis for upgrading our PostgreSQL 16 cluster to PG 17. Covers JSON_TABLE migration, incremental backups, and MERGE improvements. Timeline: April 7-20 cutover with blue-green deployment strategy.', E'\U0001F4D0', 'in_review', 'project', 180, v_u2, v_u2, NOW()-INTERVAL '14 days', NOW()-INTERVAL '1 day'),
    (d2, v_org, v_proj, f_mtg, 'Sprint 14 Retrospective', 'sprint-14-retrospective', 'What went well: Beacon graph launched on time, Helpdesk AI triage at 73%. What did not go well: Banter voice calls slipped 3 days, PRs sat in review too long. Actions: review rotation, LiveKit runbook.', E'\U0001F504', 'approved', 'project', 120, v_u4, v_u4, NOW()-INTERVAL '10 days', NOW()-INTERVAL '8 days'),
    (d3, v_org, v_proj, f_pm, 'Post-Mortem: Redis Memory Spike (March 15)', 'post-mortem-redis-memory-spike', 'Redis hit 95% memory at 14:23 UTC. Root cause: Banter presence keys missing TTL. 180K stale keys accumulated over 2 weeks. Fixed with 60s TTL hotfix. 23 minutes of degradation, no data loss.', E'\U0001F525', 'approved', 'project', 200, v_u6, v_u6, NOW()-INTERVAL '23 days', NOW()-INTERVAL '20 days'),
    (d4, v_org, v_proj, f_onb, 'Onboarding Guide: New Engineer Setup', 'onboarding-guide-new-engineer', 'Day 1: clone repo, docker compose up, verify 15 services. Day 2: read CLAUDE.md and design docs. Day 3-5: pick up onboarding ticket from board. Ask questions in #engineering on Banter.', E'\U0001F44B', 'approved', 'organization', 250, v_u1, v_u1, NOW()-INTERVAL '60 days', NOW()-INTERVAL '5 days'),
    (d5, v_org, v_proj, f_rfc, 'Design Spec: Brief (Collaborative Documents)', 'design-spec-brief', 'Brief is the collaborative doc editor for BigBlueBam. Real-time Yjs editing, cross-product linking to Bam tasks and Beacon articles, Brief-to-Beacon graduation. 18 dedicated MCP tools for AI co-authoring.', E'\U0001F4DD', 'approved', 'project', 350, v_u1, v_u2, NOW()-INTERVAL '30 days', NOW()-INTERVAL '2 days'),
    (d6, v_org, v_proj, f_mtg, 'Weekly Standup Notes: April 7, 2026', 'weekly-standup-april-7-2026', 'Updates from Alex (Brief API complete), Ryan (Brief SPA routing done), Maya (18 MCP tools registered), Jordan (Docker service #15 added), Taylor (writing test suite). No blockers.', E'\U0001F4CB', 'draft', 'project', 95, v_u4, v_u4, NOW()-INTERVAL '1 day', NOW()-INTERVAL '2 hours'),
    (d7, v_org, v_proj, f_eng, 'API Rate Limiting Strategy', 'api-rate-limiting-strategy', 'Tiered rate limits: Read 200/min, Write 30/min, Expensive 10/min, Auth 5/min. Redis-backed sliding window for accuracy. API keys get 3x multiplier for agent workloads. Already deployed to Beacon and Brief.', E'\U0001F6E1', 'approved', 'project', 160, v_u3, v_u3, NOW()-INTERVAL '45 days', NOW()-INTERVAL '15 days'),
    (d8, v_org, v_proj, f_eng, 'MCP Tool Inventory & Coverage Matrix', 'mcp-tool-inventory', '158 MCP tools across 4 products: Bam 64, Banter 47, Beacon 29, Brief 18. Well covered: task CRUD, messaging, knowledge lifecycle. Gaps: bulk operations, unified cross-product search.', E'\U0001F916', 'approved', 'project', 140, v_u4, v_u4, NOW()-INTERVAL '20 days', NOW()-INTERVAL '1 day'),
    (d9, v_org, v_proj, f_rfc, 'Beacon to Brief Integration Spec', 'beacon-brief-integration-spec', 'Custom Tiptap beaconEmbed node renders inline Beacon cards with title, status badge, and freshness ring. Auto-creates brief_beacon_links row. Slash command /beacon opens search picker.', E'\U0001F517', 'draft', 'project', 130, v_u5, v_u5, NOW()-INTERVAL '7 days', NOW()-INTERVAL '3 days'),
    (d10, v_org, v_proj, f_eng, 'Database Schema Conventions', 'database-schema-conventions', 'snake_case tables and columns, UUID primary keys, required created_at and org_id columns, idempotent migrations with IF NOT EXISTS guards, visibility pattern for private/project/organization access.', E'\U0001F5C4', 'approved', 'organization', 200, v_u1, v_u1, NOW()-INTERVAL '80 days', NOW()-INTERVAL '30 days'),
    (d11, v_org, v_proj, NULL, 'Q2 2026 Engineering Roadmap', 'q2-2026-engineering-roadmap', 'April: Brief launch and Beacon security hardening. May: unified search, Helm v2, mobile optimization. June: AI multi-step workflows, SSO integration, performance audit. Target: p99 under 200ms.', E'\U0001F5FA', 'draft', 'project', 170, v_u1, v_u1, NOW()-INTERVAL '12 days', NOW()-INTERVAL '4 days'),
    (d12, v_org, v_proj, f_eng, 'Tiptap Editor Extension Registry', 'tiptap-editor-extensions', 'Core: StarterKit, Collaboration, CollaborationCursor. Rich content: Image, Link, Table, TaskList, CodeBlockLowlight. Custom: BamTaskEmbed, BeaconEmbed, BanterChannelLink, CalloutBlock, SlashCommand.', E'\u270F\uFE0F', 'draft', 'project', 110, v_u3, v_u3, NOW()-INTERVAL '5 days', NOW()-INTERVAL '1 day'),
    (d13, v_org, v_proj, f_eng, 'Docker Compose Service Map', 'docker-compose-service-map', '15 services total: 9 application (api, banter-api, helpdesk-api, beacon-api, brief-api, mcp-server, worker, voice-agent, frontend) plus 5 data services and 1 init container.', E'\U0001F433', 'approved', 'organization', 150, v_u6, v_u6, NOW()-INTERVAL '40 days', NOW()-INTERVAL '1 day'),
    (d14, v_org, v_proj, NULL, 'Security Audit Checklist Template', 'security-audit-checklist', 'Authentication, input validation with Zod, data access isolation, rate limiting, response security headers, dependency auditing. ILIKE escapeLike helper, cross-org link validation, IDOR protection.', E'\U0001F512', 'approved', 'organization', 130, v_u7, v_u7, NOW()-INTERVAL '25 days', NOW()-INTERVAL '10 days'),
    (d15, v_org, v_proj, NULL, 'Brief Launch Checklist', 'brief-launch-checklist', 'Backend: all endpoints tested, security audit complete, P0/P1 fixed. Frontend: all pages rendering, dark/light mode working. MCP: 18 tools registered. Infra: Docker healthy, nginx routing. Docs: updated.', E'\U0001F680', 'in_review', 'project', 100, v_u2, v_u4, NOW()-INTERVAL '3 days', NOW()-INTERVAL '6 hours');

  -- Versions
  INSERT INTO brief_versions (document_id, version_number, title, yjs_state, plain_text, word_count, change_summary, created_by)
  SELECT id, 1, title, E'\\x7b7d', plain_text, word_count, 'Initial version', created_by FROM brief_documents WHERE org_id = v_org;

  -- Comments
  INSERT INTO brief_comments (document_id, author_id, body) VALUES
    (d1, v_u3, 'Have we checked if pg_repack works on PG 17? We rely on it for zero-downtime table rewrites.'),
    (d1, v_u2, 'Good call. Adding to the extension compatibility checklist.'),
    (d1, v_u6, 'The blue-green cutover on Sunday looks good. Can we do a dry run Saturday?'),
    (d1, v_u5, 'Plus one on dry run. Also need a rollback plan documented.'),
    (d2, v_u4, 'Review rotation is a great idea. Pair it with a Banter bot ping after 12 hours.'),
    (d2, v_u6, 'Agreed. I will set up the bot this sprint.'),
    (d15, v_u7, 'Should we add browser compatibility testing to the pre-launch list?'),
    (d15, v_u3, 'The Yjs crash recovery test is critical. We should block launch on it.'),
    (d15, v_u8, 'I can help with the accessibility audit. Grabbing that task.'),
    (d11, v_u5, 'Can we move SSO earlier? Enterprise customers are asking for it.'),
    (d7, v_u6, 'The 3x rate multiplier for API keys is generous. Should we monitor for abuse?'),
    (d8, v_u1, 'We should also track MCP tool usage metrics to identify the most popular tools.');

  -- Stars
  INSERT INTO brief_stars (document_id, user_id) VALUES
    (d4, v_u1), (d4, v_u2), (d4, v_u3), (d4, v_u4), (d4, v_u5),
    (d2, v_u1), (d2, v_u2), (d2, v_u3), (d2, v_u6),
    (d11, v_u1), (d11, v_u2), (d11, v_u4),
    (d15, v_u1), (d15, v_u2), (d15, v_u3), (d15, v_u7),
    (d5, v_u1), (d5, v_u3),
    (d10, v_u1), (d10, v_u2), (d10, v_u5);

  RAISE NOTICE 'Seeded 15 documents, 5 folders, 8 templates, 12 comments, 21 stars';
END $$;
