import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoringRule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  score_delta: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface ScoringRuleListResponse {
  data: ScoringRule[];
}

interface ScoringRuleResponse {
  data: ScoringRule;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useScoringRules() {
  return useQuery({
    queryKey: ['bond', 'scoring-rules'],
    queryFn: () => api.get<ScoringRuleListResponse>('/scoring-rules'),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateScoringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      condition_field: string;
      condition_operator: string;
      condition_value: string;
      score_delta: number;
      enabled?: boolean;
    }) => api.post<ScoringRuleResponse>('/scoring-rules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'scoring-rules'] });
    },
  });
}

export function useUpdateScoringRule(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{
      name: string;
      description: string;
      condition_field: string;
      condition_operator: string;
      condition_value: string;
      score_delta: number;
      enabled: boolean;
    }>) => api.patch<ScoringRuleResponse>(`/scoring-rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'scoring-rules'] });
    },
  });
}

export function useDeleteScoringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/scoring-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'scoring-rules'] });
    },
  });
}

export function useRecalculateScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) =>
      api.post<{ data: { contact_id: string; score: number; matched_rules: Array<{ rule_id: string; name: string; delta: number }> } }>(
        '/scoring/recalculate',
        { contact_id: contactId },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'contacts'] });
    },
  });
}
