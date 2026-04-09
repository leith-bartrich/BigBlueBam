import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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

interface WidgetQueryResult {
  rows: Record<string, unknown>[];
  sql: string;
  duration_ms: number;
}

export function useWidget(widgetId: string | undefined) {
  return useQuery({
    queryKey: ['bench', 'widget', widgetId],
    queryFn: () => api.get<{ data: Widget }>(`/v1/widgets/${widgetId}`),
    enabled: !!widgetId,
  });
}

export function useWidgetQuery(widgetId: string | undefined) {
  return useQuery({
    queryKey: ['bench', 'widget-query', widgetId],
    queryFn: () => api.post<{ data: WidgetQueryResult }>(`/v1/widgets/${widgetId}/query`),
    enabled: !!widgetId,
    staleTime: 60_000,
  });
}

export function useCreateWidget(dashboardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post(`/v1/dashboards/${dashboardId}/widgets`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bench', 'dashboards', dashboardId] });
    },
  });
}

export function useUpdateWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.patch(`/v1/widgets/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bench'] });
    },
  });
}

export function useDeleteWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/widgets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bench'] });
    },
  });
}

export function useRefreshWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ data: WidgetQueryResult }>(`/v1/widgets/${id}/refresh`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['bench', 'widget-query', id] });
    },
  });
}
