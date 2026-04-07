import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TriggerSource } from '@/hooks/use-automations';

// ─── Types ───

export interface BoltTemplate {
  id: string;
  name: string;
  description: string;
  trigger_source: TriggerSource;
  trigger_event: string;
}

// ─── Response types ───

interface ListResponse {
  data: BoltTemplate[];
  meta: { next_cursor: string | null; has_more: boolean };
}

interface InstantiateResponse {
  data: { automation_id: string };
}

// ─── Hooks ───

export function useTemplates() {
  return useQuery({
    queryKey: ['bolt', 'templates'],
    queryFn: () => api.get<ListResponse>('/templates'),
    staleTime: 60_000,
  });
}

export function useInstantiateTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) =>
      api.post<InstantiateResponse>(`/templates/${templateId}/instantiate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}
