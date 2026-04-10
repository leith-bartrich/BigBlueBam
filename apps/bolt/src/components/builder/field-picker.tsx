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
    { path: 'event.comment.id', type: 'uuid', description: 'Comment ID (task.commented)' },
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
