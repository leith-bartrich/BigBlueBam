// ---------------------------------------------------------------------------
// Static event catalog — all available trigger events across BigBlueBam apps
// ---------------------------------------------------------------------------

export interface PayloadField {
  name: string;
  type: string;
  description: string;
}

export interface EventDefinition {
  source: string;
  event_type: string;
  description: string;
  payload_schema: PayloadField[];
}

const bamEvents: EventDefinition[] = [
  {
    source: 'bam',
    event_type: 'task.created',
    description: 'Fired when a new task is created in a project.',
    payload_schema: [
      { name: 'task.id', type: 'uuid', description: 'Task ID' },
      { name: 'task.title', type: 'string', description: 'Task title' },
      { name: 'task.project_id', type: 'uuid', description: 'Project ID' },
      { name: 'task.phase_id', type: 'uuid', description: 'Phase the task was created in' },
      { name: 'task.assignee_id', type: 'uuid?', description: 'Assigned user ID' },
      { name: 'task.priority', type: 'string', description: 'Priority level' },
      { name: 'actor.id', type: 'uuid', description: 'User who created the task' },
    ],
  },
  {
    source: 'bam',
    event_type: 'task.updated',
    description: 'Fired when any task field is updated.',
    payload_schema: [
      { name: 'task.id', type: 'uuid', description: 'Task ID' },
      { name: 'task.title', type: 'string', description: 'Task title' },
      { name: 'changes', type: 'object', description: 'Map of changed fields with old/new values' },
      { name: 'actor.id', type: 'uuid', description: 'User who made the change' },
    ],
  },
  {
    source: 'bam',
    event_type: 'task.moved',
    description: 'Fired when a task is moved to a different phase or position.',
    payload_schema: [
      { name: 'task.id', type: 'uuid', description: 'Task ID' },
      { name: 'from_phase_id', type: 'uuid', description: 'Previous phase ID' },
      { name: 'to_phase_id', type: 'uuid', description: 'New phase ID' },
      { name: 'actor.id', type: 'uuid', description: 'User who moved the task' },
    ],
  },
  {
    source: 'bam',
    event_type: 'task.assigned',
    description: 'Fired when a task is assigned or reassigned.',
    payload_schema: [
      { name: 'task.id', type: 'uuid', description: 'Task ID' },
      { name: 'task.title', type: 'string', description: 'Task title' },
      { name: 'assignee.id', type: 'uuid', description: 'New assignee user ID' },
      { name: 'previous_assignee.id', type: 'uuid?', description: 'Previous assignee (null if first assignment)' },
      { name: 'actor.id', type: 'uuid', description: 'User who assigned the task' },
    ],
  },
  {
    source: 'bam',
    event_type: 'task.completed',
    description: 'Fired when a task is moved to a completed state.',
    payload_schema: [
      { name: 'task.id', type: 'uuid', description: 'Task ID' },
      { name: 'task.title', type: 'string', description: 'Task title' },
      { name: 'task.project_id', type: 'uuid', description: 'Project ID' },
      { name: 'actor.id', type: 'uuid', description: 'User who completed the task' },
    ],
  },
  {
    source: 'bam',
    event_type: 'task.overdue',
    description: 'Fired when a task passes its due date without being completed.',
    payload_schema: [
      { name: 'task.id', type: 'uuid', description: 'Task ID' },
      { name: 'task.title', type: 'string', description: 'Task title' },
      { name: 'task.due_date', type: 'date', description: 'Due date that was missed' },
      { name: 'task.assignee_id', type: 'uuid?', description: 'Assigned user' },
    ],
  },
  {
    source: 'bam',
    event_type: 'task.commented',
    description: 'Fired when a comment is added to a task.',
    payload_schema: [
      { name: 'task.id', type: 'uuid', description: 'Task ID' },
      { name: 'comment.id', type: 'uuid', description: 'Comment ID' },
      { name: 'comment.body', type: 'string', description: 'Comment text' },
      { name: 'actor.id', type: 'uuid', description: 'User who commented' },
    ],
  },
  {
    source: 'bam',
    event_type: 'sprint.started',
    description: 'Fired when a sprint is activated.',
    payload_schema: [
      { name: 'sprint.id', type: 'uuid', description: 'Sprint ID' },
      { name: 'sprint.name', type: 'string', description: 'Sprint name' },
      { name: 'sprint.project_id', type: 'uuid', description: 'Project ID' },
      { name: 'actor.id', type: 'uuid', description: 'User who started the sprint' },
    ],
  },
  {
    source: 'bam',
    event_type: 'sprint.completed',
    description: 'Fired when a sprint is completed/closed.',
    payload_schema: [
      { name: 'sprint.id', type: 'uuid', description: 'Sprint ID' },
      { name: 'sprint.name', type: 'string', description: 'Sprint name' },
      { name: 'sprint.project_id', type: 'uuid', description: 'Project ID' },
      { name: 'tasks_completed', type: 'number', description: 'Count of completed tasks' },
      { name: 'tasks_carried_forward', type: 'number', description: 'Count of tasks carried to next sprint' },
      { name: 'actor.id', type: 'uuid', description: 'User who closed the sprint' },
    ],
  },
];

