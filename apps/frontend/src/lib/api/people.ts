import { api } from '@/lib/api';

// --- Types ---

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';
export type ProjectMemberRole = 'admin' | 'member' | 'viewer';

export interface PersonListItem {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: MemberRole | string;
  is_active: boolean;
  created_at: string;
  last_seen_at: string | null;
}

export interface PersonProjectEntry {
  project_id: string;
  name: string;
  role: ProjectMemberRole | string;
  joined_at: string;
}

export interface PersonDisabledBy {
  id: string;
  email: string;
  display_name: string;
}

export interface PersonDetail {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string | null;
  role: MemberRole | string;
  is_active: boolean;
  disabled_at: string | null;
  disabled_by: PersonDisabledBy | null;
  joined_at: string;
  is_default_org: boolean;
  created_at: string;
  last_seen_at: string | null;
  projects: PersonProjectEntry[];
}

export interface PersonProjectMembership {
  project_id: string;
  project_name: string;
  project_slug: string;
  role: ProjectMemberRole | string;
  joined_at: string;
  is_archived: boolean;
}

export interface ActiveStatusResult {
  user_id: string;
  is_active: boolean;
  disabled_at: string | null;
  last_owner_remaining: boolean;
}

export interface TransferOwnershipResult {
  previous_owner_id: string;
  new_owner_id: string;
  org_id: string;
}

export interface AddProjectsResult {
  added: string[];
  skipped: string[];
}

export interface UpdateProfileBody {
  display_name?: string;
  timezone?: string;
}

export interface AssignProjectsBody {
  assignments: { project_id: string; role: ProjectMemberRole }[];
}

// --- API wrapper ---

export const peopleApi = {
  listMembers(): Promise<{ data: PersonListItem[] }> {
    return api.get<{ data: PersonListItem[] }>('/org/members');
  },

  getMember(userId: string): Promise<{ data: PersonDetail }> {
    return api.get<{ data: PersonDetail }>(`/org/members/${userId}`);
  },

  updateProfile(userId: string, body: UpdateProfileBody): Promise<{ data: PersonDetail }> {
    return api.patch<{ data: PersonDetail }>(`/org/members/${userId}/profile`, body);
  },

  setActive(userId: string, isActive: boolean): Promise<{ data: ActiveStatusResult }> {
    return api.patch<{ data: ActiveStatusResult }>(`/org/members/${userId}/active`, {
      is_active: isActive,
    });
  },

  transferOwnership(userId: string): Promise<{ data: TransferOwnershipResult }> {
    return api.post<{ data: TransferOwnershipResult }>(
      `/org/members/${userId}/transfer-ownership`,
    );
  },

  listMemberProjects(userId: string): Promise<{ data: PersonProjectMembership[] }> {
    return api.get<{ data: PersonProjectMembership[] }>(`/org/members/${userId}/projects`);
  },

  addMemberToProjects(userId: string, body: AssignProjectsBody): Promise<{ data: AddProjectsResult }> {
    return api.post<{ data: AddProjectsResult }>(`/org/members/${userId}/projects`, body);
  },

  updateMemberProjectRole(
    userId: string,
    projectId: string,
    role: ProjectMemberRole,
  ): Promise<{ data: PersonProjectMembership }> {
    return api.patch<{ data: PersonProjectMembership }>(
      `/org/members/${userId}/projects/${projectId}`,
      { role },
    );
  },

  removeMemberFromProject(userId: string, projectId: string): Promise<{ data: { removed: true } }> {
    return api.delete<{ data: { removed: true } }>(`/org/members/${userId}/projects/${projectId}`);
  },

  // Reused existing endpoints
  updateRole(userId: string, role: string): Promise<{ data: PersonListItem }> {
    return api.patch<{ data: PersonListItem }>(`/org/members/${userId}`, { role });
  },

  removeMember(userId: string): Promise<void> {
    return api.delete<void>(`/org/members/${userId}`);
  },

  inviteMember(body: {
    email: string;
    display_name?: string;
    role: string;
  }): Promise<{ data: PersonListItem & { was_existing: boolean } }> {
    return api.post<{ data: PersonListItem & { was_existing: boolean } }>(
      '/org/members/invite',
      body,
    );
  },

  resetPassword(
    userId: string,
    password?: string,
  ): Promise<{ data: { user_id: string; email: string; password: string; generated: boolean } }> {
    return api.post<{ data: { user_id: string; email: string; password: string; generated: boolean } }>(
      `/org/members/${userId}/reset-password`,
      password ? { password } : {},
    );
  },
};

// --- Rank helpers (mirrors backend) ---

export const ROLE_HIERARCHY: readonly string[] = ['guest', 'viewer', 'member', 'admin', 'owner'];

export function roleLevel(role: string | null | undefined): number {
  return ROLE_HIERARCHY.indexOf(role ?? '');
}

/**
 * Strict rank: caller must OUTRANK target (peer disallowed), unless caller is SuperUser.
 * Use for every action on a target member in the People UI.
 */
export function canActOn(
  caller: { role?: string; is_superuser?: boolean; id?: string } | null | undefined,
  target: { role?: string; id?: string },
): boolean {
  if (!caller) return false;
  if (caller.is_superuser) return true;
  if (caller.id && target.id && caller.id === target.id) return false;
  const callerLvl = roleLevel(caller.role);
  const targetLvl = roleLevel(target.role);
  if (callerLvl < 0 || targetLvl < 0) return false;
  // Must be an admin-or-higher to act at all
  const adminLvl = roleLevel('admin');
  if (callerLvl < adminLvl) return false;
  return callerLvl > targetLvl;
}
