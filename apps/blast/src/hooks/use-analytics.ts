import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface OverviewResponse {
  data: {
    total_campaigns: number;
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_bounced: number;
    avg_open_rate: number;
    avg_click_rate: number;
    avg_bounce_rate: number;
    total_unsubscribed: number;
  };
}

interface TrendRow {
  period: string;
  campaigns: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  open_rate: number;
  click_rate: number;
}

interface TrendResponse {
  data: TrendRow[];
}

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ['blast', 'analytics', 'overview'],
    queryFn: () => api.get<OverviewResponse>('/v1/analytics/overview'),
    staleTime: 30_000,
  });
}

export function useEngagementTrend(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
  return useQuery({
    queryKey: ['blast', 'analytics', 'trend', period],
    queryFn: () => api.get<TrendResponse>('/v1/analytics/engagement-trend', { period }),
    staleTime: 30_000,
  });
}
