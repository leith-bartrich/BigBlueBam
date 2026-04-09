import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Deal {
  id: string;
  organization_id: string;
  pipeline_id: string;
  stage_id: string;
  name: string;
  description: string | null;
  value: number | null;
  currency: string;
  expected_close_date: string | null;
  probability_pct: number | null;
  weighted_value: number | null;
  closed_at: string | null;
  close_reason: string | null;
  lost_to_competitor: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_avatar_url: string | null;
  company_id: string | null;
  company_name: string | null;
  custom_fields: Record<string, unknown>;
  stage_entered_at: string;
  last_activity_at: string | null;
  contact_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DealStageHistory {
  id: string;
  deal_id: string;
  from_stage_id: string | null;
  from_stage_name: string | null;
  to_stage_id: string;
  to_stage_name: string;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
  duration_in_stage: string | null;
}

interface DealListResponse {
  data: Deal[];
  meta: { total: number; has_more: boolean; cursor: string | null };
}

interface DealResponse {
  data: Deal;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useDeals(params?: {
  pipeline_id?: string;
  stage_id?: string;
  owner_id?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['bond', 'deals', params],
    queryFn: () =>
      api.get<DealListResponse>('/deals', {
        pipeline_id: params?.pipeline_id,
        stage_id: params?.stage_id,
        owner_id: params?.owner_id,
        search: params?.search,
      }),
    staleTime: 15_000,
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: ['bond', 'deals', 'detail', id],
    queryFn: () => api.get<DealResponse>(`/deals/${id}`),
    enabled: !!id,
  });
}

export function useDealStageHistory(dealId: string | undefined) {
  return useQuery({
    queryKey: ['bond', 'deals', dealId, 'stage-history'],
    queryFn: () => api.get<{ data: DealStageHistory[] }>(`/deals/${dealId}/stage-history`),
    enabled: !!dealId,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      pipeline_id: string;
      stage_id: string;
      value?: number;
      currency?: string;
      expected_close_date?: string;
      owner_id?: string;
      company_id?: string;
      description?: string;
    }) => api.post<DealResponse>('/deals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'deals'] });
    },
  });
}

export function useUpdateDeal(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Pick<Deal, 'name' | 'description' | 'value' | 'currency' | 'expected_close_date' | 'owner_id' | 'company_id' | 'custom_fields'>>) =>
      api.patch<DealResponse>(`/deals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'deals'] });
    },
  });
}

export function useMoveDealStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) =>
      api.patch<DealResponse>(`/deals/${dealId}/stage`, { stage_id: stageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'deals'] });
    },
  });
}

export function useCloseDealWon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dealId: string) =>
      api.post<DealResponse>(`/deals/${dealId}/won`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'deals'] });
    },
  });
}

export function useCloseDealLost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, close_reason, lost_to_competitor }: {
      dealId: string;
      close_reason?: string;
      lost_to_competitor?: string;
    }) => api.post<DealResponse>(`/deals/${dealId}/lost`, { close_reason, lost_to_competitor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'deals'] });
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/deals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'deals'] });
    },
  });
}

export function useAddDealContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, contactId, role }: { dealId: string; contactId: string; role?: string }) =>
      api.post<void>(`/deals/${dealId}/contacts`, { contact_id: contactId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'deals'] });
    },
  });
}

export function useRemoveDealContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, contactId }: { dealId: string; contactId: string }) =>
      api.delete(`/deals/${dealId}/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'deals'] });
    },
  });
}
