import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Template {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  subject_template: string;
  html_body: string;
  json_design: unknown;
  plain_text_body: string | null;
  template_type: string;
  thumbnail_url: string | null;
  version: number;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TemplateListResponse {
  data: Template[];
  total: number;
  limit: number;
  offset: number;
}

interface TemplateResponse {
  data: Template;
}

export function useTemplates(params?: { template_type?: string; search?: string }) {
  return useQuery({
    queryKey: ['blast', 'templates', params],
    queryFn: () =>
      api.get<TemplateListResponse>('/v1/templates', {
        template_type: params?.template_type,
        search: params?.search,
      }),
    staleTime: 15_000,
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['blast', 'templates', 'detail', id],
    queryFn: () => api.get<TemplateResponse>(`/v1/templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      subject_template: string;
      html_body: string;
      description?: string;
      template_type?: string;
      json_design?: unknown;
      plain_text_body?: string;
    }) => api.post<TemplateResponse>('/v1/templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'templates'] });
    },
  });
}

export function useUpdateTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Template>) =>
      api.patch<TemplateResponse>(`/v1/templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'templates'] });
    },
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<TemplateResponse>(`/v1/templates/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'templates'] });
    },
  });
}
