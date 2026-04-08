import { Target, Key } from 'lucide-react';
import { Avatar } from '@/components/common/avatar';
import { ProgressBar } from '@/components/common/ProgressBar';
import { StatusBadge } from '@/components/goal/StatusBadge';
import { Badge } from '@/components/common/badge';
import type { BearingGoal } from '@/hooks/useGoals';
import { cn } from '@/lib/utils';

interface GoalCardProps {
  goal: BearingGoal;
  onNavigate: (path: string) => void;
}

const scopeColors: Record<string, string> = {
  organization: '#4f46e5',
  team: '#7c3aed',
  project: '#059669',
  individual: '#d97706',
};

export function GoalCard({ goal, onNavigate }: GoalCardProps) {
  return (
    <div
      onClick={() => onNavigate(`/goals/${goal.id}`)}
      className={cn(
        'group rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-5',
        'hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all cursor-pointer',
        'animate-scale-in',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 shrink-0">
            <Target className="h-4.5 w-4.5 text-primary-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {goal.title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge color={scopeColors[goal.scope]}>
                {goal.scope}
              </Badge>
              {goal.project_name && (
                <span className="text-xs text-zinc-500 truncate">{goal.project_name}</span>
              )}
              {goal.team_name && (
                <span className="text-xs text-zinc-500 truncate">{goal.team_name}</span>
              )}
            </div>
          </div>
        </div>
        <StatusBadge status={goal.status} />
      </div>

      {/* Progress */}
      <div className="mb-3">
        <ProgressBar value={Number(goal.progress ?? 0) * 100} expected={(goal.expected_progress ?? 0) * 100} size="sm" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {goal.owner ? (
          <div className="flex items-center gap-2">
            <Avatar src={goal.owner.avatar_url} name={goal.owner.display_name} size="sm" />
            <span className="text-xs text-zinc-500 truncate max-w-[120px]">{goal.owner.display_name}</span>
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-1 text-xs text-zinc-400">
          <Key className="h-3 w-3" />
          <span>{goal.key_result_count ?? 0} KR{(goal.key_result_count ?? 0) !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
