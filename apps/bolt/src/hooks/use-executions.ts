import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ExecutionStatus } from '@/hooks/use-automations';
import { useProjectStore } from '@/stores/project.store';

// ─── Types ───

export interface BoltExecution {
  id: string;
  automation_id: string;
  automation_name: string;
  status: ExecutionStatus;
  trigger_event: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  conditions_met: boolean;
  error_message: string | null;
  error_step: number | null;
}

export interface BoltExecutionStep {
  id: string;
  step_index: number;
  mcp_tool: string;
  parameters_resolved: Record<string, unknown>;
  status: 'success' | 'failed' | 'skipped';
  response: unknown;
  error_message: string | null;
  duration_ms: number | null;
}

export interface BoltExecutionDetail extends BoltExecution {
  steps: BoltExecutionStep[];
  condition_log: unknown;
}

// ─── Response types ───

interface ListResponse {
  data: BoltExecution[];
  meta: { next_cursor: string | null; has_more: boolean };
}

interface DetailResponse {
  data: BoltExecutionDetail;
}

// ─── Hooks ───

export function useExecutions(automationId: string | undefined, filters?: { status?: ExecutionStatus; cursor?: string }) {
  return useQuery({
    queryKey: ['executions', 'by-automation', automationId, filters],
    queryFn: () =>
      api.get<ListResponse>(`/automations/${automationId}/executions`, {
        'filter[status]': filters?.status,
        cursor: filters?.cursor,
      }),
    enabled: !!automationId,
  });
}

export function useExecution(id: string | undefined) {
  return useQuery({
    queryKey: ['executions', 'detail', id],
    queryFn: () => api.get<DetailResponse>(`/executions/${id}`),
    enabled: !!id,
  });
}

export function useOrgExecutions(filters?: { status?: ExecutionStatus; cursor?: string }) {
  const projectId = useProjectStore((s) => s.activeProjectId);

  return useQuery({
    queryKey: ['executions', 'org', projectId, filters],
    queryFn: () =>
      api.get<ListResponse>('/executions', {
        project_id: projectId ?? undefined,
        'filter[status]': filters?.status,
        cursor: filters?.cursor,
      }),
    staleTime: 10_000,
  });
}

export function useRetryExecution() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (executionId: string) =>
      api.post<{ data: { execution_id: string } }>(`/executions/${executionId}/retry`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['executions'] });
    },
  });
}
