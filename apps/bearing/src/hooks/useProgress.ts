import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePeriodStore } from '@/stores/period.store';
import { useAuthStore } from '@/stores/auth.store';
import type { BearingGoal } from '@/hooks/useGoals';

// ── Types ──

export interface PeriodReport {
  period_id: string;
  period_name: string;
  total_goals: number;
  avg_progress: number;
  on_track: number;
  at_risk: number;
  behind: number;
  achieved: number;
  missed: number;
  progress_over_time: Array<{
    date: string;
    actual: number;
    expected: number;
  }>;
}

// ── Response types ──

interface GoalsListResponse {
  data: BearingGoal[];
  meta: { next_cursor: string | null; has_more: boolean; total?: number };
}

interface ReportResponse {
  data: PeriodReport;
}

// ── Hooks ──

export function useAtRiskGoals() {
  const periodId = usePeriodStore((s) => s.selectedPeriodId);

  return useQuery({
    queryKey: ['goals', 'at-risk', periodId],
    queryFn: () =>
      api.get<GoalsListResponse>('/goals', {
        period_id: periodId ?? undefined,
        'filter[status]': 'at_risk,behind',
        sort: 'progress',
      }),
    staleTime: 15_000,
    enabled: !!periodId,
  });
}

export function useMyGoals() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['goals', 'my-goals', userId],
    queryFn: () =>
      api.get<GoalsListResponse>('/goals', {
        'filter[owner_id]': userId ?? undefined,
      }),
    staleTime: 15_000,
    enabled: !!userId,
  });
}

export function usePeriodReport(periodId?: string) {
  const storePeriodId = usePeriodStore((s) => s.selectedPeriodId);
  const id = periodId ?? storePeriodId;

  return useQuery({
    queryKey: ['periods', 'report', id],
    queryFn: () => api.get<ReportResponse>(`/periods/${id}/report`),
    staleTime: 30_000,
    enabled: !!id,
  });
}
