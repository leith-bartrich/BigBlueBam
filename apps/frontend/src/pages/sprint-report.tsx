import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Target, CheckCircle2, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/common/button';
import { Badge } from '@/components/common/badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useProject } from '@/hooks/use-projects';

interface SprintReportData {
  sprint: {
    id: string;
    name: string;
    goal: string | null;
    status: string;
    start_date: string;
    end_date: string;
    completed_at: string | null;
  };
  velocity: {
    committed: number;
    completed: number;
  };
  tasks: {
    total: number;
    completed: number;
    carry_forward: number;
  };
  burndown?: { date: string; remaining: number; ideal: number }[];
}

interface SprintReportPageProps {
  projectId: string;
  sprintId: string;
  onNavigate: (path: string) => void;
}

export function SprintReportPage({ projectId, sprintId, onNavigate }: SprintReportPageProps) {
  const { data: projectRes } = useProject(projectId);
  const project = projectRes?.data;

  const { data: reportRes, isLoading } = useQuery({
    queryKey: ['sprint-report', sprintId],
    queryFn: () => api.get<{ data: SprintReportData }>(`/sprints/${sprintId}/report`),
    enabled: !!sprintId,
  });
  const report = reportRes?.data;

  const completionRate =
    report && report.tasks.total > 0
      ? Math.round((report.tasks.completed / report.tasks.total) * 100)
      : 0;

  return (
    <AppLayout
      currentProjectId={projectId}
      breadcrumbs={[
        { label: 'Projects', href: '/' },
        { label: project?.name ?? 'Loading...', href: `/projects/${projectId}/board` },
        { label: 'Sprint Report' },
      ]}
      onNavigate={onNavigate}
      onCreateProject={() => onNavigate('/')}
    >
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(`/projects/${projectId}/board`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Board
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : !report ? (
          <div className="text-center py-20">
            <p className="text-zinc-400">No report data available for this sprint.</p>
          </div>
        ) : (
          <>
            {/* Sprint header */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {report.sprint.name}
                </h1>
                <Badge variant={report.sprint.status === 'completed' ? 'success' : 'default'}>
                  {report.sprint.status}
                </Badge>
              </div>
              {report.sprint.goal && (
                <p className="text-zinc-500 flex items-center gap-1.5">
                  <Target className="h-4 w-4 shrink-0" />
                  {report.sprint.goal}
                </p>
              )}
              <p className="text-sm text-zinc-400">
                {formatDate(report.sprint.start_date)} - {formatDate(report.sprint.end_date)}
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Velocity - committed */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
                <p className="text-xs font-medium text-zinc-500 mb-1">Points Committed</p>
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  {report.velocity.committed}
                </p>
              </div>

              {/* Velocity - completed */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
                <p className="text-xs font-medium text-zinc-500 mb-1">Points Completed</p>
                <p className="text-3xl font-bold text-primary-600">
                  {report.velocity.completed}
                </p>
              </div>

              {/* Tasks completed */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
                <p className="text-xs font-medium text-zinc-500 mb-1">Tasks Completed</p>
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  <span className="text-primary-600">{report.tasks.completed}</span>
                  <span className="text-lg text-zinc-400 font-normal"> / {report.tasks.total}</span>
                </p>
              </div>

              {/* Carry forward */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
                <p className="text-xs font-medium text-zinc-500 mb-1 flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" /> Carry Forward
                </p>
                <p className="text-3xl font-bold text-amber-600">
                  {report.tasks.carry_forward}
                </p>
              </div>
            </div>

            {/* Completion rate */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 bg-white dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Completion Rate
                </h2>
                <span className="text-2xl font-bold text-primary-600">{completionRate}%</span>
              </div>
              <div className="w-full h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>

            {/* Burndown chart (simple text-based if data available) */}
            {report.burndown && report.burndown.length > 0 && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 bg-white dark:bg-zinc-900">
                <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Burndown
                </h2>
                <div className="relative h-48">
                  <svg
                    viewBox={`0 0 ${report.burndown.length * 60} 200`}
                    className="w-full h-full"
                    preserveAspectRatio="none"
                  >
                    {/* Ideal line */}
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      className="text-zinc-300 dark:text-zinc-600"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      points={report.burndown
                        .map((d, i) => {
                          const maxVal = Math.max(...report.burndown!.map((b) => Math.max(b.remaining, b.ideal)), 1);
                          return `${i * 60 + 30},${200 - (d.ideal / maxVal) * 180}`;
                        })
                        .join(' ')}
                    />
                    {/* Actual line */}
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      className="text-primary-500"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      points={report.burndown
                        .map((d, i) => {
                          const maxVal = Math.max(...report.burndown!.map((b) => Math.max(b.remaining, b.ideal)), 1);
                          return `${i * 60 + 30},${200 - (d.remaining / maxVal) * 180}`;
                        })
                        .join(' ')}
                    />
                  </svg>
                  {/* X-axis labels */}
                  <div className="flex justify-between mt-1 px-2">
                    {report.burndown
                      .filter((_, i) => i === 0 || i === report.burndown!.length - 1 || i % Math.ceil(report.burndown!.length / 5) === 0)
                      .map((d) => (
                        <span key={d.date} className="text-[10px] text-zinc-400">
                          {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-4 h-0.5 bg-primary-500 rounded" /> Actual
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-4 h-0.5 bg-zinc-300 dark:bg-zinc-600 rounded border-dashed" style={{ borderBottom: '2px dashed' }} /> Ideal
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
