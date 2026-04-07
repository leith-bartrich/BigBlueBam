import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────

export type BeaconStatus = 'Draft' | 'Active' | 'PendingReview' | 'Archived' | 'Retired';
export type BeaconVisibility = 'Public' | 'Organization' | 'Project' | 'Private';

export interface Beacon {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: BeaconStatus;
  visibility: BeaconVisibility;
  project_id: string | null;
  project_name?: string;
  owner_id: string;
  owner_name?: string;
  owner_avatar_url?: string | null;
  tags: string[];
  expires_at: string | null;
  last_verified_at: string | null;
  verification_count: number;
  carry_forward_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface BeaconVersion {
  id: string;
  beacon_id: string;
  version: number;
  title: string;
  summary: string;
  body: string;
  changed_by_name?: string;
  created_at: string;
}

export interface BeaconLink {
  id: string;
  source_id: string;
  target_id: string;
  target_title: string;
  target_slug: string;
  target_status: BeaconStatus;
  link_type: string;
}

export interface BeaconTag {
  id: string;
  name: string;
  beacon_count: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    next_cursor?: string | null;
    has_more?: boolean;
  };
}

interface ApiResponse<T> {
  data: T;
}

// ── Filters ──────────────────────────────────────────────────────────

export interface BeaconListFilters {
  status?: BeaconStatus;
  project_id?: string;
  search?: string;
  tag?: string;
}

// ── Query hooks ──────────────────────────────────────────────────────

export function useBeaconList(filters: BeaconListFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['beacons', filters],
    queryFn: ({ pageParam }) =>
      api.get<PaginatedResponse<Beacon>>('/beacons', {
        ...filters,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.has_more ? lastPage.pagination.next_cursor : undefined,
  });
}

export function useBeacon(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: ['beacons', idOrSlug],
    queryFn: () => api.get<ApiResponse<Beacon>>(`/beacons/${idOrSlug}`),
    enabled: !!idOrSlug,
    select: (res) => res.data,
  });
}

export function useBeaconTags() {
  return useQuery({
    queryKey: ['beacon-tags'],
    queryFn: () => api.get<PaginatedResponse<BeaconTag>>('/tags'),
    select: (res) => res.data,
  });
}

export function useBeaconVersions(beaconId: string | undefined) {
  return useQuery({
    queryKey: ['beacon-versions', beaconId],
    queryFn: () => api.get<PaginatedResponse<BeaconVersion>>(`/beacons/${beaconId}/versions`),
    enabled: !!beaconId,
    select: (res) => res.data,
  });
}

export function useBeaconLinks(beaconId: string | undefined) {
  return useQuery({
    queryKey: ['beacon-links', beaconId],
    queryFn: () => api.get<PaginatedResponse<BeaconLink>>(`/beacons/${beaconId}/links`),
    enabled: !!beaconId,
    select: (res) => res.data,
  });
}

// ── Mutation hooks ───────────────────────────────────────────────────

export function useCreateBeacon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      summary: string;
      body: string;
      project_id?: string;
      tags?: string[];
      visibility?: BeaconVisibility;
      status?: 'Draft' | 'Active';
    }) => api.post<ApiResponse<Beacon>>('/beacons', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beacons'] });
    },
  });
}

export function useUpdateBeacon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: Partial<{
        title: string;
        summary: string;
        body: string;
        tags: string[];
        visibility: BeaconVisibility;
      }>;
    }) => api.patch<ApiResponse<Beacon>>(`/beacons/${id}`, data),
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ['beacons'] });
      qc.invalidateQueries({ queryKey: ['beacons', variables.id] });
      qc.invalidateQueries({ queryKey: ['beacon-versions', variables.id] });
    },
  });
}

export function usePublishBeacon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ApiResponse<Beacon>>(`/beacons/${id}/publish`),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ['beacons'] });
      qc.invalidateQueries({ queryKey: ['beacons', id] });
    },
  });
}

export function useRetireBeacon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/beacons/${id}`),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ['beacons'] });
      qc.invalidateQueries({ queryKey: ['beacons', id] });
    },
  });
}

export function useVerifyBeacon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ApiResponse<Beacon>>(`/beacons/${id}/verify`),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ['beacons'] });
      qc.invalidateQueries({ queryKey: ['beacons', id] });
    },
  });
}

export function useChallengeBeacon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ApiResponse<Beacon>>(`/beacons/${id}/challenge`),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ['beacons'] });
      qc.invalidateQueries({ queryKey: ['beacons', id] });
    },
  });
}

export function useRestoreBeacon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ApiResponse<Beacon>>(`/beacons/${id}/restore`),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ['beacons'] });
      qc.invalidateQueries({ queryKey: ['beacons', id] });
    },
  });
}
