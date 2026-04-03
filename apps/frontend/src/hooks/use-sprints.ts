import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Sprint,
  ApiResponse,
  PaginatedResponse,
  CreateSprintInput,
  UpdateSprintInput,
} from '@bigbluebam/shared';
import { api } from '@/lib/api';

export function useSprints(projectId: string | undefined) {
  return useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => api.get<PaginatedResponse<Sprint>>(`/projects/${projectId}/sprints`),
    enabled: !!projectId,
  });
}

export function useActiveSprint(projectId: string | undefined) {
  return useQuery({
    queryKey: ['sprints', projectId, 'active'],
    queryFn: () => api.get<ApiResponse<Sprint>>(`/projects/${projectId}/sprints/active`),
    enabled: !!projectId,
  });
}

export function useCreateSprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: CreateSprintInput }) =>
      api.post<ApiResponse<Sprint>>(`/projects/${projectId}/sprints`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sprints', variables.projectId] });
    },
  });
}

export function useUpdateSprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, sprintId, data }: { projectId: string; sprintId: string; data: UpdateSprintInput }) =>
      api.patch<ApiResponse<Sprint>>(`/projects/${projectId}/sprints/${sprintId}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sprints', variables.projectId] });
    },
  });
}

export function useStartSprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sprintId }: { sprintId: string; projectId: string }) =>
      api.post<ApiResponse<Sprint>>(`/sprints/${sprintId}/start`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sprints', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}

export function useDeleteSprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, sprintId }: { projectId: string; sprintId: string }) =>
      api.delete(`/projects/${projectId}/sprints/${sprintId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sprints', variables.projectId] });
    },
  });
}
