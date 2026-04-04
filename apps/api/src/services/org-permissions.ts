/** Default org permission settings. Applied when a setting is not explicitly configured. */
export const DEFAULT_ORG_PERMISSIONS = {
  // Project permissions
  members_can_create_projects: true,
  members_can_delete_own_projects: false,

  // Banter permissions
  members_can_create_channels: true,
  members_can_create_private_channels: true,
  members_can_create_group_dms: true,

  // File permissions
  max_file_upload_mb: 25,

  // Invitation permissions
  members_can_invite_members: false, // only admins by default

  // API key permissions
  members_can_create_api_keys: true,
  allowed_api_key_scopes: ['read', 'read_write'] as string[], // members can't create 'admin' scope keys
};

export type OrgPermissions = typeof DEFAULT_ORG_PERMISSIONS;
export type OrgPermissionKey = keyof OrgPermissions;

/** Get effective permissions for an org, merging defaults with overrides.
 * Only merges values whose type matches the default's type, so that garbage
 * values (e.g. the string "false") don't corrupt booleans. */
export function getOrgPermissions(orgSettings: Record<string, unknown> | null | undefined): OrgPermissions {
  const permissions = (orgSettings as Record<string, unknown> | null)?.permissions as Record<string, unknown> | undefined;
  const merged: Record<string, unknown> = { ...DEFAULT_ORG_PERMISSIONS };
  if (permissions) {
    for (const key of Object.keys(DEFAULT_ORG_PERMISSIONS) as OrgPermissionKey[]) {
      const override = permissions[key];
      const defaultVal = DEFAULT_ORG_PERMISSIONS[key];
      if (override === undefined) continue;
      if (typeof defaultVal === 'boolean') {
        if (typeof override === 'boolean') merged[key] = override;
      } else if (typeof defaultVal === 'number') {
        if (typeof override === 'number') merged[key] = override;
      } else if (Array.isArray(defaultVal)) {
        if (Array.isArray(override)) merged[key] = override;
      } else {
        merged[key] = override;
      }
    }
  }
  return merged as OrgPermissions;
}

/** Check if a specific boolean permission is enabled for the org. */
export function checkOrgPermission(
  orgSettings: Record<string, unknown> | null | undefined,
  key: OrgPermissionKey,
): boolean {
  const perms = getOrgPermissions(orgSettings);
  const val = perms[key];
  return typeof val === 'boolean' ? val : Boolean(DEFAULT_ORG_PERMISSIONS[key]);
}

/** Check if a user's org role bypasses permission restrictions (admin/owner). */
export function isOrgPrivileged(userRole: string): boolean {
  return userRole === 'admin' || userRole === 'owner';
}
