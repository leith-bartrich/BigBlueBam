import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft, AlertTriangle, Activity, Users, BarChart3, TrendingDown } from 'lucide-react';
import type { PaginatedResponse } from '@bigbluebam/shared';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/common/button';
import { Badge } from '@/components/common/badge';
import { Avatar } from '@/components/common/avatar';
import { useProject } from '@/hooks/use-projects';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

interface ProjectDashboardPageProps {
  projectId: string;
  onNavigate: (path: string) => void;
}

interface StatusDistribution {
  phases: { id: string; name: string; task_count: number; points: number }[];
  priorities: { priority: string; count: number }[];
  total_tasks: number;
  completed_tasks: number;
  total_points: number;
  completed_points: number;
}

interface OverdueTask {
  id: string;
  human_id: string;
  title: string;
  due_date: string;
  priority: string;
  assignee?: { display_name: string } | null;
}

interface WorkloadEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  task_count: number;
  points: number;
  by_priority: { critical: number; high: number; medium: number; low: number };
}

interface ActivityEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown>;
  created_at: string;
  actor?: { display_name: string; avatar_url: string | null };
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  none: '#a1a1aa',
};

export function ProjectDashboardPage({ projectId, onNavigate }: ProjectDashboardPageProps) {
  const { data: projectRes } = useProject(projectId);
  const project = projectRes?.data;

  const { data: statusRes, isLoading: statusLoading } = useQuery({
    queryKey: ['project-status', projectId],
    queryFn: () => api.get<{ data: StatusDistribution }>(`/projects/${projectId}/reports/status-distribution`),
    enabled: !!projectId,
  });
  const status = statusRes?.data;

  const { data: overdueRes } = useQuery({
    queryKey: ['project-overdue', projectId],
    queryFn: () => api.get<{ data: OverdueTask[] }>(`/projects/${projectId}/reports/overdue`),
    enabled: !!projectId,
  });
  const overdueTasks = overdueRes?.data ?? [];

  const { data: workloadRes } = useQuery({
    queryKey: ['project-workload', projectId],
    queryFn: () => api.get<{ data: WorkloadEntry[] }>(`/projects/${projectId}/reports/workload`),
    enabled: !!projectId,
  });
  const workload = workloadRes?.data ?? [];

  const { data: activityRes } = useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: () =>
      api.get<PaginatedResponse<ActivityEntry>>(`/projects/${projectId}/activity`, { limit: 10 }),
    enabled: !!projectId,
  });
  const activities = activityRes?.data ?? [];

  // Velocity chart data
  const { data: velocityRes } = useQuery({
    queryKey: ['project-velocity', projectId],
    queryFn: () =>
      api.get<{ data: { sprint_name: string; completed_points: number; committed_points: number }[] }>(
        `/projects/${projectId}/reports/velocity`,
      ),
    enabled: !!projectId,
  });
  const velocityData = velocityRes?.data ?? [];

  // Burndown chart data
  const { data: burndownRes } = useQuery({
    queryKey: ['project-burndown', projectId],
    queryFn: () =>
      api.get<{ data: { date: string; remaining: number; ideal: number }[] }>(
        `/projects/${projectId}/reports/burndown`,
        { sprint_id: 'ACTIVE' },
      ),
    enabled: !!projectId,
  });
  const burndownData = burndownRes?.data ?? [];

  const totalTasks = status?.total_tasks ?? 0;
  const completedTasks = status?.completed_tasks ?? 0;
  const totalPoints = status?.total_points ?? 0;
  const completedPoints = status?.completed_points ?? 0;
  const sprintProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const pointsProgress = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

  const phases = status?.phases ?? [];
  const maxPhaseTasks = Math.max(...phases.map((p) => p.task_count), 1);

  const priorities = status?.priorities ?? [];

  const maxWorkload = Math.max(...workload.map((w) => w.task_count), 1);

  return (
    <AppLayout
      currentProjectId={projectId}
      breadcrumbs={[
        { label: 'Projects', href: '/' },
        { label: project?.name ?? 'Loading...', href: `/projects/${projectId}/board` },
        { label: 'Dashboard' },
      ]}
      onNavigate={onNavigate}
      onCreateProject={() => onNavigate('/')}
    >
      {statusLoading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate(`/projects/${projectId}/board`)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Board
              </Button>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {project?.name} Dashboard
              </h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate(`/projects/${projectId}/reports`)}
            >
              <BarChart3 className="h-4 w-4" />
              Reports
            </Button>
          </div>

          {/* Top row: Sprint Progress + Priority Breakdown + Overdue */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sprint Progress */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-zinc-500 mb-3 flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Sprint Progress
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-zinc-700 dark:text-zinc-300">Tasks</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {completedTasks}/{totalTasks} ({sprintProgress}%)
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-all duration-500"
                      style={{ width: `${sprintProgress}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-zinc-700 dark:text-zinc-300">Points</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {completedPoints}/{totalPoints} ({pointsProgress}%)
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-500"
                      style={{ width: `${pointsProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Priority Breakdown */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-zinc-500 mb-3">Priority Breakdown</h3>
              <div className="space-y-2.5">
                {priorities.map((p) => (
                  <div key={p.priority} className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: PRIORITY_COLORS[p.priority] ?? '#a1a1aa' }}
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 capitalize flex-1">
                      {p.priority}
                    </span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {p.count}
                    </span>
                  </div>
                ))}
                {priorities.length === 0 && (
                  <p className="text-sm text-zinc-400">No tasks yet</p>
                )}
              </div>
            </div>

            {/* Overdue Tasks */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-zinc-500 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Overdue Tasks
                {overdueTasks.length > 0 && (
                  <Badge variant="danger">{overdueTasks.length}</Badge>
                )}
              </h3>
              {overdueTasks.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {overdueTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded px-1"
                      onClick={() => onNavigate(`/projects/${projectId}/board`)}
                    >
                      <span className="font-mono text-xs text-red-500">{t.human_id}</span>
                      <span className="text-zinc-700 dark:text-zinc-300 truncate flex-1">
                        {t.title}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400">No overdue tasks</p>
              )}
            </div>
          </div>

          {/* Middle row: Task Distribution + Team Workload */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Distribution by Phase */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-zinc-500 mb-4">Task Distribution by Phase</h3>
              <div className="space-y-3">
                {phases.map((phase, i) => {
                  const colors = ['#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#ef4444', '#eab308'];
                  const color = colors[i % colors.length];
                  const widthPct = Math.max((phase.task_count / maxPhaseTasks) * 100, 2);
                  return (
                    <div key={phase.id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-zinc-700 dark:text-zinc-300">{phase.name}</span>
                        <span className="text-zinc-500">
                          {phase.task_count} tasks / {phase.points} pts
                        </span>
                      </div>
                      <div className="w-full h-6 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded transition-all duration-500"
                          style={{ width: `${widthPct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
                {phases.length === 0 && (
                  <p className="text-sm text-zinc-400">No phases configured</p>
                )}
              </div>
            </div>

            {/* Team Workload */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-zinc-500 mb-4 flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Team Workload
              </h3>
              <div className="space-y-3">
                {workload.map((w) => {
                  const totalWidth = Math.max((w.task_count / maxWorkload) * 100, 2);
                  const bp = w.by_priority;
                  const total = bp.critical + bp.high + bp.medium + bp.low || 1;
                  return (
                    <div key={w.user_id}>
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar src={w.avatar_url} name={w.display_name} size="sm" />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">
                          {w.display_name}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {w.task_count} tasks / {w.points} pts
                        </span>
                      </div>
                      <div
                        className="h-5 rounded overflow-hidden flex"
                        style={{ width: `${totalWidth}%` }}
                      >
                        {bp.critical > 0 && (
                          <div
                            className="h-full"
                            style={{
                              width: `${(bp.critical / total) * 100}%`,
                              backgroundColor: PRIORITY_COLORS.critical,
                            }}
                            title={`Critical: ${bp.critical}`}
                          />
                        )}
                        {bp.high > 0 && (
                          <div
                            className="h-full"
                            style={{
                              width: `${(bp.high / total) * 100}%`,
                              backgroundColor: PRIORITY_COLORS.high,
                            }}
                            title={`High: ${bp.high}`}
                          />
                        )}
                        {bp.medium > 0 && (
                          <div
                            className="h-full"
                            style={{
                              width: `${(bp.medium / total) * 100}%`,
                              backgroundColor: PRIORITY_COLORS.medium,
                            }}
                            title={`Medium: ${bp.medium}`}
                          />
                        )}
                        {bp.low > 0 && (
                          <div
                            className="h-full"
                            style={{
                              width: `${(bp.low / total) * 100}%`,
                              backgroundColor: PRIORITY_COLORS.low,
                            }}
                            title={`Low: ${bp.low}`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
                {workload.length === 0 && (
                  <p className="text-sm text-zinc-400">No team members assigned</p>
                )}
              </div>
              {/* Legend */}
              {workload.length > 0 && (
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  {Object.entries(PRIORITY_COLORS)
                    .filter(([k]) => k !== 'none')
                    .map(([name, color]) => (
                      <div key={name} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs text-zinc-500 capitalize">{name}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Sprint Charts: Velocity + Burndown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Velocity Chart */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-zinc-500 mb-4 flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Velocity Chart
              </h3>
              {velocityData.length > 0 ? (
                <div className="flex items-end gap-2 h-40">
                  {(() => {
                    const maxVal = Math.max(...velocityData.map((v) => Math.max(v.completed_points, v.committed_points)), 1);
                    return velocityData.map((v, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: '120px' }}>
                          <div
                            className="w-3 rounded-t bg-zinc-300 dark:bg-zinc-600 transition-all"
                            style={{ height: `${(v.committed_points / maxVal) * 120}px` }}
                            title={`Committed: ${v.committed_points}`}
                          />
                          <div
                            className="w-3 rounded-t bg-primary-500 transition-all"
                            style={{ height: `${(v.completed_points / maxVal) * 120}px` }}
                            title={`Completed: ${v.completed_points}`}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-400 truncate max-w-full" title={v.sprint_name}>
                          {v.sprint_name.length > 8 ? v.sprint_name.slice(0, 8) + '...' : v.sprint_name}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <p className="text-sm text-zinc-400">No velocity data available</p>
              )}
              {velocityData.length > 0 && (
                <div className="flex items-center gap-4 mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                    <span className="text-xs text-zinc-500">Committed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary-500" />
                    <span className="text-xs text-zinc-500">Completed</span>
                  </div>
                </div>
              )}
            </div>

            {/* Burndown Chart */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-zinc-500 mb-4 flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4" />
                Sprint Burndown
              </h3>
              {burndownData.length > 0 ? (
                <div className="relative h-40">
                  <svg viewBox={`0 0 ${burndownData.length * 40} 120`} className="w-full h-full" preserveAspectRatio="none">
                    {(() => {
                      const maxVal = Math.max(...burndownData.map((d) => Math.max(d.remaining, d.ideal)), 1);
                      const xStep = burndownData.length > 1 ? (burndownData.length * 40 - 20) / (burndownData.length - 1) : 0;

                      const idealPoints = burndownData
                        .map((d, i) => `${10 + i * xStep},${110 - (d.ideal / maxVal) * 100}`)
                        .join(' ');
                      const remainingPoints = burndownData
                        .map((d, i) => `${10 + i * xStep},${110 - (d.remaining / maxVal) * 100}`)
                        .join(' ');

                      return (
                        <>
                          <polyline
                            fill="none"
                            stroke="#a1a1aa"
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                            points={idealPoints}
                          />
                          <polyline
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            points={remainingPoints}
                          />
                          {burndownData.map((d, i) => (
                            <circle
                              key={i}
                              cx={10 + i * xStep}
                              cy={110 - (d.remaining / maxVal) * 100}
                              r="2.5"
                              fill="#3b82f6"
                            />
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">No burndown data available</p>
              )}
              {burndownData.length > 0 && (
                <div className="flex items-center gap-4 mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-zinc-400" style={{ borderTop: '1.5px dashed #a1a1aa' }} />
                    <span className="text-xs text-zinc-500">Ideal</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-blue-500" />
                    <span className="text-xs text-zinc-500">Remaining</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom: Recent Activity */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
            <h3 className="text-sm font-medium text-zinc-500 mb-4 flex items-center gap-1.5">
              <Activity className="h-4 w-4" />
              Recent Activity
            </h3>
            {activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 py-1.5">
                    <Avatar
                      src={entry.actor?.avatar_url}
                      name={entry.actor?.display_name}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        <span className="font-medium">
                          {entry.actor?.display_name ?? 'Someone'}
                        </span>{' '}
                        {entry.action}
                      </p>
                      <span className="text-xs text-zinc-400">
                        {formatRelativeTime(entry.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No recent activity</p>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
