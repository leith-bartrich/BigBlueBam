import { useMemo } from 'react';
import { Building2, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';
import { bbbGet, bbbPost } from '@/lib/bbb-api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

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
 * Banter port of Bam's OrgSwitcher. Calls the Bam auth API (shared session)
 * directly via bbb-api.ts because both apps share the same session cookie.
 *
 * On switch: calls POST /b3/api/auth/switch-org (which rotates the session),
 * invalidates all React Query caches, and reloads to /banter/ so the new
 * org's scoped data is refetched fresh.
 */
export function OrgSwitcher() {
  const queryClient = useQueryClient();
  const { user, fetchMe, isAuthenticated } = useAuthStore();

  const { data } = useQuery({
    queryKey: ['bbb', 'auth', 'orgs'],
    queryFn: () => bbbGet<OrgsResponse>('/auth/orgs'),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const orgs = data?.data.organizations ?? [];
  const activeOrgId = data?.data.active_org_id ?? user?.org_id;
  const activeOrg = useMemo(
    () => orgs.find((o) => o.org_id === activeOrgId),
    [orgs, activeOrgId],
  );

  const switchOrg = useMutation({
    mutationFn: (targetOrgId: string) =>
      bbbPost<{ data: unknown }>('/auth/switch-org', { org_id: targetOrgId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      await fetchMe();
      // Reload to Banter root so the whole session context is refreshed.
      window.location.href = '/banter/';
    },
  });

  if (!activeOrg) return null;

  const displayName = activeOrg.name;

  // Single-org users: read-only chip.
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
    <RadixDropdownMenu.Root>
      <RadixDropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          title="Switch organization"
        >
          <Building2 className="h-4 w-4 text-zinc-500" />
          <span className="font-medium truncate max-w-[150px]">{displayName}</span>
          <span className="text-xs text-zinc-400 capitalize">{activeOrg.role}</span>
        </button>
      </RadixDropdownMenu.Trigger>
      <RadixDropdownMenu.Portal>
        <RadixDropdownMenu.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-50 min-w-[220px] overflow-hidden rounded-lg border border-zinc-200 bg-white p-1 shadow-lg',
            'dark:bg-zinc-900 dark:border-zinc-700',
          )}
        >
          <div className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Your organizations
          </div>
          <RadixDropdownMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          {orgs.map((org) => {
            const isActive = org.org_id === activeOrgId;
            return (
              <RadixDropdownMenu.Item
                key={org.org_id}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer outline-none hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
              </RadixDropdownMenu.Item>
            );
          })}
        </RadixDropdownMenu.Content>
      </RadixDropdownMenu.Portal>
    </RadixDropdownMenu.Root>
  );
}