const banterEvents: EventDefinition[] = [
  {
    source: 'banter',
    event_type: 'message.posted',
    description: 'Fired when a message is posted in a channel.',
    payload_schema: [
      { name: 'message.id', type: 'uuid', description: 'Message ID' },
      { name: 'message.content', type: 'string', description: 'Message text' },
      { name: 'channel.id', type: 'uuid', description: 'Channel ID' },
      { name: 'channel.name', type: 'string', description: 'Channel name' },
      { name: 'actor.id', type: 'uuid', description: 'User who posted' },
    ],
  },
  {
    source: 'banter',
    event_type: 'message.mentioned',
    description: 'Fired when a user is @mentioned in a message.',
    payload_schema: [
      { name: 'message.id', type: 'uuid', description: 'Message ID' },
      { name: 'message.content', type: 'string', description: 'Message text' },
      { name: 'mentioned_user.id', type: 'uuid', description: 'Mentioned user ID' },
      { name: 'channel.id', type: 'uuid', description: 'Channel ID' },
      { name: 'actor.id', type: 'uuid', description: 'User who sent the message' },
    ],
  },
  {
    source: 'banter',
    event_type: 'channel.created',
    description: 'Fired when a new channel is created.',
    payload_schema: [
      { name: 'channel.id', type: 'uuid', description: 'Channel ID' },
      { name: 'channel.name', type: 'string', description: 'Channel name' },
      { name: 'channel.type', type: 'string', description: 'Channel type (public/private/dm)' },
      { name: 'actor.id', type: 'uuid', description: 'User who created the channel' },
    ],
  },
  {
    source: 'banter',
    event_type: 'reaction.added',
    description: 'Fired when a reaction emoji is added to a message.',
    payload_schema: [
      { name: 'message.id', type: 'uuid', description: 'Message ID' },
      { name: 'reaction.emoji', type: 'string', description: 'Emoji used' },
      { name: 'channel.id', type: 'uuid', description: 'Channel ID' },
      { name: 'actor.id', type: 'uuid', description: 'User who reacted' },
    ],
  },
];

const beaconEvents: EventDefinition[] = [
  {
    source: 'beacon',
    event_type: 'beacon.published',
    description: 'Fired when a new knowledge beacon is published.',
    payload_schema: [
      { name: 'beacon.id', type: 'uuid', description: 'Beacon entry ID' },
      { name: 'beacon.title', type: 'string', description: 'Beacon title' },
      { name: 'beacon.category', type: 'string', description: 'Category' },
      { name: 'actor.id', type: 'uuid', description: 'User who published' },
    ],
  },
  {
    source: 'beacon',
    event_type: 'beacon.expired',
    description: 'Fired when a beacon entry reaches its expiration date.',
    payload_schema: [
      { name: 'beacon.id', type: 'uuid', description: 'Beacon entry ID' },
      { name: 'beacon.title', type: 'string', description: 'Beacon title' },
      { name: 'beacon.expires_at', type: 'datetime', description: 'Expiration timestamp' },
    ],
  },
  {
    source: 'beacon',
    event_type: 'beacon.challenged',
    description: 'Fired when a beacon entry is challenged for accuracy.',
    payload_schema: [
      { name: 'beacon.id', type: 'uuid', description: 'Beacon entry ID' },
      { name: 'beacon.title', type: 'string', description: 'Beacon title' },
      { name: 'challenge.reason', type: 'string', description: 'Reason for challenge' },
      { name: 'actor.id', type: 'uuid', description: 'User who challenged' },
    ],
  },
  {
    source: 'beacon',
    event_type: 'beacon.verified',
    description: 'Fired when a beacon entry is verified as accurate.',
    payload_schema: [
      { name: 'beacon.id', type: 'uuid', description: 'Beacon entry ID' },
      { name: 'beacon.title', type: 'string', description: 'Beacon title' },
      { name: 'actor.id', type: 'uuid', description: 'User who verified' },
    ],
  },
];

