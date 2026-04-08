import { GoalCard } from '@/components/dashboard/GoalCard';
import type { BearingGoal, GoalScope } from '@/hooks/useGoals';

interface GoalGridProps {
  goals: BearingGoal[];
  onNavigate: (path: string) => void;
  groupByScope?: boolean;
}

const scopeOrder: GoalScope[] = ['organization', 'team', 'project', 'individual'];
const scopeLabels: Record<GoalScope, string> = {
  organization: 'Organization Goals',
  team: 'Team Goals',
  project: 'Project Goals',
  individual: 'Individual Goals',
};

export function GoalGrid({ goals, onNavigate, groupByScope = true }: GoalGridProps) {
  if (!groupByScope) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} onNavigate={onNavigate} />
        ))}
      </div>
    );
  }

  // Group goals by scope
  const grouped = new Map<GoalScope, BearingGoal[]>();
  for (const goal of goals) {
    const existing = grouped.get(goal.scope) ?? [];
    existing.push(goal);
    grouped.set(goal.scope, existing);
  }

  return (
    <div className="space-y-8">
      {scopeOrder.map((scope) => {
        const scopeGoals = grouped.get(scope);
        if (!scopeGoals || scopeGoals.length === 0) return null;

        return (
          <section key={scope}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                {scopeLabels[scope]}
              </h2>
              <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">
                {scopeGoals.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {scopeGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onNavigate={onNavigate} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
