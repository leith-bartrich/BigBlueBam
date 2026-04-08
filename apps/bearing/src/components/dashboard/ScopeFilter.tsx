import { cn } from '@/lib/utils';
import type { GoalScope } from '@/hooks/useGoals';

type ScopeTab = 'all' | GoalScope;

interface ScopeFilterProps {
  active: ScopeTab;
  onChange: (scope: ScopeTab) => void;
}

const tabs: Array<{ value: ScopeTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'organization', label: 'Organization' },
  { value: 'team', label: 'Team' },
  { value: 'project', label: 'Project' },
  { value: 'individual', label: 'Individual' },
];

export function ScopeFilter({ active, onChange }: ScopeFilterProps) {
  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
            active === tab.value
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
