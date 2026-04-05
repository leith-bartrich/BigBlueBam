import { useMemo } from 'react';
import { Building2, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/common/dropdown-menu';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgSummary } from '@/hooks/use-org-summary';
import { api } from '@/lib/api';

interface MembershipOrg {
  org_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: string;
  is_default: boolean;
  joined_at: string;
}

interface OrgsResponse {
  data: {
    active_org_id: string;
    organizations: MembershipOrg[];
  };
}

/**
 * Header dropdown that shows the user's current active org and lets them
 * switch between the orgs they belong to via organization_memberships.
 *
 * Hidden entirely when the user is in exactly one org (no switch possible).
 * Also hidden for API-key auth (no session to mutate).
 *
 * On switch: calls POST /auth/switch-org (which rotates the session), then
 * invalidates every React Query cache and refetches /auth/me so the rest of
 * the app re-reads the new `active_org_id` + org-scoped data.
 */
export function OrgSwitcher() {
  const queryClient = useQueryClient();
  const { user, fetchMe, isAuthenticated } = useAuthStore();

  const { data } = useQuery({
    queryKey: ['auth', 'orgs'],
    queryFn: () => api.get<OrgsResponse>('/auth/orgs'),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const orgs = data?.data.organizations ?? [];
  const activeOrgId = data?.data.active_org_id ?? user?.org_id;
  const activeOrg = useMemo(
    () => orgs.find((o) => o.org_id === activeOrgId),
    [orgs, activeOrgId],
  );

  // When a SuperUser is viewing an org they are NOT a native member of,
  // activeOrg will be undefined (the org isn't in their memberships). Fall
  // back to the current-org summary from /org so we can still show the
  // viewed org's name + a read-only "SU viewing" marker in the header.
  const { data: orgSummary } = useOrgSummary();

  const switchOrg = useMutation({
    mutationFn: (targetOrgId: string) =>
      api.post<{ data: unknown }>('/auth/switch-org', { org_id: targetOrgId }),
    onSuccess: async () => {
      // Session was rotated; refresh everything.
      await queryClient.invalidateQueries();
      await fetchMe();
      // Navigate to home to avoid landing on a page scoped to the old org
      // (e.g. board view for a project the new org doesn't contain).
      window.location.href = '/b3/';
    },
  });

  // SuperUser viewing an org they're NOT a native member of: no dropdown
  // (they can't "switch" to an org they don't belong to through this menu
  // — they'd use the SuperUser console for that). Show a read-only chip
  // with the viewed org's name so the header still tells them which org
  // they're in.
  if (!activeOrg) {
    if (user?.is_superuser_viewing && orgSummary?.name) {
      return (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-red-700 dark:text-red-300"
          title={`${orgSummary.name} · SuperUser (non-member)`}
        >
          <Building2 className="h-4 w-4" />
          <span className="font-medium truncate max-w-[150px]">{orgSummary.name}</span>
          <span className="text-xs opacity-75">SuperUser</span>
        </div>
      );
    }
    return null;
  }

  const displayName = activeOrg.name;

  // Single-org users: render as a read-only chip (no dropdown) so the org
  // name + role are still visible in the header. Users who belong to more
  // than one org get the interactive switcher.
  if (orgs.length <= 1) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300"
        title={`${displayName} · ${activeOrg.role}`}
      >
        <Building2 className="h-4 w-4 text-zinc-500" />
        <span className="font-medium truncate max-w-[150px]">{displayName}</span>
        <span className="text-xs text-zinc-400 capitalize">{activeOrg.role}</span>
      </div>
    );
  }

  return (
    <DropdownMenu
      trigger={
        <button
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          title="Switch organization"
        >
          <Building2 className="h-4 w-4 text-zinc-500" />
          <span className="font-medium truncate max-w-[150px]">{displayName}</span>
          <span className="text-xs text-zinc-400 capitalize">{activeOrg.role}</span>
        </button>
      }
      align="start"
    >
      <div className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        Your organizations
      </div>
      <DropdownMenuSeparator />
      {orgs.map((org) => {
        const isActive = org.org_id === activeOrgId;
        return (
          <DropdownMenuItem
            key={org.org_id}
            onSelect={() => {
              if (!isActive) switchOrg.mutate(org.org_id);
            }}
          >
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="min-w-0">
                <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {org.name}
                </div>
                <div className="text-xs text-zinc-500 capitalize">
                  {org.role}
                  {org.is_default && ' · default'}
                </div>
              </div>
              {isActive && <Check className="h-4 w-4 text-primary-600 shrink-0" />}
            </div>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenu>
  );
}
