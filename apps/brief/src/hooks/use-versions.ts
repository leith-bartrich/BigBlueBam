import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BriefVersion, BriefDocument } from '@/hooks/use-documents';

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

export function useVersions(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-versions', documentId],
    queryFn: () => api.get<PaginatedResponse<BriefVersion>>(`/documents/${documentId}/versions`),
    enabled: !!documentId,
    select: (res) => res.data,
  });
}

export function useCreateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, label }: {
      documentId: string;
      label?: string;
    }) => api.post<ApiResponse<BriefVersion>>(`/documents/${documentId}/versions`, { label }),
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ['document-versions', variables.documentId] });
      qc.invalidateQueries({ queryKey: ['documents', variables.documentId] });
    },
  });
}

export function useRestoreVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, versionId }: {
      documentId: string;
      versionId: string;
    }) => api.post<ApiResponse<BriefDocument>>(`/documents/${documentId}/versions/${versionId}/restore`),
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ['document-versions', variables.documentId] });
      qc.invalidateQueries({ queryKey: ['documents', variables.documentId] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
