import { useQuery } from '@tanstack/react-query';
import type { ApiResponse } from '@bigbluebam/shared';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  active_owner_count: number;
  member_count: number;
  [key: string]: unknown;
}

export function useOrgSummary() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery<ApiResponse<OrgSummary>, ApiError>({
    queryKey: ['org', 'summary'],
    queryFn: () => api.get<ApiResponse<OrgSummary>>('/org'),
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      // Don't retry on 4xx — silently bail
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });

  return {
    data: query.data?.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
