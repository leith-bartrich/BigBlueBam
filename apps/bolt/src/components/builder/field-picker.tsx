import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

interface FieldPickerProps {
  value: string;
  onChange: (value: string) => void;
  triggerSource?: string;
  triggerEvent?: string;
  placeholder?: string;
  className?: string;
}

interface FieldSuggestion {
  path: string;
  type: string;
  description: string;
}

// Common event payload fields organized by trigger source
const FIELD_CATALOG: Record<string, FieldSuggestion[]> = {
  bam: [
    { path: 'event.task.id', type: 'uuid', description: 'Task ID' },
    { path: 'event.task.title', type: 'string', description: 'Task title' },
    { path: 'event.task.project_id', type: 'uuid', description: 'Project ID' },
    { path: 'event.task.phase_id', type: 'uuid', description: 'Phase ID' },
    { path: 'event.task.assignee_id', type: 'uuid', description: 'Assigned user ID' },
    { path: 'event.task.priority', type: 'string', description: 'Priority (low, medium, high, critical)' },
    { path: 'event.task.due_date', type: 'date', description: 'Task due date' },
    { path: 'event.task.state_id', type: 'uuid', description: 'State ID' },
    { path: 'event.task.points', type: 'number', description: 'Story points' },
    { path: 'event.from_phase_id', type: 'uuid', description: 'Previous phase (task.moved)' },
    { path: 'event.to_phase_id', type: 'uuid', description: 'Target phase (task.moved)' },
    { path: 'event.changes', type: 'object', description: 'Changed fields map (task.updated)' },
    { path: 'event.comment.id', type: 'uuid', description: 'Comment ID (comment.created)' },
    { path: 'event.comment.body', type: 'string', description: 'Comment text' },
    { path: 'event.sprint.id', type: 'uuid', description: 'Sprint ID' },
    { path: 'event.sprint.name', type: 'string', description: 'Sprint name' },
    { path: 'event.sprint.project_id', type: 'uuid', description: 'Sprint project ID' },
    { path: 'event.tasks_completed', type: 'number', description: 'Completed task count (sprint)' },
    { path: 'event.tasks_carried_forward', type: 'number', description: 'Carried forward count (sprint)' },
    { path: 'event.actor.id', type: 'uuid', description: 'User who performed the action' },
  ],
  banter: [
    { path: 'event.message.id', type: 'uuid', description: 'Message ID' },
    { path: 'event.message.content', type: 'string', description: 'Message text' },
    { path: 'event.channel.id', type: 'uuid', description: 'Channel ID' },
    { path: 'event.channel.name', type: 'string', description: 'Channel name' },
    { path: 'event.channel.type', type: 'string', description: 'Channel type (public/private/dm)' },
    { path: 'event.mentioned_user.id', type: 'uuid', description: 'Mentioned user ID' },
    { path: 'event.reaction.emoji', type: 'string', description: 'Reaction emoji' },
    { path: 'event.actor.id', type: 'uuid', description: 'User who performed the action' },
  ],
  beacon: [
    { path: 'event.beacon.id', type: 'uuid', description: 'Beacon entry ID' },
    { path: 'event.beacon.title', type: 'string', description: 'Beacon title' },
    { path: 'event.beacon.category', type: 'string', description: 'Category' },
    { path: 'event.beacon.expires_at', type: 'datetime', description: 'Expiration date' },
    { path: 'event.challenge.reason', type: 'string', description: 'Challenge reason' },
    { path: 'event.actor.id', type: 'uuid', description: 'User who performed the action' },
  ],
  brief: [
    { path: 'event.document.id', type: 'uuid', description: 'Document ID' },
    { path: 'event.document.title', type: 'string', description: 'Document title' },
    { path: 'event.document.project_id', type: 'uuid', description: 'Project ID' },
    { path: 'event.previous_status', type: 'string', description: 'Previous status' },
    { path: 'event.new_status', type: 'string', description: 'New status' },
    { path: 'event.comment.id', type: 'uuid', description: 'Comment ID' },
    { path: 'event.comment.body', type: 'string', description: 'Comment text' },
    { path: 'event.beacon.id', type: 'uuid', description: 'Created beacon ID (promoted)' },
    { path: 'event.actor.id', type: 'uuid', description: 'User who performed the action' },
  ],
  helpdesk: [
    { path: 'event.ticket.id', type: 'uuid', description: 'Ticket ID' },
    { path: 'event.ticket.subject', type: 'string', description: 'Ticket subject' },
    { path: 'event.ticket.priority', type: 'string', description: 'Priority level' },
    { path: 'event.ticket.category', type: 'string', description: 'Category' },
    { path: 'event.previous_status', type: 'string', description: 'Previous status' },
    { path: 'event.new_status', type: 'string', description: 'New status' },
    { path: 'event.reply.body', type: 'string', description: 'Reply text' },
    { path: 'event.sla.type', type: 'string', description: 'SLA type (response/resolution)' },
    { path: 'event.sla.deadline', type: 'datetime', description: 'SLA deadline' },
    { path: 'event.actor.id', type: 'uuid', description: 'User who performed the action' },
  ],
  schedule: [
    { path: 'event.fired_at', type: 'datetime', description: 'When the cron fired' },
    { path: 'event.automation.id', type: 'uuid', description: 'Automation ID' },
    { path: 'event.automation.name', type: 'string', description: 'Automation name' },
  ],
  bond: [
    { path: 'event.deal.id', type: 'uuid', description: 'Deal ID' },
    { path: 'event.deal.title', type: 'string', description: 'Deal title' },
    { path: 'event.deal.amount', type: 'number', description: 'Deal value' },
    { path: 'event.deal.stage', type: 'string', description: 'Pipeline stage' },
    { path: 'event.deal.company_id', type: 'uuid', description: 'Associated company' },
    { path: 'event.deal.contact_id', type: 'uuid', description: 'Primary contact' },
    { path: 'event.deal.lost_reason', type: 'string', description: 'Loss reason (deal.lost)' },
    { path: 'event.previous_stage', type: 'string', description: 'Previous stage (deal.stage_changed)' },
    { path: 'event.new_stage', type: 'string', description: 'New stage (deal.stage_changed)' },
    { path: 'event.contact.id', type: 'uuid', description: 'Contact ID' },
    { path: 'event.contact.name', type: 'string', description: 'Contact name' },
    { path: 'event.contact.email', type: 'string', description: 'Contact email' },
    { path: 'event.activity.id', type: 'uuid', description: 'Activity ID' },
    { path: 'event.activity.type', type: 'string', description: 'Activity type (call/email/meeting/note)' },
    { path: 'event.activity.subject', type: 'string', description: 'Activity subject' },
    { path: 'event.actor.id', type: 'uuid', description: 'User who performed the action' },
  ],
  blast: [
    { path: 'event.campaign.id', type: 'uuid', description: 'Campaign ID' },
    { path: 'event.campaign.name', type: 'string', description: 'Campaign name' },
    { path: 'event.campaign.subject', type: 'string', description: 'Email subject' },
    { path: 'event.campaign.recipient_count', type: 'number', description: 'Recipient count' },
    { path: 'event.actor.id', type: 'uuid', description: 'User who performed the action' },
  ],
  board: [
    { path: 'event.board.id', type: 'uuid', description: 'Board ID' },
    { path: 'event.board.name', type: 'string', description: 'Board name' },
    { path: 'event.board.project_id', type: 'uuid', description: 'Associated project' },
    { path: 'event.changes', type: 'object', description: 'Changed fields map' },
    { path: 'event.actor.id', type: 'uuid', description: 'User who performed the action' },
  ],
  bearing: [
    { path: 'event.goal.id', type: 'uuid', description: 'Goal ID' },
    { path: 'event.goal.title', type: 'string', description: 'Goal title' },
    { path: 'event.goal.period_id', type: 'uuid', description: 'Planning period' },
    { path: 'event.goal.owner_id', type: 'uuid', description: 'Goal owner' },
    { path: 'event.key_result.id', type: 'uuid', description: 'Key Result ID' },
    { path: 'event.key_result.goal_id', type: 'uuid', description: 'Parent goal' },
    { path: 'event.key_result.title', type: 'string', description: 'KR title' },
    { path: 'event.key_result.progress', type: 'number', description: 'KR progress value' },
    { path: 'event.actor.id', type: 'uuid', description: 'User who performed the action' },
  ],
  bill: [
    { path: 'event.invoice.id', type: 'uuid', description: 'Invoice ID' },
    { path: 'event.invoice.number', type: 'string', description: 'Invoice number' },
    { path: 'event.invoice.customer_id', type: 'uuid', description: 'Customer/contact ID' },
    { path: 'event.invoice.amount', type: 'number', description: 'Invoice total' },
    { path: 'event.invoice.paid_at', type: 'datetime', description: 'Payment timestamp' },
    { path: 'event.payment.id', type: 'uuid', description: 'Payment ID' },
    { path: 'event.payment.invoice_id', type: 'uuid', description: 'Related invoice' },
    { path: 'event.payment.amount', type: 'number', description: 'Payment amount' },
    { path: 'event.payment.method', type: 'string', description: 'Payment method' },
    { path: 'event.actor.id', type: 'uuid', description: 'User who performed the action' },
  ],
  book: [
    { path: 'event.event.id', type: 'uuid', description: 'Calendar event ID' },
    { path: 'event.event.title', type: 'string', description: 'Event title' },
    { path: 'event.event.start_time', type: 'datetime', description: 'Event start time' },
    { path: 'event.event.end_time', type: 'datetime', description: 'Event end time' },
    { path: 'event.booking.id', type: 'uuid', description: 'Booking ID' },
    { path: 'event.booking.booking_page_id', type: 'uuid', description: 'Booking page' },
    { path: 'event.booking.guest_name', type: 'string', description: 'Guest name' },
    { path: 'event.booking.guest_email', type: 'string', description: 'Guest email' },
    { path: 'event.booking.start_time', type: 'datetime', description: 'Booked start time' },
    { path: 'event.actor.id', type: 'uuid', description: 'User who performed the action' },
  ],
  blank: [
    { path: 'event.form.id', type: 'uuid', description: 'Form ID' },
    { path: 'event.form.title', type: 'string', description: 'Form title' },
    { path: 'event.submission.id', type: 'uuid', description: 'Submission ID' },
    { path: 'event.submission.form_id', type: 'uuid', description: 'Related form' },
    { path: 'event.submission.answers', type: 'object', description: 'Map of field IDs to answers' },
    { path: 'event.actor.id', type: 'uuid', description: 'User who performed the action' },
  ],
};

