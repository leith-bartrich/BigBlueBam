/**
 * Canonical OrgSwitcher component shared across all BigBlueBam apps.
 *
 * Every frontend app imports this file via a Vite alias:
 *   '@bigbluebam/ui/org-switcher' -> '<root>/packages/ui/org-switcher.tsx'
 *
 * Reads the user's organization memberships from the Bam auth API
 * (GET /b3/api/auth/orgs) and lets the user switch the active org
 * via POST /b3/api/auth/switch-org (which rotates the session cookie).
 *
 * On switch: invalidates every React Query cache on the host app and
 * hard-reloads to `reloadPath` so org-scoped data is refetched fresh.
 *
 * Hidden entirely when the user belongs to only one org (there is
 * nothing to switch to). SuperUsers viewing a non-member org get a
 * read-only chip instead.
 */

import { useMemo } from 'react';
import { Building2, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';

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

export interface OrgSwitcherProps {
  /** True once the host app has confirmed the user is logged in. */
  isAuthenticated: boolean;
  /**
   * Path to hard-reload to after a successful org switch. Should be the
   * app's root (e.g. '/blast/', '/bill/'). A full reload is used so every
   * in-memory piece of state re-initialises against the new session.
   */
  reloadPath: string;
  /**
   * Called after the switch succeeds so the host can refresh its own
   * auth store (e.g. re-fetch /auth/me). Optional.
   */
  onAfterSwitch?: () => void | Promise<void>;
  /**
   * Fallback active org id if the /auth/orgs response hasn't arrived yet.
   * Typically the `org_id` the host auth store has already loaded.
   */
  fallbackActiveOrgId?: string | null;
  /**
   * When true and the user's active org is not in the memberships list,
   * renders a read-only "SuperUser viewing" chip using `superuserOrgName`.
   */
  isSuperuserViewing?: boolean;
  /** Name of the org being viewed by a SuperUser non-member. */
  superuserOrgName?: string | null;
}

function joinUrl(path: string): string {
  return `/b3/api${path}`;
}

async function bbbGet<T>(path: string): Promise<T> {
  const res = await fetch(joinUrl(path), { credentials: 'include' });
  if (!res.ok) throw new Error(`Bam API error: ${res.status}`);
  return res.json();
}

async function bbbPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(joinUrl(path), {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Bam API error: ${res.status}`);
  return res.json();
}

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function OrgSwitcher({
  isAuthenticated,
  reloadPath,
  onAfterSwitch,
  fallbackActiveOrgId,
  isSuperuserViewing = false,
  superuserOrgName = null,
}: OrgSwitcherProps) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['bbb', 'auth', 'orgs'],
    queryFn: () => bbbGet<OrgsResponse>('/auth/orgs'),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const orgs = data?.data.organizations ?? [];
  const activeOrgId = data?.data.active_org_id ?? fallbackActiveOrgId ?? null;
  const activeOrg = useMemo(
    () => orgs.find((o) => o.org_id === activeOrgId),
    [orgs, activeOrgId],
  );

  const switchOrg = useMutation({
    mutationFn: (targetOrgId: string) =>
      bbbPost<{ data: unknown }>('/auth/switch-org', { org_id: targetOrgId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      if (onAfterSwitch) await onAfterSwitch();
      window.location.href = reloadPath;
    },
  });

  // SuperUser viewing a non-member org: show a read-only marker.
  if (!activeOrg) {
    if (isSuperuserViewing && superuserOrgName) {
      return (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-red-700 dark:text-red-300"
          title={`${superuserOrgName} - SuperUser (non-member)`}
        >
          <Building2 className="h-4 w-4" />
          <span className="font-medium truncate max-w-[150px]">{superuserOrgName}</span>
          <span className="text-xs opacity-75">SuperUser</span>
        </div>
      );
    }
    return null;
  }

  const displayName = activeOrg.name;

  // Single-org users: read-only chip so the org name and role stay visible
  // without a dropdown that does nothing useful.
  if (orgs.length <= 1) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300"
        title={`${displayName} - ${activeOrg.role}`}
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
          type="button"
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
                      {org.is_default && ' - default'}
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
