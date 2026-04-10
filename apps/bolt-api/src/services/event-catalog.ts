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
    event_type: 'task.deleted',
    description: 'Fired when a task is deleted.',
    payload_schema: [
      { name: 'task.id', type: 'uuid', description: 'Task ID' },
      { name: 'task.title', type: 'string', description: 'Task title' },
      { name: 'task.project_id', type: 'uuid', description: 'Project ID' },
      { name: 'actor.id', type: 'uuid', description: 'User who deleted the task' },
    ],
  },
  {
    source: 'bam',
    event_type: 'comment.created',
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
    event_type: 'epic.completed',
    description: 'Fired when all tasks in an epic are completed.',
    payload_schema: [
      { name: 'epic.id', type: 'uuid', description: 'Epic ID' },
      { name: 'epic.title', type: 'string', description: 'Epic title' },
      { name: 'epic.project_id', type: 'uuid', description: 'Project ID' },
      { name: 'tasks_completed', type: 'number', description: 'Number of completed tasks in the epic' },
      { name: 'actor.id', type: 'uuid', description: 'User whose action triggered the epic completion' },
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
    event_type: 'message.edited',
    description: 'Fired when an existing message is edited.',
    payload_schema: [
      { name: 'message.id', type: 'uuid', description: 'Message ID' },
      { name: 'message.content', type: 'string', description: 'Updated message text' },
      { name: 'channel.id', type: 'uuid', description: 'Channel ID' },
      { name: 'actor.id', type: 'uuid', description: 'User who edited the message' },
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
    event_type: 'beacon.created',
    description: 'Fired when a new knowledge beacon is created (draft state).',
    payload_schema: [
      { name: 'beacon.id', type: 'uuid', description: 'Beacon entry ID' },
      { name: 'beacon.title', type: 'string', description: 'Beacon title' },
      { name: 'beacon.category', type: 'string', description: 'Category' },
      { name: 'actor.id', type: 'uuid', description: 'User who created' },
    ],
  },
  {
    source: 'beacon',
    event_type: 'beacon.updated',
    description: 'Fired when a beacon is updated.',
    payload_schema: [
      { name: 'beacon.id', type: 'uuid', description: 'Beacon entry ID' },
      { name: 'beacon.title', type: 'string', description: 'Beacon title' },
      { name: 'changes', type: 'object', description: 'Map of changed fields with old/new values' },
      { name: 'actor.id', type: 'uuid', description: 'User who updated the beacon' },
    ],
  },
  {
    source: 'beacon',
    event_type: 'beacon.published',
    description: 'Fired when a knowledge beacon transitions to published state.',
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
    event_type: 'document.updated',
    description: 'Fired when a Brief document is updated (title, metadata, or content).',
    payload_schema: [
      { name: 'document.id', type: 'uuid', description: 'Document ID' },
      { name: 'document.title', type: 'string', description: 'Document title' },
      { name: 'changes', type: 'object', description: 'Map of changed fields with old/new values' },
      { name: 'actor.id', type: 'uuid', description: 'User who updated the document' },
    ],
  },
  {
    source: 'brief',
    event_type: 'document.published',
    description: 'Fired when a Brief document transitions to published state.',
    payload_schema: [
      { name: 'document.id', type: 'uuid', description: 'Document ID' },
      { name: 'document.title', type: 'string', description: 'Document title' },
      { name: 'actor.id', type: 'uuid', description: 'User who published the document' },
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

const bondEvents: EventDefinition[] = [
  {
    source: 'bond',
    event_type: 'deal.created',
    description: 'Fired when a new deal is created in the CRM.',
    payload_schema: [
      { name: 'deal.id', type: 'uuid', description: 'Deal ID' },
      { name: 'deal.title', type: 'string', description: 'Deal title' },
      { name: 'deal.amount', type: 'number', description: 'Deal value' },
      { name: 'deal.stage', type: 'string', description: 'Current pipeline stage' },
      { name: 'deal.company_id', type: 'uuid?', description: 'Associated company' },
      { name: 'deal.contact_id', type: 'uuid?', description: 'Primary contact' },
      { name: 'actor.id', type: 'uuid', description: 'User who created the deal' },
    ],
  },
  {
    source: 'bond',
    event_type: 'deal.updated',
    description: 'Fired when any field on a deal is updated.',
    payload_schema: [
      { name: 'deal.id', type: 'uuid', description: 'Deal ID' },
      { name: 'deal.title', type: 'string', description: 'Deal title' },
      { name: 'changes', type: 'object', description: 'Map of changed fields with old/new values' },
      { name: 'actor.id', type: 'uuid', description: 'User who made the change' },
    ],
  },
  {
    source: 'bond',
    event_type: 'deal.stage_changed',
    description: 'Fired when a deal moves to a different pipeline stage.',
    payload_schema: [
      { name: 'deal.id', type: 'uuid', description: 'Deal ID' },
      { name: 'deal.title', type: 'string', description: 'Deal title' },
      { name: 'previous_stage', type: 'string', description: 'Previous stage' },
      { name: 'new_stage', type: 'string', description: 'New stage' },
      { name: 'actor.id', type: 'uuid', description: 'User who moved the deal' },
    ],
  },
  {
    source: 'bond',
    event_type: 'deal.won',
    description: 'Fired when a deal is closed-won.',
    payload_schema: [
      { name: 'deal.id', type: 'uuid', description: 'Deal ID' },
      { name: 'deal.title', type: 'string', description: 'Deal title' },
      { name: 'deal.amount', type: 'number', description: 'Deal value' },
      { name: 'deal.close_date', type: 'date', description: 'Close date' },
      { name: 'actor.id', type: 'uuid', description: 'User who closed the deal' },
    ],
  },
  {
    source: 'bond',
    event_type: 'deal.lost',
    description: 'Fired when a deal is closed-lost.',
    payload_schema: [
      { name: 'deal.id', type: 'uuid', description: 'Deal ID' },
      { name: 'deal.title', type: 'string', description: 'Deal title' },
      { name: 'deal.amount', type: 'number', description: 'Deal value' },
      { name: 'deal.lost_reason', type: 'string?', description: 'Reason for loss' },
      { name: 'actor.id', type: 'uuid', description: 'User who closed the deal' },
    ],
  },
  {
    source: 'bond',
    event_type: 'contact.created',
    description: 'Fired when a new contact is added to the CRM.',
    payload_schema: [
      { name: 'contact.id', type: 'uuid', description: 'Contact ID' },
      { name: 'contact.name', type: 'string', description: 'Contact name' },
      { name: 'contact.email', type: 'string?', description: 'Contact email' },
      { name: 'contact.company_id', type: 'uuid?', description: 'Associated company' },
      { name: 'actor.id', type: 'uuid', description: 'User who created the contact' },
    ],
  },
  {
    source: 'bond',
    event_type: 'activity.logged',
    description: 'Fired when an activity (call, email, meeting, note) is logged against a contact or deal.',
    payload_schema: [
      { name: 'activity.id', type: 'uuid', description: 'Activity ID' },
      { name: 'activity.type', type: 'string', description: 'Activity type (call/email/meeting/note)' },
      { name: 'activity.subject', type: 'string', description: 'Activity subject' },
      { name: 'activity.contact_id', type: 'uuid?', description: 'Related contact' },
      { name: 'activity.deal_id', type: 'uuid?', description: 'Related deal' },
      { name: 'actor.id', type: 'uuid', description: 'User who logged the activity' },
    ],
  },
];

const blastEvents: EventDefinition[] = [
  {
    source: 'blast',
    event_type: 'campaign.created',
    description: 'Fired when a new email campaign is drafted.',
    payload_schema: [
      { name: 'campaign.id', type: 'uuid', description: 'Campaign ID' },
      { name: 'campaign.name', type: 'string', description: 'Campaign name' },
      { name: 'campaign.subject', type: 'string', description: 'Email subject line' },
      { name: 'actor.id', type: 'uuid', description: 'User who created the campaign' },
    ],
  },
  {
    source: 'blast',
    event_type: 'campaign.sent',
    description: 'Fired when a campaign is actually dispatched to recipients.',
    payload_schema: [
      { name: 'campaign.id', type: 'uuid', description: 'Campaign ID' },
      { name: 'campaign.name', type: 'string', description: 'Campaign name' },
      { name: 'campaign.recipient_count', type: 'number', description: 'Number of recipients' },
      { name: 'actor.id', type: 'uuid', description: 'User who sent the campaign' },
    ],
  },
];

const boardEvents: EventDefinition[] = [
  {
    source: 'board',
    event_type: 'board.created',
    description: 'Fired when a new whiteboard is created.',
    payload_schema: [
      { name: 'board.id', type: 'uuid', description: 'Board ID' },
      { name: 'board.name', type: 'string', description: 'Board name' },
      { name: 'board.project_id', type: 'uuid?', description: 'Associated project' },
      { name: 'actor.id', type: 'uuid', description: 'User who created the board' },
    ],
  },
  {
    source: 'board',
    event_type: 'board.updated',
    description: 'Fired when a whiteboard is updated (metadata, not individual shapes).',
    payload_schema: [
      { name: 'board.id', type: 'uuid', description: 'Board ID' },
      { name: 'board.name', type: 'string', description: 'Board name' },
      { name: 'changes', type: 'object', description: 'Map of changed fields with old/new values' },
      { name: 'actor.id', type: 'uuid', description: 'User who updated the board' },
    ],
  },
];

const bearingEvents: EventDefinition[] = [
  {
    source: 'bearing',
    event_type: 'goal.created',
    description: 'Fired when a new goal is created.',
    payload_schema: [
      { name: 'goal.id', type: 'uuid', description: 'Goal ID' },
      { name: 'goal.title', type: 'string', description: 'Goal title' },
      { name: 'goal.period_id', type: 'uuid', description: 'Planning period' },
      { name: 'goal.owner_id', type: 'uuid?', description: 'Goal owner' },
      { name: 'actor.id', type: 'uuid', description: 'User who created the goal' },
    ],
  },
  {
    source: 'bearing',
    event_type: 'goal.updated',
    description: 'Fired when a goal is updated.',
    payload_schema: [
      { name: 'goal.id', type: 'uuid', description: 'Goal ID' },
      { name: 'goal.title', type: 'string', description: 'Goal title' },
      { name: 'changes', type: 'object', description: 'Map of changed fields with old/new values' },
      { name: 'actor.id', type: 'uuid', description: 'User who made the change' },
    ],
  },
  {
    source: 'bearing',
    event_type: 'key_result.updated',
    description: 'Fired when a key result is updated or progress is recorded.',
    payload_schema: [
      { name: 'key_result.id', type: 'uuid', description: 'Key Result ID' },
      { name: 'key_result.goal_id', type: 'uuid', description: 'Parent goal ID' },
      { name: 'key_result.title', type: 'string', description: 'Key result title' },
      { name: 'key_result.progress', type: 'number', description: 'Current progress value' },
      { name: 'actor.id', type: 'uuid', description: 'User who made the change' },
    ],
  },
];

const billEvents: EventDefinition[] = [
  {
    source: 'bill',
    event_type: 'invoice.created',
    description: 'Fired when a new invoice is drafted.',
    payload_schema: [
      { name: 'invoice.id', type: 'uuid', description: 'Invoice ID' },
      { name: 'invoice.number', type: 'string', description: 'Invoice number' },
      { name: 'invoice.customer_id', type: 'uuid', description: 'Customer/contact ID' },
      { name: 'invoice.amount', type: 'number', description: 'Invoice total' },
      { name: 'actor.id', type: 'uuid', description: 'User who created the invoice' },
    ],
  },
  {
    source: 'bill',
    event_type: 'invoice.finalized',
    description: 'Fired when an invoice transitions from draft to finalized and is locked.',
    payload_schema: [
      { name: 'invoice.id', type: 'uuid', description: 'Invoice ID' },
      { name: 'invoice.number', type: 'string', description: 'Invoice number' },
      { name: 'invoice.amount', type: 'number', description: 'Invoice total' },
      { name: 'actor.id', type: 'uuid', description: 'User who finalized' },
    ],
  },
  {
    source: 'bill',
    event_type: 'invoice.paid',
    description: 'Fired when an invoice is fully paid.',
    payload_schema: [
      { name: 'invoice.id', type: 'uuid', description: 'Invoice ID' },
      { name: 'invoice.number', type: 'string', description: 'Invoice number' },
      { name: 'invoice.amount', type: 'number', description: 'Invoice total' },
      { name: 'invoice.paid_at', type: 'datetime', description: 'Payment timestamp' },
    ],
  },
  {
    source: 'bill',
    event_type: 'payment.recorded',
    description: 'Fired when a payment is recorded against an invoice (partial or full).',
    payload_schema: [
      { name: 'payment.id', type: 'uuid', description: 'Payment ID' },
      { name: 'payment.invoice_id', type: 'uuid', description: 'Invoice ID' },
      { name: 'payment.amount', type: 'number', description: 'Payment amount' },
      { name: 'payment.method', type: 'string', description: 'Payment method' },
      { name: 'actor.id', type: 'uuid', description: 'User who recorded the payment' },
    ],
  },
];

const bookEvents: EventDefinition[] = [
  {
    source: 'book',
    event_type: 'event.created',
    description: 'Fired when a new calendar event is created.',
    payload_schema: [
      { name: 'event.id', type: 'uuid', description: 'Event ID' },
      { name: 'event.title', type: 'string', description: 'Event title' },
      { name: 'event.start_time', type: 'datetime', description: 'Event start time' },
      { name: 'event.end_time', type: 'datetime', description: 'Event end time' },
      { name: 'actor.id', type: 'uuid', description: 'User who created the event' },
    ],
  },
  {
    source: 'book',
    event_type: 'event.updated',
    description: 'Fired when a calendar event is updated (time, attendees, etc).',
    payload_schema: [
      { name: 'event.id', type: 'uuid', description: 'Event ID' },
      { name: 'event.title', type: 'string', description: 'Event title' },
      { name: 'changes', type: 'object', description: 'Map of changed fields with old/new values' },
      { name: 'actor.id', type: 'uuid', description: 'User who made the change' },
    ],
  },
  {
    source: 'book',
    event_type: 'booking.created',
    description: 'Fired when an external visitor books a slot via a public booking page.',
    payload_schema: [
      { name: 'booking.id', type: 'uuid', description: 'Booking ID' },
      { name: 'booking.booking_page_id', type: 'uuid', description: 'Booking page ID' },
      { name: 'booking.guest_name', type: 'string', description: 'Guest name' },
      { name: 'booking.guest_email', type: 'string', description: 'Guest email' },
      { name: 'booking.start_time', type: 'datetime', description: 'Booked start time' },
    ],
  },
];

const blankEvents: EventDefinition[] = [
  {
    source: 'blank',
    event_type: 'form.published',
    description: 'Fired when a form is published and made available for submissions.',
    payload_schema: [
      { name: 'form.id', type: 'uuid', description: 'Form ID' },
      { name: 'form.title', type: 'string', description: 'Form title' },
      { name: 'actor.id', type: 'uuid', description: 'User who published the form' },
    ],
  },
  {
    source: 'blank',
    event_type: 'submission.created',
    description: 'Fired when a new submission is received on a published form.',
    payload_schema: [
      { name: 'submission.id', type: 'uuid', description: 'Submission ID' },
      { name: 'submission.form_id', type: 'uuid', description: 'Form ID' },
      { name: 'submission.answers', type: 'object', description: 'Map of field IDs to submitted values' },
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
  ...bondEvents,
  ...blastEvents,
  ...boardEvents,
  ...bearingEvents,
  ...billEvents,
  ...bookEvents,
  ...blankEvents,
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
 * Tool names must match the names registered in apps/mcp-server/src/tools/*-tools.ts —
 * anything here is added to the validator allowlist in automation.service.ts.
 */
export function getAvailableActions(): { mcp_tool: string; description: string; source: string }[] {
  return [
    // -------- Bam (tasks, sprints, projects, comments) --------
    { mcp_tool: 'create_task', description: 'Create a new task in a project', source: 'bam' },
    { mcp_tool: 'update_task', description: 'Update task fields (title, description, assignee, priority, due_date, labels, phase)', source: 'bam' },
    { mcp_tool: 'move_task', description: 'Move task to a different phase or position', source: 'bam' },
    { mcp_tool: 'delete_task', description: 'Delete a task', source: 'bam' },
    { mcp_tool: 'bulk_update_tasks', description: 'Bulk-update multiple tasks in one operation', source: 'bam' },
    { mcp_tool: 'duplicate_task', description: 'Duplicate an existing task', source: 'bam' },
    { mcp_tool: 'log_time', description: 'Log a time entry against a task', source: 'bam' },
    { mcp_tool: 'add_comment', description: 'Add a comment to a task', source: 'bam' },
    { mcp_tool: 'create_sprint', description: 'Create a new sprint in a project', source: 'bam' },
    { mcp_tool: 'start_sprint', description: 'Start (activate) a sprint', source: 'bam' },
    { mcp_tool: 'complete_sprint', description: 'Complete (close) a sprint', source: 'bam' },
    { mcp_tool: 'create_project', description: 'Create a new project', source: 'bam' },

    // -------- Banter (chat, calls) --------
    { mcp_tool: 'banter_post_message', description: 'Post a message to a channel', source: 'banter' },
    { mcp_tool: 'banter_send_dm', description: 'Send a direct message to a user', source: 'banter' },
    { mcp_tool: 'banter_send_group_dm', description: 'Send a group direct message to multiple users', source: 'banter' },
    { mcp_tool: 'banter_create_channel', description: 'Create a new channel', source: 'banter' },
    { mcp_tool: 'banter_archive_channel', description: 'Archive a channel', source: 'banter' },
    { mcp_tool: 'banter_add_channel_members', description: 'Add members to a channel', source: 'banter' },
    { mcp_tool: 'banter_react', description: 'Add an emoji reaction to a message', source: 'banter' },
    { mcp_tool: 'banter_pin_message', description: 'Pin a message in a channel', source: 'banter' },
    { mcp_tool: 'banter_share_task', description: 'Share a Bam task as a message in a channel', source: 'banter' },
    { mcp_tool: 'banter_share_sprint', description: 'Share a Bam sprint as a message in a channel', source: 'banter' },
    { mcp_tool: 'banter_share_ticket', description: 'Share a Helpdesk ticket as a message in a channel', source: 'banter' },
    { mcp_tool: 'banter_start_call', description: 'Start a voice/video call in a channel', source: 'banter' },
    { mcp_tool: 'banter_end_call', description: 'End an active call', source: 'banter' },
    { mcp_tool: 'banter_invite_agent_to_call', description: 'Invite an AI agent to join a live call', source: 'banter' },

    // -------- Beacon (knowledge base) --------
    { mcp_tool: 'beacon_create', description: 'Create a new knowledge beacon entry', source: 'beacon' },
    { mcp_tool: 'beacon_update', description: 'Update a beacon entry', source: 'beacon' },
    { mcp_tool: 'beacon_publish', description: 'Publish a beacon entry', source: 'beacon' },
    { mcp_tool: 'beacon_verify', description: 'Mark a beacon as verified', source: 'beacon' },
    { mcp_tool: 'beacon_challenge', description: 'Challenge a beacon for review', source: 'beacon' },
    { mcp_tool: 'beacon_retire', description: 'Retire a beacon entry', source: 'beacon' },
    { mcp_tool: 'beacon_restore', description: 'Restore a retired beacon entry', source: 'beacon' },
    { mcp_tool: 'beacon_tag_add', description: 'Add a tag to a beacon entry', source: 'beacon' },
    { mcp_tool: 'beacon_tag_remove', description: 'Remove a tag from a beacon entry', source: 'beacon' },
    { mcp_tool: 'beacon_link_create', description: 'Create a link between two beacons', source: 'beacon' },
    { mcp_tool: 'beacon_link_remove', description: 'Remove a link between two beacons', source: 'beacon' },
    { mcp_tool: 'beacon_policy_set', description: 'Set access policy for a beacon', source: 'beacon' },

    // -------- Brief (documents) --------
    { mcp_tool: 'brief_create', description: 'Create a new Brief document', source: 'brief' },
    { mcp_tool: 'brief_update', description: 'Update Brief document metadata (title, status, etc.)', source: 'brief' },
    { mcp_tool: 'brief_update_content', description: 'Replace the body content of a Brief document', source: 'brief' },
    { mcp_tool: 'brief_append_content', description: 'Append content to an existing Brief document', source: 'brief' },
    { mcp_tool: 'brief_archive', description: 'Archive a Brief document', source: 'brief' },
    { mcp_tool: 'brief_restore', description: 'Restore an archived Brief document', source: 'brief' },
    { mcp_tool: 'brief_duplicate', description: 'Duplicate a Brief document', source: 'brief' },
    { mcp_tool: 'brief_promote_to_beacon', description: 'Promote a Brief document into a Beacon entry', source: 'brief' },
    { mcp_tool: 'brief_link_task', description: 'Link a Brief document to a Bam task', source: 'brief' },
    { mcp_tool: 'brief_comment_add', description: 'Add a comment to a Brief document', source: 'brief' },
    { mcp_tool: 'brief_comment_resolve', description: 'Resolve a comment thread on a Brief document', source: 'brief' },
    { mcp_tool: 'brief_version_restore', description: 'Restore a Brief document to a previous version', source: 'brief' },

    // -------- Helpdesk --------
    { mcp_tool: 'reply_to_ticket', description: 'Add a reply to a helpdesk ticket', source: 'helpdesk' },
    { mcp_tool: 'update_ticket_status', description: 'Update the status of a helpdesk ticket', source: 'helpdesk' },
    { mcp_tool: 'helpdesk_update_settings', description: 'Update helpdesk workflow settings for the organization', source: 'helpdesk' },

    // -------- Bond (CRM) --------
    { mcp_tool: 'bond_create_contact', description: 'Create a new contact in the CRM', source: 'bond' },
    { mcp_tool: 'bond_update_contact', description: 'Update an existing contact', source: 'bond' },
    { mcp_tool: 'bond_merge_contacts', description: 'Merge two contact records', source: 'bond' },
    { mcp_tool: 'bond_create_company', description: 'Create a new company record', source: 'bond' },
    { mcp_tool: 'bond_update_company', description: 'Update an existing company record', source: 'bond' },
    { mcp_tool: 'bond_create_deal', description: 'Create a new deal in the pipeline', source: 'bond' },
    { mcp_tool: 'bond_update_deal', description: 'Update an existing deal', source: 'bond' },
    { mcp_tool: 'bond_move_deal_stage', description: 'Move a deal to a different pipeline stage', source: 'bond' },
    { mcp_tool: 'bond_close_deal_won', description: 'Close a deal as won', source: 'bond' },
    { mcp_tool: 'bond_close_deal_lost', description: 'Close a deal as lost', source: 'bond' },
    { mcp_tool: 'bond_log_activity', description: 'Log an activity (call, email, meeting, note) against a contact or deal', source: 'bond' },
    { mcp_tool: 'bond_score_lead', description: 'Compute a lead score for a contact or deal', source: 'bond' },

    // -------- Blast (email campaigns) --------
    { mcp_tool: 'blast_create_template', description: 'Create a new email template', source: 'blast' },
    { mcp_tool: 'blast_draft_campaign', description: 'Draft a new email campaign', source: 'blast' },
    { mcp_tool: 'blast_send_campaign', description: 'Send a drafted email campaign to its recipients', source: 'blast' },
    { mcp_tool: 'blast_create_segment', description: 'Create a new recipient segment', source: 'blast' },
    { mcp_tool: 'blast_draft_email_content', description: 'AI-draft the HTML body for an email campaign', source: 'blast' },

    // -------- Board (whiteboards) --------
    { mcp_tool: 'board_create', description: 'Create a new whiteboard', source: 'board' },
    { mcp_tool: 'board_update', description: 'Update whiteboard metadata (name, description)', source: 'board' },
    { mcp_tool: 'board_archive', description: 'Archive a whiteboard', source: 'board' },
    { mcp_tool: 'board_add_sticky', description: 'Add a sticky note to a whiteboard', source: 'board' },
    { mcp_tool: 'board_add_text', description: 'Add a text element to a whiteboard', source: 'board' },
    { mcp_tool: 'board_promote_to_tasks', description: 'Promote whiteboard stickies into Bam tasks', source: 'board' },
    { mcp_tool: 'board_export', description: 'Export a whiteboard as an image or PDF', source: 'board' },

    // -------- Bearing (goals & OKRs) --------
    { mcp_tool: 'bearing_goal_create', description: 'Create a new goal', source: 'bearing' },
    { mcp_tool: 'bearing_goal_update', description: 'Update an existing goal', source: 'bearing' },
    { mcp_tool: 'bearing_kr_create', description: 'Create a new key result on a goal', source: 'bearing' },
    { mcp_tool: 'bearing_kr_update', description: 'Update a key result (including progress)', source: 'bearing' },
    { mcp_tool: 'bearing_kr_link', description: 'Link a key result to another entity (task, beacon, etc.)', source: 'bearing' },
    { mcp_tool: 'bearing_update_post', description: 'Post a status update against a goal or KR', source: 'bearing' },

    // -------- Bill (invoicing) --------
    { mcp_tool: 'bill_create_invoice', description: 'Create a new invoice', source: 'bill' },
    { mcp_tool: 'bill_create_invoice_from_time', description: 'Generate an invoice from logged time entries', source: 'bill' },
    { mcp_tool: 'bill_create_invoice_from_deal', description: 'Generate an invoice from a Bond deal', source: 'bill' },
    { mcp_tool: 'bill_add_line_item', description: 'Add a line item to an invoice', source: 'bill' },
    { mcp_tool: 'bill_finalize_invoice', description: 'Finalize a draft invoice and lock it', source: 'bill' },
    { mcp_tool: 'bill_send_invoice', description: 'Send a finalized invoice to the customer', source: 'bill' },
    { mcp_tool: 'bill_record_payment', description: 'Record a payment against an invoice', source: 'bill' },
    { mcp_tool: 'bill_create_expense', description: 'Create a new expense record', source: 'bill' },

    // -------- Book (calendar) --------
    { mcp_tool: 'book_create_event', description: 'Create a new calendar event', source: 'book' },
    { mcp_tool: 'book_update_event', description: 'Update an existing calendar event', source: 'book' },
    { mcp_tool: 'book_cancel_event', description: 'Cancel a calendar event', source: 'book' },
    { mcp_tool: 'book_find_meeting_time', description: 'Find an available meeting time across multiple attendees', source: 'book' },
    { mcp_tool: 'book_create_booking_page', description: 'Create a public booking page', source: 'book' },
    { mcp_tool: 'book_rsvp_event', description: 'Record an RSVP response on a calendar event', source: 'book' },

    // -------- Blank (form builder) --------
    { mcp_tool: 'blank_create_form', description: 'Create a new form', source: 'blank' },
    { mcp_tool: 'blank_generate_form', description: 'AI-generate a form from a natural-language prompt', source: 'blank' },
    { mcp_tool: 'blank_update_form', description: 'Update an existing form', source: 'blank' },
    { mcp_tool: 'blank_publish_form', description: 'Publish a form to make it available for submissions', source: 'blank' },
    { mcp_tool: 'blank_export_submissions', description: 'Export form submissions as CSV', source: 'blank' },

    // -------- Bench (analytics) --------
    { mcp_tool: 'bench_query_widget', description: 'Execute a dashboard widget query and return results', source: 'bench' },
    { mcp_tool: 'bench_query_ad_hoc', description: 'Execute an ad-hoc analytics query', source: 'bench' },
    { mcp_tool: 'bench_summarize_dashboard', description: 'Generate a natural-language summary of a dashboard', source: 'bench' },
    { mcp_tool: 'bench_detect_anomalies', description: 'Detect anomalies in a time-series metric', source: 'bench' },
    { mcp_tool: 'bench_generate_report', description: 'Generate a scheduled report from a dashboard', source: 'bench' },
    { mcp_tool: 'bench_compare_periods', description: 'Compare a metric across two time periods', source: 'bench' },

    // -------- System (cross-app primitives) --------
    { mcp_tool: 'send_email_notification', description: 'Send an email notification', source: 'system' },
    { mcp_tool: 'send_webhook', description: 'Send an HTTP webhook to an external URL', source: 'system' },
  ];
}
