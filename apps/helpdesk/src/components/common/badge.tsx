import { cn } from '@/lib/utils';

type TicketStatus = 'open' | 'in_progress' | 'waiting_on_customer' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

const statusClasses: Record<TicketStatus, string> = {
  open: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  waiting_on_customer: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  resolved: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  closed: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

const statusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_customer: 'Waiting on Customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

const priorityClasses: Record<TicketPriority, string> = {
  low: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  medium: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const priorityLabels: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status as TicketStatus;
  return (
    <span
      data-testid="status-badge"
      data-status={status}
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        statusClasses[key] ?? 'bg-zinc-100 text-zinc-600',
        className,
      )}
    >
      {statusLabels[key] ?? status}
    </span>
  );
}

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const key = priority as TicketPriority;
  return (
    <span
      data-testid="priority-badge"
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        priorityClasses[key] ?? 'bg-zinc-100 text-zinc-600',
        className,
      )}
    >
      {priorityLabels[key] ?? priority}
    </span>
  );
}
