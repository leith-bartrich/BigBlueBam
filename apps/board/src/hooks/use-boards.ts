import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useProjectStore } from '@/stores/project.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Board {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  background: string | null;
  locked: boolean;
  visibility: 'private' | 'project' | 'org';
  thumbnail_url: string | null;
  project_id: string | null;
  project_name: string | null;
  creator_name: string | null;
  element_count: number;
  collaborator_count: number;
  starred: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface BoardStats {
  total: number;
  recent: number;
  starred: number;
  archived: number;
}

interface BoardListResponse {
  data: Board[];
  meta: { total: number; has_more: boolean; cursor: string | null };
}

interface BoardResponse {
  data: Board;
}

interface BoardStatsResponse {
  data: BoardStats;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useBoardList(params?: { search?: string; archived?: boolean }) {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  return useQuery({
    queryKey: ['boards', 'list', activeProjectId, params],
    queryFn: () =>
      api.get<BoardListResponse>('/boards', {
        project_id: activeProjectId ?? undefined,
        search: params?.search,
        archived: params?.archived,
      }),
    staleTime: 30_000,
  });
}

export function useBoard(id: string | undefined) {
  return useQuery({
    queryKey: ['boards', 'detail', id],
    queryFn: () => api.get<BoardResponse>(`/boards/${id}`),
    enabled: !!id,
  });
}

export function useBoardStats() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  return useQuery({
    queryKey: ['boards', 'stats', activeProjectId],
    queryFn: () =>
      api.get<BoardStatsResponse>('/boards/stats', {
        project_id: activeProjectId ?? undefined,
      }),
    staleTime: 30_000,
  });
}

export function useRecentBoards() {
  return useQuery({
    queryKey: ['boards', 'recent'],
    queryFn: () => api.get<BoardListResponse>('/boards/recent'),
    staleTime: 30_000,
  });
}

export function useStarredBoards() {
  return useQuery({
    queryKey: ['boards', 'starred'],
    queryFn: () => api.get<BoardListResponse>('/boards/starred'),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      project_id?: string;
      template_id?: string;
      visibility?: Board['visibility'];
      icon?: string | null;
    }) => api.post<BoardResponse>('/boards', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useUpdateBoard(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Pick<Board, 'name' | 'description' | 'icon' | 'background' | 'visibility'>>) =>
      api.patch<BoardResponse>(`/boards/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useArchiveBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/boards/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useRestoreBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/boards/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useDuplicateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<BoardResponse>(`/boards/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useToggleStar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/boards/${id}/star`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useToggleLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/boards/${id}/lock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}
