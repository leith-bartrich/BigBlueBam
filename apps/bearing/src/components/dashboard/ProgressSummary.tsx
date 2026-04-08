import { Target, TrendingUp, AlertTriangle, Trophy } from 'lucide-react';
import type { BearingGoal } from '@/hooks/useGoals';

interface ProgressSummaryProps {
  goals: BearingGoal[];
  isLoading?: boolean;
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof Target; color: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-5">
      <div className="flex items-center justify-center h-10 w-10 rounded-lg" style={{ backgroundColor: `${color}15` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
        <p className="text-sm text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

export function ProgressSummary({ goals, isLoading }: ProgressSummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-zinc-200 dark:border-zinc-700 animate-pulse bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    );
  }

  const total = goals.length;
  const avgProgress = total > 0
    ? Math.round((goals.reduce((sum, g) => sum + Number(g.progress ?? 0), 0) / total) * 100)
    : 0;
  const atRisk = goals.filter((g) => g.status === 'at_risk' || g.status === 'behind').length;
  const achieved = goals.filter((g) => g.status === 'achieved').length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard label="Total Goals" value={total} icon={Target} color="#4f46e5" />
      <StatCard label="Avg Progress" value={`${avgProgress}%`} icon={TrendingUp} color="#059669" />
      <StatCard label="At Risk" value={atRisk} icon={AlertTriangle} color="#d97706" />
      <StatCard label="Achieved" value={achieved} icon={Trophy} color="#2563eb" />
    </div>
  );
}
