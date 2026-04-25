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

export interface PlatformOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
}

export interface CreateOrgInput {
  name: string;
  plan?: string;
}

export interface UpdateOrgInput {
  name?: string;
  plan?: string;
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

  createOrganization(body: CreateOrgInput): Promise<{ data: PlatformOrg }> {
    return api.post<{ data: PlatformOrg }>('/v1/platform/orgs', body);
  },

  updateOrganization(id: string, body: UpdateOrgInput): Promise<{ data: PlatformOrg }> {
    return api.patch<{ data: PlatformOrg }>(`/v1/platform/orgs/${id}`, body);
  },

  deleteOrganization(id: string): Promise<{ data: { success: true } }> {
    return api.delete<{ data: { success: true } }>(`/v1/platform/orgs/${id}`);
  },
};
