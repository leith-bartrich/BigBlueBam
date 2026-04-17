import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Company {
  id: string;
  organization_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size_bucket: string | null;
  annual_revenue: number | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  custom_fields: Record<string, unknown>;
  owner_id: string | null;
  owner_name: string | null;
  contact_count: number;
  deal_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CompanyListResponse {
  data: Company[];
  meta: { total: number; has_more: boolean; cursor: string | null };
}

interface CompanyResponse {
  data: Company;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useCompanies(params?: {
  search?: string;
  industry?: string;
  owner_id?: string;
  include_deleted?: boolean;
}) {
  return useQuery({
    queryKey: ['bond', 'companies', params],
    queryFn: () =>
      api.get<CompanyListResponse>('/companies', {
        search: params?.search,
        industry: params?.industry,
        owner_id: params?.owner_id,
        include_deleted: params?.include_deleted ? 'true' : undefined,
      }),
    staleTime: 15_000,
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: ['bond', 'companies', 'detail', id],
    queryFn: () => api.get<CompanyResponse>(`/companies/${id}`),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      domain?: string;
      industry?: string;
      size_bucket?: string;
      phone?: string;
      website?: string;
      owner_id?: string;
    }) => api.post<CompanyResponse>('/companies', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'companies'] });
    },
  });
}

export function useUpdateCompany(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<Company, 'id' | 'organization_id' | 'created_by' | 'created_at' | 'updated_at'>>) =>
      api.patch<CompanyResponse>(`/companies/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'companies'] });
    },
  });
}

export function useRestoreCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/companies/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'companies'] });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'companies'] });
    },
  });
}
