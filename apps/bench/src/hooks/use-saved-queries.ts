import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SavedQuery {
  id: string;
  name: string;
  description: string | null;
  data_source: string;
  entity: string;
  query_config: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SavedQueryListResponse {
  data: SavedQuery[];
}

interface SavedQueryResponse {
  data: SavedQuery;
}

export function useSavedQueries() {
  return useQuery({
    queryKey: ['bench', 'saved-queries'],
    queryFn: () => api.get<SavedQueryListResponse>('/v1/saved-queries'),
  });
}

export function useSavedQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['bench', 'saved-queries', id],
    queryFn: () => api.get<SavedQueryResponse>(`/v1/saved-queries/${id}`),
    enabled: !!id,
  });
}

export function useCreateSavedQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      data_source: string;
      entity: string;
      query_config: Record<string, unknown>;
    }) => api.post<SavedQueryResponse>('/v1/saved-queries', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bench', 'saved-queries'] }),
  });
}

export function useUpdateSavedQuery(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name?: string;
      description?: string;
      data_source?: string;
      entity?: string;
      query_config?: Record<string, unknown>;
    }) => api.patch<SavedQueryResponse>(`/v1/saved-queries/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bench', 'saved-queries'] });
      qc.invalidateQueries({ queryKey: ['bench', 'saved-queries', id] });
    },
  });
}

export function useDeleteSavedQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/saved-queries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bench', 'saved-queries'] }),
  });
}
