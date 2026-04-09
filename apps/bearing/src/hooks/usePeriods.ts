import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePeriodStore, type BearingPeriod } from '@/stores/period.store';
import { useEffect } from 'react';

// ── Response types ──

interface ListResponse {
  data: BearingPeriod[];
  meta: { next_cursor: string | null; has_more: boolean };
}

interface SingleResponse {
  data: BearingPeriod;
}

// ── Hooks ──

export function usePeriods() {
  const setPeriods = usePeriodStore((s) => s.setPeriods);

  const query = useQuery({
    queryKey: ['periods', 'list'],
    queryFn: () => api.get<ListResponse>('/periods'),
    staleTime: 30_000,
  });

  // Keep the store in sync with fetched periods
  useEffect(() => {
    if (query.data?.data) {
      setPeriods(query.data.data);
    }
  }, [query.data, setPeriods]);

  return query;
}

export function usePeriod(id: string | undefined) {
  return useQuery({
    queryKey: ['periods', 'detail', id],
    queryFn: () => api.get<SingleResponse>(`/periods/${id}`),
    enabled: !!id,
  });
}

export function useCreatePeriod() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      type: BearingPeriod['type'];
      start_date: string;
      end_date: string;
    }) => api.post<SingleResponse>('/periods', {
      name: data.name,
      period_type: data.type,
      starts_at: data.start_date,
      ends_at: data.end_date,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods'] });
    },
  });
}

export function useUpdatePeriod() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Pick<BearingPeriod, 'name' | 'type' | 'start_date' | 'end_date'>>) =>
      api.patch<SingleResponse>(`/periods/${id}`, {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { period_type: data.type }),
        ...(data.start_date !== undefined && { starts_at: data.start_date }),
        ...(data.end_date !== undefined && { ends_at: data.end_date }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods'] });
    },
  });
}

export function useDeletePeriod() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/periods/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods'] });
    },
  });
}

export function useActivatePeriod() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<SingleResponse>(`/periods/${id}/activate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods'] });
    },
  });
}

export function useCompletePeriod() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<SingleResponse>(`/periods/${id}/complete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods'] });
    },
  });
}
