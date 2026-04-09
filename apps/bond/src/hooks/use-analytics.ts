import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineSummaryStage {
  stage_id: string;
  stage_name: string;
  stage_type: 'active' | 'won' | 'lost';
  deal_count: number;
  total_value: number;
  weighted_value: number;
  color: string | null;
}

export interface PipelineSummary {
  pipeline_id: string;
  pipeline_name: string;
  total_deals: number;
  total_value: number;
  weighted_value: number;
  stages: PipelineSummaryStage[];
}

export interface ConversionRate {
  from_stage: string;
  to_stage: string;
  rate_pct: number;
  deal_count: number;
}

export interface DealVelocity {
  stage_name: string;
  avg_days: number;
  median_days: number;
}

export interface WinLossStats {
  total_won: number;
  total_lost: number;
  won_value: number;
  lost_value: number;
  win_rate_pct: number;
  top_loss_reasons: Array<{ reason: string; count: number }>;
  top_competitors: Array<{ name: string; count: number }>;
}

export interface ForecastBucket {
  period: string;
  deal_count: number;
  total_value: number;
  weighted_value: number;
}

export interface StaleDeal {
  deal_id: string;
  deal_name: string;
  stage_name: string;
  days_in_stage: number;
  rotting_days_threshold: number;
  value: number | null;
  owner_name: string | null;
  company_name: string | null;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function usePipelineSummary(pipelineId?: string) {
  return useQuery({
    queryKey: ['bond', 'analytics', 'pipeline-summary', pipelineId],
    queryFn: () =>
      api.get<{ data: PipelineSummary }>('/analytics/pipeline-summary', {
        pipeline_id: pipelineId,
      }),
    staleTime: 30_000,
  });
}

export function useConversionRates(pipelineId?: string) {
  return useQuery({
    queryKey: ['bond', 'analytics', 'conversion-rates', pipelineId],
    queryFn: () =>
      api.get<{ data: ConversionRate[] }>('/analytics/conversion-rates', {
        pipeline_id: pipelineId,
      }),
    staleTime: 60_000,
  });
}

export function useDealVelocity(pipelineId?: string) {
  return useQuery({
    queryKey: ['bond', 'analytics', 'deal-velocity', pipelineId],
    queryFn: () =>
      api.get<{ data: DealVelocity[] }>('/analytics/deal-velocity', {
        pipeline_id: pipelineId,
      }),
    staleTime: 60_000,
  });
}

export function useWinLossStats(pipelineId?: string) {
  return useQuery({
    queryKey: ['bond', 'analytics', 'win-loss', pipelineId],
    queryFn: () =>
      api.get<{ data: WinLossStats }>('/analytics/win-loss', {
        pipeline_id: pipelineId,
      }),
    staleTime: 60_000,
  });
}

export function useForecast(pipelineId?: string) {
  return useQuery({
    queryKey: ['bond', 'analytics', 'forecast', pipelineId],
    queryFn: () =>
      api.get<{ data: ForecastBucket[] }>('/analytics/forecast', {
        pipeline_id: pipelineId,
      }),
    staleTime: 60_000,
  });
}

export function useStaleDeals(pipelineId?: string) {
  return useQuery({
    queryKey: ['bond', 'analytics', 'stale-deals', pipelineId],
    queryFn: () =>
      api.get<{ data: StaleDeal[] }>('/analytics/stale-deals', {
        pipeline_id: pipelineId,
      }),
    staleTime: 30_000,
  });
}
