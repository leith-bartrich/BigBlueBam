import { LayoutGrid, List, GanttChart, Calendar, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'board' | 'list' | 'timeline' | 'calendar' | 'workload';

interface ViewSwitcherProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const views: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'board', label: 'Board', icon: LayoutGrid },
  { value: 'list', label: 'List', icon: List },
  { value: 'timeline', label: 'Timeline', icon: GanttChart },
  { value: 'calendar', label: 'Calendar', icon: Calendar },
  { value: 'workload', label: 'Workload', icon: Users },
];

export function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-0.5">
      {views.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => onViewChange(value)}
          title={label}
          aria-label={`${label} view`}
          aria-pressed={activeView === value}
          className={cn(
            'inline-flex items-center justify-center rounded-md p-1.5 transition-colors',
            activeView === value
              ? 'bg-white dark:bg-zinc-900 text-primary-600 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
