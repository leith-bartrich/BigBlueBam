import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4">
        <Icon className="h-7 w-7 text-zinc-400" />
      </div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{title}</h3>
      {description && <p className="text-sm text-zinc-500 max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}
