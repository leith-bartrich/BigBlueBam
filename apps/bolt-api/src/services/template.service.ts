// ---------------------------------------------------------------------------
// Pre-built automation templates
// ---------------------------------------------------------------------------

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
    name: 'Auto-assign new helpdesk tickets',
    description: 'Automatically assign high-priority helpdesk tickets to the on-call agent.',
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
        mcp_tool: 'helpdesk_assign_ticket',
        parameters: {
          ticket_id: '{{ event.ticket.id }}',
          agent_id: '{{ automation.config.on_call_agent_id }}',
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
        mcp_tool: 'banter_send_message',
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
        mcp_tool: 'banter_send_message',
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
    trigger_event: 'task.commented',
    conditions: [],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'banter_send_message',
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
    trigger_event: 'document.status_changed',
    conditions: [
      {
        sort_order: 0,
        field: 'new_status',
        operator: 'equals',
        value: 'approved',
        logic_group: 'and',
      },
    ],
    actions: [
      {
        sort_order: 0,
        mcp_tool: 'beacon_create_entry',
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
        mcp_tool: 'banter_send_message',
        parameters: {
          channel_name: 'escalations',
          message: 'SLA breach on ticket "{{ event.ticket.subject }}" ({{ event.sla.type }}). Deadline: {{ event.sla.deadline }}',
        },
        on_error: 'continue',
      },
      {
        sort_order: 1,
        mcp_tool: 'bam_create_task',
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
        mcp_tool: 'banter_send_message',
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
        mcp_tool: 'banter_send_message',
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
        mcp_tool: 'banter_send_message',
        parameters: {
          channel_name: 'standup',
          message: 'Good morning! Time for standup. What did you work on yesterday? What are you working on today? Any blockers?',
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
    description?: string;
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