const briefEvents: EventDefinition[] = [
  {
    source: 'brief',
    event_type: 'document.created',
    description: 'Fired when a new Brief document is created.',
    payload_schema: [
      { name: 'document.id', type: 'uuid', description: 'Document ID' },
      { name: 'document.title', type: 'string', description: 'Document title' },
      { name: 'document.project_id', type: 'uuid?', description: 'Project ID if linked' },
      { name: 'actor.id', type: 'uuid', description: 'User who created the document' },
    ],
  },
  {
    source: 'brief',
    event_type: 'document.promoted',
    description: 'Fired when a Brief document is promoted to a Beacon entry.',
    payload_schema: [
      { name: 'document.id', type: 'uuid', description: 'Document ID' },
      { name: 'document.title', type: 'string', description: 'Document title' },
      { name: 'beacon.id', type: 'uuid', description: 'Created Beacon entry ID' },
      { name: 'actor.id', type: 'uuid', description: 'User who promoted' },
    ],
  },
  {
    source: 'brief',
    event_type: 'document.status_changed',
    description: 'Fired when a document status changes (draft, in_review, approved, archived).',
    payload_schema: [
      { name: 'document.id', type: 'uuid', description: 'Document ID' },
      { name: 'document.title', type: 'string', description: 'Document title' },
      { name: 'previous_status', type: 'string', description: 'Previous status' },
      { name: 'new_status', type: 'string', description: 'New status' },
      { name: 'actor.id', type: 'uuid', description: 'User who changed status' },
    ],
  },
  {
    source: 'brief',
    event_type: 'document.commented',
    description: 'Fired when a comment is added to a Brief document.',
    payload_schema: [
      { name: 'document.id', type: 'uuid', description: 'Document ID' },
      { name: 'comment.id', type: 'uuid', description: 'Comment ID' },
      { name: 'comment.body', type: 'string', description: 'Comment text' },
      { name: 'actor.id', type: 'uuid', description: 'User who commented' },
    ],
  },
];

const helpdeskEvents: EventDefinition[] = [
  {
    source: 'helpdesk',
    event_type: 'ticket.created',
    description: 'Fired when a new helpdesk ticket is submitted.',
    payload_schema: [
      { name: 'ticket.id', type: 'uuid', description: 'Ticket ID' },
      { name: 'ticket.subject', type: 'string', description: 'Ticket subject' },
      { name: 'ticket.priority', type: 'string', description: 'Priority level' },
      { name: 'ticket.category', type: 'string', description: 'Ticket category' },
      { name: 'actor.id', type: 'uuid', description: 'User who submitted' },
    ],
  },
  {
    source: 'helpdesk',
    event_type: 'ticket.replied',
    description: 'Fired when a reply is added to a ticket.',
    payload_schema: [
      { name: 'ticket.id', type: 'uuid', description: 'Ticket ID' },
      { name: 'ticket.subject', type: 'string', description: 'Ticket subject' },
      { name: 'reply.body', type: 'string', description: 'Reply text' },
      { name: 'actor.id', type: 'uuid', description: 'User who replied' },
    ],
  },
  {
    source: 'helpdesk',
    event_type: 'ticket.status_changed',
    description: 'Fired when a ticket status changes.',
    payload_schema: [
      { name: 'ticket.id', type: 'uuid', description: 'Ticket ID' },
      { name: 'ticket.subject', type: 'string', description: 'Ticket subject' },
      { name: 'previous_status', type: 'string', description: 'Previous status' },
      { name: 'new_status', type: 'string', description: 'New status' },
      { name: 'actor.id', type: 'uuid', description: 'User who changed status' },
    ],
  },
  {
    source: 'helpdesk',
    event_type: 'ticket.sla_breach',
    description: 'Fired when a ticket breaches its SLA response or resolution time.',
    payload_schema: [
      { name: 'ticket.id', type: 'uuid', description: 'Ticket ID' },
      { name: 'ticket.subject', type: 'string', description: 'Ticket subject' },
      { name: 'sla.type', type: 'string', description: 'SLA type (response/resolution)' },
      { name: 'sla.deadline', type: 'datetime', description: 'SLA deadline that was breached' },
    ],
  },
];

