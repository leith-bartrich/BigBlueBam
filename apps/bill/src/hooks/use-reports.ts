import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useRevenueSummary(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['reports', 'revenue', dateFrom, dateTo],
    queryFn: () => api.get<{ data: any[] }>('/v1/reports/revenue', { date_from: dateFrom, date_to: dateTo }),
    select: (res) => res.data,
  });
}

export function useOutstanding() {
  return useQuery({
    queryKey: ['reports', 'outstanding'],
    queryFn: () => api.get<{ data: any[] }>('/v1/reports/outstanding'),
    select: (res) => res.data,
  });
}

export function useProfitability() {
  return useQuery({
    queryKey: ['reports', 'profitability'],
    queryFn: () => api.get<{ data: any[] }>('/v1/reports/profitability'),
    select: (res) => res.data,
  });
}

export function useOverdue() {
  return useQuery({
    queryKey: ['reports', 'overdue'],
    queryFn: () => api.get<{ data: any[] }>('/v1/reports/overdue'),
    select: (res) => res.data,
  });
}
