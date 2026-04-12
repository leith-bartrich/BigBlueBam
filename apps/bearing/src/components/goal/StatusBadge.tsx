import { cn } from '@/lib/utils';
import type { GoalStatus } from '@/hooks/useGoals';

interface StatusBadgeProps {
  status: GoalStatus;
  className?: string;
}

const statusConfig: Record<GoalStatus, { label: string; classes: string }> = {
  draft: {
    label: 'Draft',
    classes: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  },
  on_track: {
    label: 'On Track',
    classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  at_risk: {
    label: 'At Risk',
    classes: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  behind: {
    label: 'Behind',
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  achieved: {
    label: 'Achieved',
    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  missed: {
    label: 'Missed',
    classes: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : status,
    classes: 'bg-zinc-100 text-zinc-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.classes,
        className,
      )}
    >
      <span className={cn(
        'h-1.5 w-1.5 rounded-full',
        status === 'draft' && 'bg-zinc-400',
        status === 'on_track' && 'bg-green-500',
        status === 'at_risk' && 'bg-yellow-500',
        status === 'behind' && 'bg-red-500',
        status === 'achieved' && 'bg-blue-500',
        status === 'missed' && 'bg-zinc-400',
      )} />
      {config.label}
    </span>
  );
}
