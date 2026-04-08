-- Seed Bolt demo data for Mage Inc
-- Run: docker compose exec -T postgres psql -U bigbluebam < scripts/seed-bolt.sql

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

  a1 UUID; a2 UUID; a3 UUID; a4 UUID; a5 UUID;
  a6 UUID; a7 UUID; a8 UUID; a9 UUID; a10 UUID;
  a11 UUID; a12 UUID;
  e1 UUID; e2 UUID; e3 UUID; e4 UUID; e5 UUID;
BEGIN
  -- Clean existing
  DELETE FROM bolt_execution_steps WHERE execution_id IN (SELECT id FROM bolt_executions WHERE automation_id IN (SELECT id FROM bolt_automations WHERE org_id = v_org));
  DELETE FROM bolt_executions WHERE automation_id IN (SELECT id FROM bolt_automations WHERE org_id = v_org);
  DELETE FROM bolt_conditions WHERE automation_id IN (SELECT id FROM bolt_automations WHERE org_id = v_org);
  DELETE FROM bolt_actions WHERE automation_id IN (SELECT id FROM bolt_automations WHERE org_id = v_org);
  DELETE FROM bolt_schedules WHERE automation_id IN (SELECT id FROM bolt_automations WHERE org_id = v_org);
  DELETE FROM bolt_automations WHERE org_id = v_org;

  -- ── Automations ──
  a1 := gen_random_uuid(); a2 := gen_random_uuid(); a3 := gen_random_uuid();
  a4 := gen_random_uuid(); a5 := gen_random_uuid(); a6 := gen_random_uuid();
  a7 := gen_random_uuid(); a8 := gen_random_uuid(); a9 := gen_random_uuid();
  a10 := gen_random_uuid(); a11 := gen_random_uuid(); a12 := gen_random_uuid();

  INSERT INTO bolt_automations (id, org_id, project_id, name, description, enabled, trigger_source, trigger_event, trigger_filter, max_executions_per_hour, cooldown_seconds, created_by, last_executed_at) VALUES
    (a1, v_org, v_proj, 'Notify on Critical Task', 'Posts to #engineering when a critical task is created', true, 'bam', 'task.created', '{"priority": "critical"}', 100, 0, v_u1, NOW() - INTERVAL '2 hours'),
    (a2, v_org, v_proj, 'Overdue Task Alert', 'DMs the assignee when a task is overdue by 2+ days', true, 'bam', 'task.overdue', NULL, 50, 300, v_u2, NOW() - INTERVAL '6 hours'),
    (a3, v_org, v_proj, 'Sprint Complete Report', 'Posts sprint report to #engineering when a sprint completes', true, 'bam', 'sprint.completed', NULL, 10, 0, v_u1, NOW() - INTERVAL '7 days'),
    (a4, v_org, v_proj, 'Helpdesk Auto-Assign Billing', 'Assigns billing tickets to the billing team lead', true, 'helpdesk', 'ticket.created', '{"category": "billing"}', 100, 0, v_u3, NOW() - INTERVAL '1 hour'),
    (a5, v_org, v_proj, 'SLA Breach Escalation', 'Escalates tickets to P0 and notifies team lead on SLA breach', true, 'helpdesk', 'ticket.sla_breach', NULL, 50, 60, v_u3, NOW() - INTERVAL '3 days'),
    (a6, v_org, v_proj, 'Beacon Expiry Reminder', 'Posts reminder to #knowledge when a beacon expires', true, 'beacon', 'beacon.expired', NULL, 100, 0, v_u4, NOW() - INTERVAL '1 day'),
    (a7, v_org, v_proj, 'New Document Notification', 'Notifies project channel when a Brief document is created', true, 'brief', 'document.created', NULL, 100, 0, v_u5, NOW() - INTERVAL '5 hours'),
    (a8, v_org, NULL, 'Weekly Status Update', 'Posts a weekly summary every Monday at 9am', true, 'schedule', 'cron.fired', NULL, 1, 0, v_u1, NOW() - INTERVAL '7 days'),
    (a9, v_org, v_proj, 'Task Moved to Review', 'Notifies reviewer when a task enters Review phase', true, 'bam', 'task.moved', NULL, 100, 0, v_u6, NOW() - INTERVAL '4 hours'),
    (a10, v_org, v_proj, 'Close Ticket on Task Complete', 'Auto-resolves linked helpdesk tickets when a task completes', true, 'bam', 'task.completed', NULL, 100, 0, v_u2, NOW() - INTERVAL '12 hours'),
    (a11, v_org, v_proj, 'Document Promoted to Beacon', 'Posts to #knowledge when a Brief doc graduates to Beacon', true, 'brief', 'document.promoted', NULL, 50, 0, v_u4, NULL),
    (a12, v_org, v_proj, 'Critical Mention Alert', 'DMs team lead when @oncall is mentioned in any channel', false, 'banter', 'message.mentioned', '{"mentioned_user": "oncall"}', 30, 60, v_u6, NULL);

  -- ── Conditions (only where meaningful — automations without conditions always run) ──
  INSERT INTO bolt_conditions (automation_id, sort_order, field, operator, value, logic_group) VALUES
    (a2, 0, 'event.days_overdue', 'greater_than', '2', 'and'),
    (a4, 0, 'event.ticket.category', 'equals', '"billing"', 'and'),
    (a9, 0, 'event.to_phase.name', 'equals', '"Review"', 'and'),
    (a10, 0, 'event.task.has_linked_ticket', 'equals', 'true', 'and'),
    (a12, 0, 'event.mentioned_user', 'equals', '"oncall"', 'and');

  -- ── Actions ──
  INSERT INTO bolt_actions (automation_id, sort_order, mcp_tool, parameters, on_error) VALUES
    -- a1: Notify on Critical Task
    (a1, 0, 'banter_post_message', '{"channel_name": "engineering", "text": "🚨 Critical task created: **{{ event.task.title }}** by {{ actor.name }}"}', 'stop'),
    -- a2: Overdue Task Alert
    (a2, 0, 'banter_send_dm', '{"user_id": "{{ event.task.assignee_id }}", "text": "⏰ Your task **{{ event.task.title }}** is {{ event.days_overdue }} days overdue. Please update or reschedule."}', 'stop'),
    -- a3: Sprint Complete Report
    (a3, 0, 'banter_post_message', '{"channel_name": "engineering", "text": "🏁 Sprint completed: **{{ event.sprint.name }}** — {{ event.task_count }} tasks delivered."}', 'stop'),
    -- a4: Helpdesk Auto-Assign
    (a4, 0, 'task_update', '{"task_id": "{{ event.task.id }}", "assignee_id": "sarah-billing-lead-id"}', 'stop'),
    (a4, 1, 'banter_post_message', '{"channel_name": "billing-alerts", "text": "💳 New billing ticket: {{ event.ticket.subject }}"}', 'continue'),
    -- a5: SLA Breach
    (a5, 0, 'task_update', '{"task_id": "{{ event.ticket.task_id }}", "priority": "critical"}', 'stop'),
    (a5, 1, 'banter_send_dm', '{"user_id": "team-lead-id", "text": "🔴 SLA breach on ticket: {{ event.ticket.subject }}"}', 'continue'),
    -- a6: Beacon Expiry
    (a6, 0, 'banter_post_message', '{"channel_name": "knowledge", "text": "📚 Beacon expired: **{{ event.beacon.title }}** — last verified {{ event.beacon.last_verified_at }}. Please review."}', 'stop'),
    -- a7: New Doc Notification
    (a7, 0, 'banter_post_message', '{"channel_name": "project-updates", "text": "📝 New document: **{{ event.document.title }}** by {{ actor.name }}"}', 'stop'),
    -- a8: Weekly Status
    (a8, 0, 'banter_post_message', '{"channel_name": "engineering", "text": "📊 Weekly status update for {{ now }}. Check the project dashboard for details."}', 'stop'),
    -- a9: Task Moved to Review
    (a9, 0, 'banter_send_dm', '{"user_id": "{{ event.task.reviewer_id }}", "text": "👀 Task ready for review: **{{ event.task.title }}** — moved to Review by {{ actor.name }}"}', 'stop'),
    -- a10: Close Ticket
    (a10, 0, 'helpdesk_update_ticket', '{"ticket_id": "{{ event.task.linked_ticket_id }}", "status": "resolved"}', 'stop'),
    (a10, 1, 'banter_post_message', '{"channel_name": "support-triage", "text": "✅ Ticket auto-resolved: task **{{ event.task.title }}** completed."}', 'continue'),
    -- a11: Doc Promoted
    (a11, 0, 'banter_post_message', '{"channel_name": "knowledge", "text": "🎓 Brief document promoted to Beacon: **{{ event.document.title }}**"}', 'stop'),
    -- a12: Critical Mention
    (a12, 0, 'banter_send_dm', '{"user_id": "team-lead-id", "text": "📢 @oncall was mentioned in #{{ event.channel.name }}: {{ event.message.text }}"}', 'stop');

  -- ── Schedules ──
  INSERT INTO bolt_schedules (automation_id, next_run_at, last_run_at) VALUES
    (a8, (date_trunc('week', NOW()) + INTERVAL '7 days' + INTERVAL '9 hours'), NOW() - INTERVAL '7 days');

  -- ── Executions (sample history) ──
  e1 := gen_random_uuid(); e2 := gen_random_uuid(); e3 := gen_random_uuid();
  e4 := gen_random_uuid(); e5 := gen_random_uuid();

  INSERT INTO bolt_executions (id, automation_id, status, trigger_event, started_at, completed_at, duration_ms, conditions_met, condition_log) VALUES
    (e1, a1, 'success', '{"task": {"id": "t1", "title": "Fix login timeout", "priority": "critical"}}', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '320 milliseconds', 320, true, '[{"field": "event.task.priority", "operator": "equals", "value": "critical", "actual": "critical", "result": true}]'),
    (e2, a2, 'success', '{"task": {"id": "t2", "title": "Update API docs", "assignee_id": "u3"}, "days_overdue": 3}', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours' + INTERVAL '450 milliseconds', 450, true, '[{"field": "event.days_overdue", "operator": "greater_than", "value": 2, "actual": 3, "result": true}]'),
    (e3, a4, 'success', '{"ticket": {"id": "tk1", "subject": "Billing dispute", "category": "billing"}, "task": {"id": "t3"}}', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '680 milliseconds', 680, true, '[{"field": "event.ticket.category", "operator": "equals", "value": "billing", "actual": "billing", "result": true}]'),
    (e4, a9, 'failed', '{"task": {"id": "t4", "title": "Design new dashboard", "reviewer_id": null}, "to_phase": {"name": "Review"}}', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours' + INTERVAL '150 milliseconds', 150, true, '[{"field": "event.to_phase.name", "operator": "equals", "value": "Review", "actual": "Review", "result": true}]'),
    (e5, a6, 'success', '{"beacon": {"id": "b1", "title": "Deployment Runbook", "last_verified_at": "2026-02-15"}}', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '280 milliseconds', 280, true, '[]');

  -- ── Execution Steps ──
  INSERT INTO bolt_execution_steps (execution_id, action_id, step_index, mcp_tool, parameters_resolved, status, response, duration_ms) VALUES
    (e1, (SELECT id FROM bolt_actions WHERE automation_id = a1 AND sort_order = 0), 0, 'banter_post_message', '{"channel_name": "engineering", "text": "🚨 Critical task created: **Fix login timeout** by Eddie Offermann"}', 'success', '{"ok": true, "message_id": "m1"}', 320),
    (e2, (SELECT id FROM bolt_actions WHERE automation_id = a2 AND sort_order = 0), 0, 'banter_send_dm', '{"user_id": "u3", "text": "⏰ Your task **Update API docs** is 3 days overdue."}', 'success', '{"ok": true}', 450),
    (e3, (SELECT id FROM bolt_actions WHERE automation_id = a4 AND sort_order = 0), 0, 'task_update', '{"task_id": "t3", "assignee_id": "sarah-billing-lead-id"}', 'success', '{"ok": true}', 340),
    (e3, (SELECT id FROM bolt_actions WHERE automation_id = a4 AND sort_order = 1), 1, 'banter_post_message', '{"channel_name": "billing-alerts", "text": "💳 New billing ticket: Billing dispute"}', 'success', '{"ok": true}', 340),
    (e4, (SELECT id FROM bolt_actions WHERE automation_id = a9 AND sort_order = 0), 0, 'banter_send_dm', '{"user_id": null, "text": "👀 Task ready for review: **Design new dashboard**"}', 'failed', '{"error": "user_id is required"}', 150),
    (e5, (SELECT id FROM bolt_actions WHERE automation_id = a6 AND sort_order = 0), 0, 'banter_post_message', '{"channel_name": "knowledge", "text": "📚 Beacon expired: **Deployment Runbook** — last verified 2026-02-15."}', 'success', '{"ok": true}', 280);

  -- Set error info on failed execution
  UPDATE bolt_executions SET error_message = 'banter_send_dm failed: user_id is required', error_step = 0 WHERE id = e4;

  RAISE NOTICE 'Seeded 12 automations, 6 conditions, 16 actions, 1 schedule, 5 executions, 6 execution steps';
END $$;
