import type { ExecutionStatus } from '@/hooks/use-automations';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, MinusCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: ExecutionStatus;
  className?: string;
}

const statusConfig: Record<ExecutionStatus, { label: string; classes: string; icon: typeof CheckCircle2 }> = {
  success: {
    label: 'Success',
    classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
  },
  partial: {
    label: 'Partial',
    classes: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: AlertTriangle,
  },
  running: {
    label: 'Running',
    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Loader2,
  },
  skipped: {
    label: 'Skipped',
    classes: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
    icon: MinusCircle,
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.classes,
        className,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', status === 'running' && 'animate-spin')} />
      {config.label}
    </span>
  );
}
