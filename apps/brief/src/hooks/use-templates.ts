import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BriefTemplate } from '@/hooks/use-documents';

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    next_cursor?: string | null;
    has_more?: boolean;
  };
}

interface ApiResponse<T> {
  data: T;
}

export function useTemplates() {
  return useQuery({
    queryKey: ['document-templates'],
    queryFn: () => api.get<PaginatedResponse<BriefTemplate>>('/templates'),
    select: (res) => res.data,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      icon_emoji?: string;
      category?: string;
      body_markdown: string;
    }) => api.post<ApiResponse<BriefTemplate>>('/templates', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-templates'] });
    },
  });
}
