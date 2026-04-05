import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, TrendingDown, BarChart3, Layers } from 'lucide-react';
import type { Sprint, PaginatedResponse } from '@bigbluebam/shared';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/common/button';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useProject } from '@/hooks/use-projects';
import {
  BurndownChart,
  type BurndownPoint,
} from '@/components/reports/burndown-chart';
import {
  VelocityChart,
  type VelocityPoint,
} from '@/components/reports/velocity-chart';
import {
  CfdChart,
  type CfdPhase,
  type CfdDay,
} from '@/components/reports/cfd-chart';

interface ProjectReportsPageProps {
  projectId: string;
  onNavigate: (path: string) => void;
}

interface BurndownResponse {
  sprint: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    total_points: number;
  };
  days: BurndownPoint[];
}

interface VelocityResponse {
  sprints: VelocityPoint[];
}

interface CfdResponse {
  phases: CfdPhase[];
  days: CfdDay[];
}

export function ProjectReportsPage({ projectId, onNavigate }: ProjectReportsPageProps) {
  const { data: projectRes } = useProject(projectId);
  const project = projectRes?.data;

  const { data: sprintsRes, isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () =>
      api.get<PaginatedResponse<Sprint>>(`/projects/${projectId}/sprints`),
    enabled: !!projectId,
  });
  const sprints = sprintsRes?.data ?? [];

  // Default the selector to the active sprint, falling back to the most
  // recently ended one so the charts have something to show on first load.
  const defaultSprintId = useMemo(() => {
    if (sprints.length === 0) return '';
    const active = sprints.find((s) => s.status === 'active');
    if (active) return active.id;
    const sortedByEnd = [...sprints].sort((a, b) => {
      const ae = a.end_date ?? '';
      const be = b.end_date ?? '';
      return be.localeCompare(ae);
    });
    return sortedByEnd[0]?.id ?? '';
  }, [sprints]);

  const [sprintId, setSprintId] = useState<string>('');

  useEffect(() => {
    if (!sprintId && defaultSprintId) {
      setSprintId(defaultSprintId);
    }
  }, [defaultSprintId, sprintId]);

  const { data: burndownRes, isLoading: burndownLoading } = useQuery({
    queryKey: ['project-reports-burndown', projectId, sprintId],
    queryFn: () =>
      api.get<{ data: BurndownResponse | null }>(
        `/projects/${projectId}/reports/burndown`,
        { sprint_id: sprintId },
      ),
    enabled: !!projectId && !!sprintId,
  });
  const burndown = burndownRes?.data ?? null;

  const { data: velocityRes, isLoading: velocityLoading } = useQuery({
    queryKey: ['project-reports-velocity', projectId],
    queryFn: () =>
      api.get<{ data: VelocityResponse }>(
        `/projects/${projectId}/reports/velocity`,
        { limit: 10 },
      ),
    enabled: !!projectId,
  });
  const velocity = velocityRes?.data.sprints ?? [];

  const { data: cfdRes, isLoading: cfdLoading } = useQuery({
    queryKey: ['project-reports-cfd', projectId, sprintId],
    queryFn: () =>
      api.get<{ data: CfdResponse }>(`/projects/${projectId}/reports/cfd`, {
        ...(sprintId ? { sprint_id: sprintId } : { days: 30 }),
      }),
    enabled: !!projectId,
  });
  const cfd = cfdRes?.data ?? null;

  const selectedSprint = sprints.find((s) => s.id === sprintId) ?? null;

  return (
    <AppLayout
      currentProjectId={projectId}
      breadcrumbs={[
        { label: 'Projects', href: '/' },
        { label: project?.name ?? 'Loading...', href: `/projects/${projectId}/board` },
        { label: 'Reports' },
      ]}
      onNavigate={onNavigate}
      onCreateProject={() => onNavigate('/')}
    >
      <div className="max-w-5xl mx-auto p-6 space-y-6">
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
              {project?.name ?? 'Project'} Reports
            </h1>
          </div>
        </div>

        {/* Sprint selector */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900 flex items-center gap-4">
          <label
            htmlFor="reports-sprint-select"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Sprint
          </label>
          <select
            id="reports-sprint-select"
            value={sprintId}
            onChange={(e) => setSprintId(e.target.value)}
            disabled={sprintsLoading || sprints.length === 0}
            className="flex-1 max-w-md rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
          >
            {sprints.length === 0 && <option value="">No sprints yet</option>}
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>
          {selectedSprint && selectedSprint.start_date && selectedSprint.end_date && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatDate(selectedSprint.start_date)} – {formatDate(selectedSprint.end_date)}
            </span>
          )}
        </div>

        {/* Burndown */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4" />
              Burndown
            </h2>
            {burndown && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Total: <span className="font-medium text-zinc-700 dark:text-zinc-300">{burndown.sprint.total_points}</span> pts
              </span>
            )}
          </div>
          {burndownLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
            </div>
          ) : (
            <BurndownChart data={burndown?.days ?? []} />
          )}
        </div>

        {/* Velocity */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Velocity
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Last {velocity.length} completed {velocity.length === 1 ? 'sprint' : 'sprints'}
            </span>
          </div>
          {velocityLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
            </div>
          ) : (
            <VelocityChart data={velocity} />
          )}
        </div>

        {/* CFD */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              Cumulative Flow
            </h2>
          </div>
          {cfdLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
            </div>
          ) : (
            <CfdChart phases={cfd?.phases ?? []} days={cfd?.days ?? []} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
