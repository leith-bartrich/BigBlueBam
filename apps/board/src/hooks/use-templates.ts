import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateCategory = 'retro' | 'brainstorm' | 'architecture' | 'planning' | 'strategy' | 'general';

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string | null;
  thumbnail_url: string | null;
  element_count?: number;
  sort_order: number;
  created_at: string;
}

interface TemplateListResponse {
  data: BoardTemplate[];
}

interface InstantiateResponse {
  data: { id: string; name: string };
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const templateKeys = {
  all: ['templates'] as const,
  list: (category?: TemplateCategory) => [...templateKeys.all, 'list', category] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useTemplates(category?: TemplateCategory) {
  return useQuery({
    queryKey: templateKeys.list(category),
    queryFn: () =>
      api.get<TemplateListResponse>('/templates', {
        category: category ?? undefined,
      }),
    staleTime: 120_000,
  });
}

export function useInstantiateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, name, project_id }: { templateId: string; name?: string; project_id?: string }) =>
      api.post<InstantiateResponse>(`/templates/${templateId}/instantiate`, { name, project_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}
