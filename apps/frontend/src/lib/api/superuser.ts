import type {
  SuperuserOrgListResponse,
  SuperuserOrgDetailResponse,
  SuperuserOverviewResponse,
} from '@bigbluebam/shared';
import { api } from '@/lib/api';

export interface ListOrganizationsParams {
  cursor?: string | null;
  limit?: number;
  search?: string;
}

export const superuserApi = {
  listOrganizations(params: ListOrganizationsParams = {}): Promise<SuperuserOrgListResponse> {
    return api.get<SuperuserOrgListResponse>('/superuser/organizations', {
      cursor: params.cursor ?? undefined,
      limit: params.limit,
      search: params.search,
    });
  },

  getOrganization(id: string): Promise<SuperuserOrgDetailResponse> {
    return api.get<SuperuserOrgDetailResponse>(`/superuser/organizations/${id}`);
  },

  getOverview(): Promise<SuperuserOverviewResponse> {
    return api.get<SuperuserOverviewResponse>('/superuser/overview');
  },

  switchContext(orgId: string): Promise<void> {
    return api.post<void>('/superuser/context/switch', { org_id: orgId });
  },

  clearContext(): Promise<void> {
    return api.post<void>('/superuser/context/clear');
  },
};