// Common fields available in all contexts
const COMMON_FIELDS: FieldSuggestion[] = [
  { path: 'actor.id', type: 'uuid', description: 'User who triggered the event' },
  { path: 'automation.id', type: 'uuid', description: 'Current automation ID' },
  { path: 'automation.name', type: 'string', description: 'Current automation name' },
];

export function FieldPicker({
  value,
  onChange,
  triggerSource,
  triggerEvent,
  placeholder = 'field.path',
  className,
}: FieldPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get relevant suggestions based on trigger source
  const suggestions = useMemo(() => {
    const sourceFields = triggerSource ? FIELD_CATALOG[triggerSource] ?? [] : [];
    const all = [...sourceFields, ...COMMON_FIELDS];

    if (!filter) return all;

    const lowerFilter = filter.toLowerCase();
    return all.filter(
      (f) =>
        f.path.toLowerCase().includes(lowerFilter) ||
        f.description.toLowerCase().includes(lowerFilter),
    );
  }, [triggerSource, filter]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (path: string) => {
    onChange(path);
    setIsOpen(false);
    setFilter('');
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={isOpen ? filter || value : value}
          onChange={(e) => {
            const v = e.target.value;
            if (isOpen) {
              setFilter(v);
            } else {
              onChange(v);
            }
          }}
          onFocus={() => {
            setIsOpen(true);
            setFilter('');
          }}
          className={
            className ??
            'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700 pr-8'
          }
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg"
        >
          {suggestions.map((s) => (
            <button
              key={s.path}
              type="button"
              onClick={() => handleSelect(s.path)}
              className="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors border-b border-zinc-100 dark:border-zinc-700/50 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-zinc-900 dark:text-zinc-100">{s.path}</span>
                <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-700 rounded px-1 py-0.5">
                  {s.type}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{s.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
