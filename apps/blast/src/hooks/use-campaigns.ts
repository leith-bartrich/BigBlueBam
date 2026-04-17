import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Campaign {
  id: string;
  organization_id: string;
  name: string;
  template_id: string | null;
  subject: string;
  html_body: string;
  plain_text_body: string | null;
  segment_id: string | null;
  recipient_count: number | null;
  from_name: string | null;
  from_email: string | null;
  reply_to_email: string | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
  total_sent: number;
  total_delivered: number;
  total_bounced: number;
  total_opened: number;
  total_clicked: number;
  total_unsubscribed: number;
  total_complained: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CampaignListResponse {
  data: Campaign[];
  total: number;
  limit: number;
  offset: number;
}

interface CampaignResponse {
  data: Campaign;
}

interface AnalyticsResponse {
  data: {
    campaign_id: string;
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_bounced: number;
    total_unsubscribed: number;
    total_complained: number;
    open_rate: number;
    click_rate: number;
    bounce_rate: number;
    unsubscribe_rate: number;
    event_breakdown: Record<string, number>;
    click_urls: Array<{ url: string | null; count: number }>;
    delivery_breakdown: Record<string, number>;
  };
}

export function useCampaigns(params?: { status?: string }) {
  return useQuery({
    queryKey: ['blast', 'campaigns', params],
    queryFn: () =>
      api.get<CampaignListResponse>('/v1/campaigns', {
        status: params?.status,
      }),
    staleTime: 15_000,
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['blast', 'campaigns', 'detail', id],
    queryFn: () => api.get<CampaignResponse>(`/v1/campaigns/${id}`),
    enabled: !!id,
  });
}

export function useCampaignAnalytics(id: string | undefined) {
  return useQuery({
    queryKey: ['blast', 'campaigns', 'analytics', id],
    queryFn: () => api.get<AnalyticsResponse>(`/v1/campaigns/${id}/analytics`),
    enabled: !!id,
  });
}

export interface CampaignRecipient {
  id: string;
  contact_id: string | null;
  to_email: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  bounce_type: string | null;
}

interface RecipientsResponse {
  data: CampaignRecipient[];
  total: number;
  limit: number;
  offset: number;
}

export function useCampaignRecipients(
  id: string | undefined,
  params?: { limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ['blast', 'campaigns', 'recipients', id, params],
    queryFn: () =>
      api.get<RecipientsResponse>(`/v1/campaigns/${id}/recipients`, {
        limit: params?.limit,
        offset: params?.offset,
      }),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      subject: string;
      html_body: string;
      template_id?: string;
      segment_id?: string;
      from_name?: string;
      from_email?: string;
      reply_to_email?: string;
      plain_text_body?: string;
    }) => api.post<CampaignResponse>('/v1/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'campaigns'] });
    },
  });
}

export function useUpdateCampaign(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Campaign>) =>
      api.patch<CampaignResponse>(`/v1/campaigns/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'campaigns'] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'campaigns'] });
    },
  });
}

export function useSendCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/v1/campaigns/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'campaigns'] });
    },
  });
}

export function useScheduleCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduled_at }: { id: string; scheduled_at: string }) =>
      api.post(`/v1/campaigns/${id}/schedule`, { scheduled_at }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'campaigns'] });
    },
  });
}
