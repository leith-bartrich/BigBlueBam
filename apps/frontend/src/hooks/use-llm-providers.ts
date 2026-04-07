import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface LlmProvider {
  id: string;
  scope: string;
  organization_id: string | null;
  project_id: string | null;
  name: string;
  provider_type: string;
  model_id: string;
  api_endpoint: string | null;
  api_key_hint: string;
  max_tokens: number | null;
  temperature: string | null;
  is_default: boolean;
  enabled: boolean;
  max_requests_per_hour: number | null;
  max_tokens_per_hour: number | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface LlmProviderListResponse {
  data: LlmProvider[];
}

interface LlmProviderResponse {
  data: LlmProvider;
}

interface ResolveResponse {
  data: LlmProvider | null;
  message?: string;
}

interface TestResult {
  data: {
    success: boolean;
    message: string;
    latency_ms?: number;
  };
}

export interface CreateProviderInput {
  scope: string;
  organization_id?: string | null;
  project_id?: string | null;
  name: string;
  provider_type: string;
  model_id: string;
  api_endpoint?: string | null;
  api_key: string;
  max_tokens?: number;
  temperature?: number;
  is_default?: boolean;
  enabled?: boolean;
  max_requests_per_hour?: number;
  max_tokens_per_hour?: number;
}

export interface UpdateProviderInput {
  name?: string;
  provider_type?: string;
  model_id?: string;
  api_endpoint?: string | null;
  api_key?: string;
  max_tokens?: number;
  temperature?: number;
  is_default?: boolean;
  enabled?: boolean;
  max_requests_per_hour?: number;
  max_tokens_per_hour?: number;
}

export function useLlmProviders(projectId?: string) {
  return useQuery({
    queryKey: ['llm-providers', projectId],
    queryFn: () =>
      api.get<LlmProviderListResponse>('/llm-providers', {
        project_id: projectId,
      }),
  });
}

export function useResolvedProvider(projectId?: string) {
  return useQuery({
    queryKey: ['llm-providers', 'resolve', projectId],
    queryFn: () =>
      api.get<ResolveResponse>('/llm-providers/resolve', {
        project_id: projectId,
      }),
  });
}

export function useCreateProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProviderInput) =>
      api.post<LlmProviderResponse>('/llm-providers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
    },
  });
}

export function useUpdateProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProviderInput }) =>
      api.patch<LlmProviderResponse>(`/llm-providers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
    },
  });
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/llm-providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
    },
  });
}

export function useTestProvider() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<TestResult>(`/llm-providers/${id}/test`),
  });
}