const scheduleEvents: EventDefinition[] = [
  {
    source: 'schedule',
    event_type: 'cron.fired',
    description: 'Fired on a cron schedule. Use cron_expression to define timing.',
    payload_schema: [
      { name: 'fired_at', type: 'datetime', description: 'Timestamp when the cron fired' },
      { name: 'automation.id', type: 'uuid', description: 'Automation ID' },
      { name: 'automation.name', type: 'string', description: 'Automation name' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const ALL_EVENTS: EventDefinition[] = [
  ...bamEvents,
  ...banterEvents,
  ...beaconEvents,
  ...briefEvents,
  ...helpdeskEvents,
  ...scheduleEvents,
];

export function getAllEvents(): EventDefinition[] {
  return ALL_EVENTS;
}

export function getEventsBySource(source: string): EventDefinition[] {
  return ALL_EVENTS.filter((e) => e.source === source);
}

export function getEventDefinition(source: string, eventType: string): EventDefinition | undefined {
  return ALL_EVENTS.find((e) => e.source === source && e.event_type === eventType);
}

/**
 * Returns a list of all available MCP tools that can be used as actions.
 * This is a static registry; in production this would query the MCP server.
 */
export function getAvailableActions(): { tool: string; description: string; source: string }[] {
  return [
    // Bam tools
    { tool: 'bam_create_task', description: 'Create a new task in a project', source: 'bam' },
    { tool: 'bam_update_task', description: 'Update task fields', source: 'bam' },
    { tool: 'bam_assign_task', description: 'Assign a task to a user', source: 'bam' },
    { tool: 'bam_move_task', description: 'Move task to a different phase', source: 'bam' },
    { tool: 'bam_add_comment', description: 'Add a comment to a task', source: 'bam' },
    { tool: 'bam_add_label', description: 'Add a label to a task', source: 'bam' },
    { tool: 'bam_set_due_date', description: 'Set or update task due date', source: 'bam' },

    // Banter tools
    { tool: 'banter_send_message', description: 'Send a message to a channel', source: 'banter' },
    { tool: 'banter_send_dm', description: 'Send a direct message to a user', source: 'banter' },
    { tool: 'banter_create_channel', description: 'Create a new channel', source: 'banter' },

    // Beacon tools
    { tool: 'beacon_create_entry', description: 'Create a new knowledge beacon entry', source: 'beacon' },
    { tool: 'beacon_update_entry', description: 'Update a beacon entry', source: 'beacon' },
    { tool: 'beacon_flag_for_review', description: 'Flag a beacon for review', source: 'beacon' },

    // Brief tools
    { tool: 'brief_create_document', description: 'Create a new Brief document', source: 'brief' },
    { tool: 'brief_update_status', description: 'Update document status', source: 'brief' },

    // Helpdesk tools
    { tool: 'helpdesk_create_ticket', description: 'Create a helpdesk ticket', source: 'helpdesk' },
    { tool: 'helpdesk_reply_ticket', description: 'Add a reply to a ticket', source: 'helpdesk' },
    { tool: 'helpdesk_assign_ticket', description: 'Assign a ticket to an agent', source: 'helpdesk' },
    { tool: 'helpdesk_update_priority', description: 'Update ticket priority', source: 'helpdesk' },

    // Cross-app tools
    { tool: 'send_email_notification', description: 'Send an email notification', source: 'system' },
    { tool: 'send_webhook', description: 'Send an HTTP webhook to an external URL', source: 'system' },
  ];
}
