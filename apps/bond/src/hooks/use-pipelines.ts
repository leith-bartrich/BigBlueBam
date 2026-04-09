import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  sort_order: number;
  stage_type: 'active' | 'won' | 'lost';
  probability_pct: number;
  rotting_days: number | null;
  color: string | null;
  created_at: string;
}

export interface Pipeline {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  currency: string;
  stages: PipelineStage[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface PipelineListResponse {
  data: Pipeline[];
}

interface PipelineResponse {
  data: Pipeline;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function usePipelines() {
  return useQuery({
    queryKey: ['bond', 'pipelines'],
    queryFn: () => api.get<PipelineListResponse>('/pipelines'),
    staleTime: 60_000,
  });
}

export function usePipeline(id: string | null | undefined) {
  return useQuery({
    queryKey: ['bond', 'pipelines', id],
    queryFn: () => api.get<PipelineResponse>(`/pipelines/${id}`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      currency?: string;
      stages?: Array<{ name: string; stage_type: 'active' | 'won' | 'lost'; probability_pct?: number; color?: string }>;
    }) => api.post<PipelineResponse>('/pipelines', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'pipelines'] });
    },
  });
}

export function useUpdatePipeline(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Pick<Pipeline, 'name' | 'description' | 'currency'>>) =>
      api.patch<PipelineResponse>(`/pipelines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'pipelines'] });
    },
  });
}

export function useReorderStages(pipelineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stageIds: string[]) =>
      api.post<void>(`/pipelines/${pipelineId}/stages/reorder`, { stage_ids: stageIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'pipelines'] });
    },
  });
}

export function useCreateStage(pipelineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      stage_type?: 'active' | 'won' | 'lost';
      probability_pct?: number;
      rotting_days?: number;
      color?: string;
    }) => api.post<{ data: PipelineStage }>(`/pipelines/${pipelineId}/stages`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'pipelines'] });
    },
  });
}

export function useUpdateStage(pipelineId: string, stageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Pick<PipelineStage, 'name' | 'probability_pct' | 'rotting_days' | 'color' | 'stage_type'>>) =>
      api.patch<{ data: PipelineStage }>(`/pipelines/${pipelineId}/stages/${stageId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'pipelines'] });
    },
  });
}

export function useDeleteStage(pipelineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stageId: string) =>
      api.delete(`/pipelines/${pipelineId}/stages/${stageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'pipelines'] });
    },
  });
}
