import { useQuery } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import { Avatar } from '@/components/common/avatar';
import { api } from '@/lib/api';

interface WorkloadEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  task_count: number;
  points: number;
  by_priority: { critical: number; high: number; medium: number; low: number };
}

interface WorkloadViewProps {
  projectId: string;
  onFilterByUser?: (userId: string) => void;
}

const PRIORITY_COLORS = {
  critical: { bg: '#ef4444', label: 'Critical' },
  high: { bg: '#f97316', label: 'High' },
  medium: { bg: '#eab308', label: 'Medium' },
  low: { bg: '#3b82f6', label: 'Low' },
} as const;

export function WorkloadView({ projectId, onFilterByUser }: WorkloadViewProps) {
  const { data: workloadRes, isLoading } = useQuery({
    queryKey: ['project-workload', projectId],
    queryFn: () => api.get<{ data: WorkloadEntry[] }>(`/projects/${projectId}/reports/workload`),
    enabled: !!projectId,
  });
  const workload = workloadRes?.data ?? [];

  const maxTasks = Math.max(...workload.map((w) => w.task_count), 1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (workload.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <Users className="h-12 w-12 text-zinc-300 mb-4" />
        <h2 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No workload data</h2>
        <p className="text-sm text-zinc-500 mt-1">Assign tasks to team members to see workload distribution.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
        <Users className="h-5 w-5" />
        Team Workload
      </h2>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-6">
        {Object.entries(PRIORITY_COLORS).map(([key, { bg, label }]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: bg }} />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        {workload.map((w) => {
          const bp = w.by_priority;
          const total = bp.critical + bp.high + bp.medium + bp.low || 1;
          const barWidth = Math.max((w.task_count / maxTasks) * 100, 5);

          return (
            <div
              key={w.user_id}
              className="group cursor-pointer rounded-lg p-3 -mx-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              onClick={() => onFilterByUser?.(w.user_id)}
            >
              <div className="flex items-center gap-3 mb-2">
                <Avatar src={w.avatar_url} name={w.display_name} size="md" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-primary-600 transition-colors">
                    {w.display_name}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {w.task_count} tasks
                  </span>
                  <span className="text-xs text-zinc-500 ml-2">
                    {w.points} pts
                  </span>
                </div>
              </div>

              <div
                className="h-7 rounded-md overflow-hidden flex"
                style={{ width: `${barWidth}%` }}
              >
                {bp.critical > 0 && (
                  <div
                    className="h-full transition-all duration-300 flex items-center justify-center text-[10px] font-medium text-white"
                    style={{
                      width: `${(bp.critical / total) * 100}%`,
                      backgroundColor: PRIORITY_COLORS.critical.bg,
                      minWidth: bp.critical > 0 ? '20px' : '0',
                    }}
                  >
                    {bp.critical > 1 ? bp.critical : ''}
                  </div>
                )}
                {bp.high > 0 && (
                  <div
                    className="h-full transition-all duration-300 flex items-center justify-center text-[10px] font-medium text-white"
                    style={{
                      width: `${(bp.high / total) * 100}%`,
                      backgroundColor: PRIORITY_COLORS.high.bg,
                      minWidth: bp.high > 0 ? '20px' : '0',
                    }}
                  >
                    {bp.high > 1 ? bp.high : ''}
                  </div>
                )}
                {bp.medium > 0 && (
                  <div
                    className="h-full transition-all duration-300 flex items-center justify-center text-[10px] font-medium text-zinc-800"
                    style={{
                      width: `${(bp.medium / total) * 100}%`,
                      backgroundColor: PRIORITY_COLORS.medium.bg,
                      minWidth: bp.medium > 0 ? '20px' : '0',
                    }}
                  >
                    {bp.medium > 1 ? bp.medium : ''}
                  </div>
                )}
                {bp.low > 0 && (
                  <div
                    className="h-full transition-all duration-300 flex items-center justify-center text-[10px] font-medium text-white"
                    style={{
                      width: `${(bp.low / total) * 100}%`,
                      backgroundColor: PRIORITY_COLORS.low.bg,
                      minWidth: bp.low > 0 ? '20px' : '0',
                    }}
                  >
                    {bp.low > 1 ? bp.low : ''}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
