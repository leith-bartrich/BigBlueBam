import { cn } from '@/lib/utils';
import type { BeaconStatus } from '@/hooks/use-beacons';

const statusStyles: Record<BeaconStatus, string> = {
  Draft: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  Active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  PendingReview: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  Archived: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  Retired: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

const statusLabels: Record<BeaconStatus, string> = {
  Draft: 'Draft',
  Active: 'Active',
  PendingReview: 'Pending Review',
  Archived: 'Archived',
  Retired: 'Retired',
};

interface StatusBadgeProps {
  status: BeaconStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        statusStyles[status],
        className,
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
