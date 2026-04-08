import { Clock, AlertTriangle } from 'lucide-react';
import { daysRemaining, cn } from '@/lib/utils';

interface TimeRemainingBadgeProps {
  endDate: string | null | undefined;
  className?: string;
}

export function TimeRemainingBadge({ endDate, className }: TimeRemainingBadgeProps) {
  const days = daysRemaining(endDate);

  if (days == null) return null;

  const isOverdue = days < 0;
  const isUrgent = days >= 0 && days <= 7;
  const absDays = Math.abs(days);

  let label: string;
  if (isOverdue) {
    label = absDays === 1 ? '1 day overdue' : `${absDays} days overdue`;
  } else if (days === 0) {
    label = 'Due today';
  } else {
    label = days === 1 ? '1 day remaining' : `${days} days remaining`;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        isOverdue
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : isUrgent
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
        className,
      )}
    >
      {isOverdue ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {label}
    </span>
  );
}
