// ---------------------------------------------------------------------------
// Pre-built automation templates
// ---------------------------------------------------------------------------

import { banterApprovalDmTemplate } from '../templates/banter-approval-dm.js';

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger_source: string;
  trigger_event: string;
  conditions: {
    sort_order: number;
    field: string;
    operator: string;
    value: unknown;
    logic_group: string;
  }[];
  actions: {
    sort_order: number;
    mcp_tool: string;
    parameters: Record<string, unknown>;
    on_error: string;
  }[];
}

const TEMPLATES: AutomationTemplate[] = [
  {
    id: 'tpl_notify_task_overdue',
    name: 'Notify on overdue task',
    description: 'Send a Banter DM to the assignee when a task becomes overdue.',
    category: 'notifications',
    trigger_source: 'bam',
    trigger_event: 'task.overdue',
    conditions: [
      {
        sort_order: 0,
        field: 'task.assignee_id',
        operator: 'is_not_empty',
        value: null,
        logic_group: 'and',
      },
    ],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'banter_send_dm',
        parameters: {
          user_id: '{{ event.task.assignee_id }}',
          message: 'Your task "{{ event.task.title }}" is now overdue. Due date was {{ event.task.due_date }}.',
        },
        on_error: 'continue',
      },
    ],
  },
  {
    id: 'tpl_auto_assign_ticket',
    name: 'Auto-progress high-priority tickets',
    description: 'Automatically move high-priority helpdesk tickets to in-progress when they come in.',
    category: 'helpdesk',
    trigger_source: 'helpdesk',
    trigger_event: 'ticket.created',
    conditions: [
      {
        sort_order: 0,
        field: 'ticket.priority',
        operator: 'equals',
        value: 'high',
        logic_group: 'and',
      },
    ],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'update_ticket_status',
        parameters: {
          ticket_id: '{{ event.ticket.id }}',
          status: 'in_progress',
        },
        on_error: 'stop',
      },
    ],
  },
  {
    id: 'tpl_sprint_complete_summary',
    name: 'Sprint completion summary',
    description: 'Post a summary to Banter when a sprint is completed.',
    category: 'notifications',
    trigger_source: 'bam',
    trigger_event: 'sprint.completed',
    conditions: [],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'banter_post_message',
        parameters: {
          channel_name: 'general',
          message: 'Sprint "{{ event.sprint.name }}" completed! {{ event.tasks_completed }} tasks done, {{ event.tasks_carried_forward }} carried forward.',
        },
        on_error: 'continue',
      },
    ],
  },
  {
    id: 'tpl_beacon_expiry_alert',
    name: 'Alert on beacon expiry',
    description: 'Send a notification when a beacon entry expires so it can be reviewed.',
    category: 'knowledge',
    trigger_source: 'beacon',
    trigger_event: 'beacon.expired',
    conditions: [],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'banter_post_message',
        parameters: {
          channel_name: 'knowledge-ops',
          message: 'Beacon entry "{{ event.beacon.title }}" has expired. Please review and update or archive.',
        },
        on_error: 'continue',
      },
    ],
  },
  {
    id: 'tpl_task_comment_to_banter',
    name: 'Mirror task comments to Banter',
    description: 'Post task comments to a project Banter channel for visibility.',
    category: 'sync',
    trigger_source: 'bam',
    trigger_event: 'comment.created',
    conditions: [],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'banter_post_message',
        parameters: {
          channel_name: 'project-updates',
          message: 'New comment on "{{ event.task.id }}": {{ event.comment.body }}',
        },
        on_error: 'continue',
      },
    ],
  },
  {
    id: 'tpl_brief_approved_to_beacon',
    name: 'Auto-promote approved docs to Beacon',
    description: 'When a Brief document is approved, automatically create a Beacon entry.',
    category: 'knowledge',
    trigger_source: 'brief',
    trigger_event: 'document.published',
    conditions: [],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'beacon_create',
        parameters: {
          title: '{{ event.document.title }}',
          source_document_id: '{{ event.document.id }}',
        },
        on_error: 'stop',
      },
    ],
  },
  {
    id: 'tpl_sla_breach_escalate',
    name: 'Escalate SLA breaches',
    description: 'Notify managers and create a task when a ticket breaches SLA.',
    category: 'helpdesk',
    trigger_source: 'helpdesk',
    trigger_event: 'ticket.sla_breach',
    conditions: [],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'banter_post_message',
        parameters: {
          channel_name: 'escalations',
          message: 'SLA breach on ticket "{{ event.ticket.subject }}" ({{ event.sla.type }}). Deadline: {{ event.sla.deadline }}',
        },
        on_error: 'continue',
      },
      {
        sort_order: 1,
        mcp_tool: 'create_task',
        parameters: {
          title: 'SLA breach: {{ event.ticket.subject }}',
          description: 'Follow up on SLA breach for ticket {{ event.ticket.id }}',
          priority: 'high',
        },
        on_error: 'continue',
      },
    ],
  },
  {
    id: 'tpl_new_member_onboard',
    name: 'New member onboarding',
    description: 'Send a welcome DM and create onboarding tasks when someone joins a channel.',
    category: 'onboarding',
    trigger_source: 'banter',
    trigger_event: 'channel.created',
    conditions: [
      {
        sort_order: 0,
        field: 'channel.type',
        operator: 'equals',
        value: 'dm',
        logic_group: 'and',
      },
    ],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'banter_post_message',
        parameters: {
          channel_id: '{{ event.channel.id }}',
          message: 'Welcome! Here are some resources to get started...',
        },
        on_error: 'continue',
      },
    ],
  },
  {
    id: 'tpl_high_priority_task_alert',
    name: 'Alert on high-priority task creation',
    description: 'Post to a channel when a high-priority task is created.',
    category: 'notifications',
    trigger_source: 'bam',
    trigger_event: 'task.created',
    conditions: [
      {
        sort_order: 0,
        field: 'task.priority',
        operator: 'equals',
        value: 'high',
        logic_group: 'or',
      },
      {
        sort_order: 1,
        field: 'task.priority',
        operator: 'equals',
        value: 'critical',
        logic_group: 'or',
      },
    ],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'banter_post_message',
        parameters: {
          channel_name: 'alerts',
          message: 'New {{ event.task.priority }} priority task: "{{ event.task.title }}"',
        },
        on_error: 'continue',
      },
    ],
  },
  {
    id: 'tpl_daily_standup_reminder',
    name: 'Daily standup reminder',
    description: 'Send a daily standup reminder to a Banter channel on a cron schedule.',
    category: 'schedule',
    trigger_source: 'schedule',
    trigger_event: 'cron.fired',
    conditions: [],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'banter_post_message',
        parameters: {
          channel_name: 'standup',
          message: 'Good morning! Time for standup. What did you work on yesterday? What are you working on today? Any blockers?',
        },
        on_error: 'continue',
      },
    ],
  },
  {
    id: 'tpl_new_document_notification',
    name: 'New document notification',
    description: 'Post to a project Banter channel when a new Brief document is created.',
    category: 'notifications',
    trigger_source: 'brief',
    trigger_event: 'document.created',
    conditions: [],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'banter_post_message',
        parameters: {
          channel_name: 'project-updates',
          message: 'New document created: "{{ event.document.title }}" by {{ event.actor.id }}',
        },
        on_error: 'continue',
      },
    ],
  },
  {
    id: 'tpl_weekly_status_update',
    name: 'Weekly status update',
    description: 'Generate a weekly project status report every Monday morning.',
    category: 'schedule',
    trigger_source: 'schedule',
    trigger_event: 'cron.fired',
    conditions: [],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'banter_post_message',
        parameters: {
          channel_name: 'general',
          message: 'Weekly status report for {{ now }}: Please update your task statuses and flag any blockers before standup.',
        },
        on_error: 'continue',
      },
    ],
  },
  {
    id: 'tpl_task_moved_to_review',
    name: 'Task moved to review',
    description: 'Notify the reviewer via Banter DM when a task is moved to the Review phase.',
    category: 'notifications',
    trigger_source: 'bam',
    trigger_event: 'task.moved',
    conditions: [
      {
        sort_order: 0,
        field: 'event.to_phase.name',
        operator: 'equals',
        value: 'Review',
        logic_group: 'and',
      },
    ],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'banter_send_dm',
        parameters: {
          user_id: '{{ event.task.assignee_id }}',
          message: 'Task "{{ event.task.title }}" has been moved to Review and is ready for your attention.',
        },
        on_error: 'continue',
      },
    ],
  },
  {
    id: 'tpl_close_ticket_on_task_complete',
    name: 'Close ticket on task complete',
    description: 'When a Bam task is completed, resolve its linked helpdesk ticket automatically.',
    category: 'sync',
    trigger_source: 'bam',
    trigger_event: 'task.completed',
    conditions: [
      {
        sort_order: 0,
        field: 'event.task.linked_ticket_id',
        operator: 'is_not_empty',
        value: null,
        logic_group: 'and',
      },
    ],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'helpdesk_update_ticket',
        parameters: {
          ticket_id: '{{ event.task.linked_ticket_id }}',
          status: 'resolved',
        },
        on_error: 'continue',
      },
    ],
  },
  // Wave 3.2: Banter approval DM template. Defined in templates/
  // banter-approval-dm.ts so future approval-workflow templates can
  // live alongside it without bloating this file.
  banterApprovalDmTemplate,
  // Bill P2: Bond deal-close auto-invoice template.
  // When a Bond deal status changes to "won", create a draft invoice
  // in Bill using the deal's value and contact info. Uses cross-service
  // MCP tools so no direct HTTP calls between bond-api and bill-api
  // are needed.
  {
    id: 'tpl_bond_deal_close_invoice',
    name: 'Create invoice on deal close',
    description:
      'When a Bond deal is marked as won, automatically create a draft invoice in Bill ' +
      'with the deal value, company name, and contact details pre-filled.',
    category: 'billing',
    trigger_source: 'bond',
    trigger_event: 'deal.status_changed',
    conditions: [
      {
        sort_order: 0,
        field: 'event.deal.new_status',
        operator: 'equals',
        value: '"won"',
        logic_group: 'and',
      },
    ],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'bill_create_invoice',
        parameters: {
          organization_id: '{{ org.id }}',
          client_name: '{{ event.deal.company_name }}',
          client_email: '{{ event.deal.primary_contact_email }}',
          line_items: [
            {
              description: 'Deal: {{ event.deal.name }}',
              quantity: 1,
              unit_price: '{{ event.deal.value }}',
            },
          ],
          notes: 'Auto-generated from Bond deal #{{ event.deal.id }} closed by {{ actor.name }}.',
          status: 'draft',
        },
        on_error: 'continue',
      },
      {
        sort_order: 1,
        mcp_tool: 'banter_send_dm',
        parameters: {
          user_id: '{{ event.deal.owner_id }}',
          message:
            'A draft invoice has been created for deal "{{ event.deal.name }}" ' +
            '({{ event.deal.value }} {{ event.deal.currency }}). Review it in Bill.',
        },
        on_error: 'continue',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function listTemplates(): AutomationTemplate[] {
  return TEMPLATES;
}

export function getTemplate(id: string): AutomationTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function instantiateTemplate(
  template: AutomationTemplate,
  overrides: {
    name?: string;
    description?: string | null;
    project_id?: string | null;
    cron_expression?: string | null;
    cron_timezone?: string;
  },
) {
  return {
    name: overrides.name ?? template.name,
    description: overrides.description ?? template.description,
    project_id: overrides.project_id ?? null,
    trigger_source: template.trigger_source,
    trigger_event: template.trigger_event,
    cron_expression: overrides.cron_expression ?? null,
    cron_timezone: overrides.cron_timezone ?? 'UTC',
    conditions: template.conditions,
    actions: template.actions,
  };
}
