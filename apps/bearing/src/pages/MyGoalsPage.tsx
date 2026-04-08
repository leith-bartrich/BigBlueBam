import { Loader2, User, Target, Plus } from 'lucide-react';
import { useMyGoals } from '@/hooks/useProgress';
import { Avatar } from '@/components/common/avatar';
import { ProgressBar } from '@/components/common/ProgressBar';
import { StatusBadge } from '@/components/goal/StatusBadge';
import { Badge } from '@/components/common/badge';
import { Button } from '@/components/common/button';
import { useAuthStore } from '@/stores/auth.store';
import type { BearingGoal } from '@/hooks/useGoals';

interface MyGoalsPageProps {
  onNavigate: (path: string) => void;
}

function GoalRow({ goal, onNavigate }: { goal: BearingGoal; onNavigate: (path: string) => void }) {
  return (
    <div
      onClick={() => onNavigate(`/goals/${goal.id}`)}
      className="flex items-center gap-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-4 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors cursor-pointer"
    >
      {/* Target icon */}
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 shrink-0">
        <Target className="h-5 w-5 text-primary-500" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{goal.title}</h3>
          <StatusBadge status={goal.status} />
        </div>
        <div className="flex items-center gap-3">
          <ProgressBar value={Number(goal.progress ?? 0)} expected={goal.expected_progress ?? 0} size="sm" className="flex-1 max-w-[200px]" />
          {goal.period_name && (
            <Badge>{goal.period_name}</Badge>
          )}
          <Badge variant="primary">{goal.scope}</Badge>
        </div>
      </div>

      {/* KR count */}
      <div className="text-right shrink-0">
        <p className="text-xs text-zinc-400">Key Results</p>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{goal.key_result_count ?? 0}</p>
      </div>
    </div>
  );
}

export function MyGoalsPage({ onNavigate }: MyGoalsPageProps) {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useMyGoals();
  const goals = data?.data ?? [];

  // Group by status for better organization
  const activeGoals = goals.filter((g) => !['achieved', 'missed'].includes(g.status));
  const completedGoals = goals.filter((g) => ['achieved', 'missed'].includes(g.status));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {user && (
            <Avatar src={user.avatar_url} name={user.display_name} size="lg" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Goals</h1>
            <p className="text-sm text-zinc-500 mt-1">
              All goals owned by you across all periods.
            </p>
          </div>
        </div>
        <Button onClick={() => onNavigate('/')}>
          <Plus className="h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <User className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No goals assigned to you</p>
          <p className="text-sm mt-1">Create a new goal or ask to be assigned as owner.</p>
          <Button className="mt-4" onClick={() => onNavigate('/')}>
            <Plus className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active goals */}
          {activeGoals.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-4">
                Active ({activeGoals.length})
              </h2>
              <div className="space-y-2">
                {activeGoals.map((goal) => (
                  <GoalRow key={goal.id} goal={goal} onNavigate={onNavigate} />
                ))}
              </div>
            </section>
          )}

          {/* Completed goals */}
          {completedGoals.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-4">
                Completed ({completedGoals.length})
              </h2>
              <div className="space-y-2">
                {completedGoals.map((goal) => (
                  <GoalRow key={goal.id} goal={goal} onNavigate={onNavigate} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
