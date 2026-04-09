import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Report {
  id: string;
  dashboard_id: string;
  name: string;
  cron_expression: string;
  cron_timezone: string;
  delivery_method: string;
  delivery_target: string;
  export_format: string;
  enabled: boolean;
  last_sent_at: string | null;
  created_at: string;
}

export function useReports() {
  return useQuery({
    queryKey: ['bench', 'reports'],
    queryFn: () => api.get<{ data: Report[] }>('/v1/reports'),
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/v1/reports', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bench', 'reports'] }),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/reports/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bench', 'reports'] }),
  });
}

export function useSendReportNow() {
  return useMutation({
    mutationFn: (id: string) => api.post(`/v1/reports/${id}/send-now`),
  });
}
