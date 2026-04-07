import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BriefComment } from '@/hooks/use-documents';

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

export function useComments(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-comments', documentId],
    queryFn: () => api.get<PaginatedResponse<BriefComment>>(`/documents/${documentId}/comments`),
    enabled: !!documentId,
    select: (res) => res.data,
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, body, parentId }: {
      documentId: string;
      body: string;
      parentId?: string;
    }) => api.post<ApiResponse<BriefComment>>(`/documents/${documentId}/comments`, {
      body,
      parent_id: parentId,
    }),
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ['document-comments', variables.documentId] });
    },
  });
}

export function useResolveComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, commentId }: {
      documentId: string;
      commentId: string;
    }) => api.post<ApiResponse<BriefComment>>(`/documents/${documentId}/comments/${commentId}/resolve`),
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ['document-comments', variables.documentId] });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, commentId }: {
      documentId: string;
      commentId: string;
    }) => api.delete(`/documents/${documentId}/comments/${commentId}`),
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ['document-comments', variables.documentId] });
    },
  });
}
