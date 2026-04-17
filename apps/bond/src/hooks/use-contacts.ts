import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Contact {
  id: string;
  organization_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  avatar_url: string | null;
  lifecycle_stage: string;
  lead_source: string | null;
  lead_score: number;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  custom_fields: Record<string, unknown>;
  owner_id: string | null;
  owner_name: string | null;
  last_contacted_at: string | null;
  company_name: string | null;
  company_id: string | null;
  deal_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ContactListResponse {
  data: Contact[];
  meta: { total: number; has_more: boolean; cursor: string | null };
}

interface ContactResponse {
  data: Contact;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function contactDisplayName(c: Contact | null | undefined): string {
  if (!c) return 'Unknown';
  const parts = [c.first_name, c.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : c.email ?? 'Unnamed';
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useContacts(params?: {
  search?: string;
  lifecycle_stage?: string;
  owner_id?: string;
  company_id?: string;
  include_deleted?: boolean;
}) {
  return useQuery({
    queryKey: ['bond', 'contacts', params],
    queryFn: () =>
      api.get<ContactListResponse>('/contacts', {
        search: params?.search,
        lifecycle_stage: params?.lifecycle_stage,
        owner_id: params?.owner_id,
        company_id: params?.company_id,
        include_deleted: params?.include_deleted ? 'true' : undefined,
      }),
    staleTime: 15_000,
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ['bond', 'contacts', 'detail', id],
    queryFn: () => api.get<ContactResponse>(`/contacts/${id}`),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      title?: string;
      lifecycle_stage?: string;
      lead_source?: string;
      company_id?: string;
      owner_id?: string;
    }) => api.post<ContactResponse>('/contacts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'contacts'] });
    },
  });
}

export function useUpdateContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<Contact, 'id' | 'organization_id' | 'created_by' | 'created_at' | 'updated_at'>>) =>
      api.patch<ContactResponse>(`/contacts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'contacts'] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'contacts'] });
    },
  });
}

export function useRestoreContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/contacts/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'contacts'] });
    },
  });
}

export function useMergeContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, sourceId }: { targetId: string; sourceId: string }) =>
      api.post<ContactResponse>(`/contacts/${targetId}/merge`, { source_id: sourceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'contacts'] });
    },
  });
}
