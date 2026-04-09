import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoardVersion {
  id: string;
  board_id: string;
  name: string;
  description: string | null;
  snapshot_url: string | null;
  element_count: number;
  created_by: string;
  creator_name: string;
  created_at: string;
}

interface VersionsResponse {
  data: BoardVersion[];
}

interface VersionResponse {
  data: BoardVersion;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useVersions(boardId: string | undefined) {
  return useQuery({
    queryKey: ['boards', boardId, 'versions'],
    queryFn: () => api.get<VersionsResponse>(`/boards/${boardId}/versions`),
    enabled: !!boardId,
  });
}

export function useCreateVersion(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post<VersionResponse>(`/boards/${boardId}/versions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards', boardId, 'versions'] });
    },
  });
}

export function useRestoreVersion(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (versionId: string) =>
      api.post<void>(`/boards/${boardId}/versions/${versionId}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards', boardId] });
    },
  });
}
