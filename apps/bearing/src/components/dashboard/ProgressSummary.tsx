import { Target, TrendingUp, AlertTriangle, Trophy } from 'lucide-react';
import { formatProgress } from '@/lib/utils';
import { usePeriodReport } from '@/hooks/useProgress';

interface ProgressSummaryProps {
  periodId?: string;
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

export function ProgressSummary({ periodId }: ProgressSummaryProps) {
  const { data, isLoading } = usePeriodReport(periodId);
  const report = data?.data;

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-zinc-200 dark:border-zinc-700 animate-pulse bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Goals" value={0} icon={Target} color="#4f46e5" />
        <StatCard label="Avg Progress" value="0%" icon={TrendingUp} color="#059669" />
        <StatCard label="At Risk" value={0} icon={AlertTriangle} color="#d97706" />
        <StatCard label="Achieved" value={0} icon={Trophy} color="#2563eb" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="Total Goals" value={report.total_goals} icon={Target} color="#4f46e5" />
      <StatCard label="Avg Progress" value={formatProgress(report.avg_progress)} icon={TrendingUp} color="#059669" />
      <StatCard label="At Risk" value={report.at_risk + report.behind} icon={AlertTriangle} color="#d97706" />
      <StatCard label="Achieved" value={report.achieved} icon={Trophy} color="#2563eb" />
    </div>
  );
}
