import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TriggerSource } from '@/hooks/use-automations';

// ─── Types ───

export interface EventDef {
  source: TriggerSource;
  event_type: string;
  description: string;
  payload_fields: { name: string; type: string; description: string }[];
}

export interface ActionDef {
  mcp_tool: string;
  description: string;
  parameters: { name: string; type: string; description: string; required: boolean }[];
}

// ─── Response types ───

interface EventCatalogResponse {
  data: EventDef[];
}

interface ActionCatalogResponse {
  data: ActionDef[];
}

// ─── Hooks ───

export function useEventCatalog() {
  return useQuery({
    queryKey: ['bolt', 'event-catalog'],
    queryFn: () => api.get<EventCatalogResponse>('/event-catalog'),
    staleTime: 5 * 60_000, // 5 minutes — catalog changes rarely
  });
}

export function useEventsBySource(source: TriggerSource | undefined) {
  const { data, ...rest } = useEventCatalog();

  const events = source
    ? (data?.data ?? []).filter((e) => e.source === source)
    : (data?.data ?? []);

  return { ...rest, data: events };
}

export function useActionCatalog() {
  return useQuery({
    queryKey: ['bolt', 'action-catalog'],
    queryFn: () => api.get<ActionCatalogResponse>('/action-catalog'),
    staleTime: 5 * 60_000,
  });
}
