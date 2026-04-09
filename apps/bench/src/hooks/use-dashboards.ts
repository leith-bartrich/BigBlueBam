import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  is_default: boolean;
  auto_refresh_seconds: number | null;
  layout: unknown[];
  widget_count?: number;
  widgets?: Widget[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Widget {
  id: string;
  dashboard_id: string;
  name: string;
  widget_type: string;
  data_source: string;
  entity: string;
  query_config: Record<string, unknown>;
  viz_config: Record<string, unknown>;
  kpi_config: Record<string, unknown> | null;
  cache_ttl_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export function useDashboards(params?: { project_id?: string; visibility?: string }) {
  return useQuery({
    queryKey: ['bench', 'dashboards', params],
    queryFn: () => api.get<{ data: Dashboard[] }>('/v1/dashboards', params),
  });
}

export function useDashboard(id: string | undefined) {
  return useQuery({
    queryKey: ['bench', 'dashboards', id],
    queryFn: () => api.get<{ data: Dashboard }>(`/v1/dashboards/${id}`),
    enabled: !!id,
  });
}

export function useCreateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Dashboard>) => api.post<{ data: Dashboard }>('/v1/dashboards', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bench', 'dashboards'] }),
  });
}

export function useUpdateDashboard(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Dashboard>) => api.patch<{ data: Dashboard }>(`/v1/dashboards/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bench', 'dashboards'] });
      qc.invalidateQueries({ queryKey: ['bench', 'dashboards', id] });
    },
  });
}

export function useDeleteDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/dashboards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bench', 'dashboards'] }),
  });
}

export function useDuplicateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ data: Dashboard }>(`/v1/dashboards/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bench', 'dashboards'] }),
  });
}
