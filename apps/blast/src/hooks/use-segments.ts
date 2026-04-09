import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Segment {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  filter_criteria: {
    conditions: Array<{ field: string; op: string; value: unknown }>;
    match: 'all' | 'any';
  };
  cached_count: number | null;
  cached_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SegmentListResponse {
  data: Segment[];
  total: number;
  limit: number;
  offset: number;
}

interface SegmentResponse {
  data: Segment;
}

export function useSegments(params?: { search?: string }) {
  return useQuery({
    queryKey: ['blast', 'segments', params],
    queryFn: () =>
      api.get<SegmentListResponse>('/v1/segments', {
        search: params?.search,
      }),
    staleTime: 15_000,
  });
}

export function useSegment(id: string | undefined) {
  return useQuery({
    queryKey: ['blast', 'segments', 'detail', id],
    queryFn: () => api.get<SegmentResponse>(`/v1/segments/${id}`),
    enabled: !!id,
  });
}

export function useCreateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      filter_criteria: {
        conditions: Array<{ field: string; op: string; value: unknown }>;
        match: 'all' | 'any';
      };
    }) => api.post<SegmentResponse>('/v1/segments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'segments'] });
    },
  });
}

export function useUpdateSegment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Segment>) =>
      api.patch<SegmentResponse>(`/v1/segments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'segments'] });
    },
  });
}

export function useDeleteSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/segments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'segments'] });
    },
  });
}

export function useRecalculateSegmentCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/v1/segments/${id}/count`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'segments'] });
    },
  });
}
