import { Loader2, AlertTriangle, Target } from 'lucide-react';
import { useAtRiskGoals } from '@/hooks/useProgress';
import { Avatar } from '@/components/common/avatar';
import { ProgressBar } from '@/components/common/ProgressBar';
import { StatusBadge } from '@/components/goal/StatusBadge';
import { usePeriodStore } from '@/stores/period.store';
import { PeriodSelector } from '@/components/dashboard/PeriodSelector';
import { formatProgress } from '@/lib/utils';
import type { BearingGoal } from '@/hooks/useGoals';

interface AtRiskPageProps {
  onNavigate: (path: string) => void;
}

function AtRiskGoalRow({ goal, onNavigate }: { goal: BearingGoal; onNavigate: (path: string) => void }) {
  const progress = Number(goal.progress ?? 0);
  const expected = goal.expected_progress ?? 0;
  const gap = progress - expected;
  const gapLabel = gap >= 0 ? `+${Math.round(gap)}%` : `${Math.round(gap)}%`;

  return (
    <div
      onClick={() => onNavigate(`/goals/${goal.id}`)}
      className="flex items-center gap-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-4 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors cursor-pointer"
    >
      {/* Status indicator */}
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-50 dark:bg-red-900/20 shrink-0">
        <AlertTriangle className="h-5 w-5 text-red-500" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{goal.title}</h3>
          <StatusBadge status={goal.status} />
        </div>
        <div className="flex items-center gap-3">
          <ProgressBar value={progress} expected={expected} size="sm" className="flex-1 max-w-[200px]" />
          <span className="text-xs text-zinc-500">
            {formatProgress(progress)} actual vs {formatProgress(expected)} expected
          </span>
        </div>
      </div>

      {/* Gap indicator */}
      <div className="text-right shrink-0">
        <p className="text-xs text-zinc-400">Gap</p>
        <p className={`text-sm font-bold ${gap < -20 ? 'text-red-600' : gap < 0 ? 'text-yellow-600' : 'text-green-600'}`}>
          {gapLabel}
        </p>
      </div>

      {/* Owner */}
      {goal.owner ? (
        <div className="flex items-center gap-2 shrink-0">
          <Avatar src={goal.owner.avatar_url} name={goal.owner.display_name} size="sm" />
          <span className="text-xs text-zinc-500 max-w-[80px] truncate">{goal.owner.display_name}</span>
        </div>
      ) : null}
    </div>
  );
}

export function AtRiskPage({ onNavigate }: AtRiskPageProps) {
  const selectedPeriodId = usePeriodStore((s) => s.selectedPeriodId);
  const { data, isLoading } = useAtRiskGoals();
  const goals = data?.data ?? [];

  // Sort by gap (most behind first)
  const sorted = [...goals].sort((a, b) => {
    const gapA = Number(a.progress ?? 0) - (a.expected_progress ?? 0);
    const gapB = Number(b.progress ?? 0) - (b.expected_progress ?? 0);
    return gapA - gapB;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">At Risk Goals</h1>
        <p className="text-sm text-zinc-500 mt-1">Goals that are behind expected progress and need attention.</p>
      </div>

      {/* Period selector */}
      <PeriodSelector />

      {/* Content */}
      {!selectedPeriodId ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <Target className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Select a period</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <Target className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">All goals are on track</p>
          <p className="text-sm mt-1">No goals are currently at risk or behind.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-zinc-500 mb-4">
            {sorted.length} goal{sorted.length !== 1 ? 's' : ''} need{sorted.length === 1 ? 's' : ''} attention
          </p>
          {sorted.map((goal) => (
            <AtRiskGoalRow key={goal.id} goal={goal} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}
