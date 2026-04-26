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
  /** Server-side count of detected integrity issues. Drives the amber
   *  AlertTriangle indicator on the All Boards card grid. The detailed
   *  issue list is fetched via /boards/:id/integrity. */
  integrity_issue_count: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface BoardIntegrityIssue {
  code: 'PROJECT_ORG_MISMATCH' | 'PROJECT_NOT_FOUND' | 'PROJECT_AUTO_DETACHED';
  message: string;
  details: Record<string, unknown>;
  remediations: ('detach' | 'reassign')[];
}

interface BoardIntegrityResponse {
  data: { ok: boolean; issues: BoardIntegrityIssue[] };
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
    // The backend archives via DELETE /boards/:id (soft-delete; sets
    // archived_at). There is no POST /boards/:id/archive — calls to it
    // return 404 silently and the card stays put in the All Boards list,
    // which was the "Archive doesn't do anything" UX bug.
    mutationFn: (id: string) => api.delete<void>(`/boards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    // Hard-delete. Distinct from useArchiveBoard. Used from the Archive
    // page (where boards are already soft-deleted and the operator wants
    // them gone) and as a separate "Delete permanently" option on the
    // active board's "..." menu for power users.
    mutationFn: (id: string) => api.delete<void>(`/boards/${id}/permanent`),
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

export function useBoardIntegrity(id: string | undefined, hint?: number) {
  // Fetched lazily — only when the inline `integrity_issue_count` from the
  // list response (or the explicit `hint` from the canvas page when no
  // list response is in cache) indicates there's something to fix. Saves
  // a round-trip on every healthy board.
  return useQuery({
    queryKey: ['boards', 'integrity', id],
    queryFn: () => api.get<BoardIntegrityResponse>(`/boards/${id}/integrity`),
    enabled: !!id && (hint === undefined || hint > 0),
    staleTime: 60_000,
  });
}

export function useRemediateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: {
      id: string;
      action: { action: 'detach' } | { action: 'reassign'; project_id: string };
    }) =>
      api.post<{ data: { id: string; project_id: string | null } }>(
        `/boards/${args.id}/remediate`,
        args.action,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}
