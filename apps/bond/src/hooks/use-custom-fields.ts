import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomFieldOption {
  value: string;
  label: string;
}

export interface CustomFieldDefinition {
  id: string;
  organization_id: string;
  entity_type: 'contact' | 'company' | 'deal';
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'url' | 'email' | 'phone' | 'boolean';
  options: CustomFieldOption[] | null;
  required: boolean;
  sort_order: number;
  created_at: string;
}

interface CustomFieldListResponse {
  data: CustomFieldDefinition[];
}

interface CustomFieldResponse {
  data: CustomFieldDefinition;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useCustomFieldDefinitions(entityType?: string) {
  return useQuery({
    queryKey: ['bond', 'custom-field-definitions', entityType],
    queryFn: () =>
      api.get<CustomFieldListResponse>('/custom-field-definitions', {
        entity_type: entityType,
      }),
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      entity_type: 'contact' | 'company' | 'deal';
      field_key: string;
      label: string;
      field_type: string;
      options?: CustomFieldOption[];
      required?: boolean;
      sort_order?: number;
    }) => api.post<CustomFieldResponse>('/custom-field-definitions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'custom-field-definitions'] });
    },
  });
}

export function useUpdateCustomField(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{
      label: string;
      field_type: string;
      options: CustomFieldOption[];
      required: boolean;
      sort_order: number;
    }>) => api.patch<CustomFieldResponse>(`/custom-field-definitions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'custom-field-definitions'] });
    },
  });
}

export function useDeleteCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/custom-field-definitions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bond', 'custom-field-definitions'] });
    },
  });
}
