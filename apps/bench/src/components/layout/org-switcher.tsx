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
    memberships: MembershipOrg[];
  };
}

export function OrgSwitcher() {
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['bbb', 'my-orgs'],
    queryFn: () => bbbGet<OrgsResponse>('/auth/me/orgs'),
    staleTime: 5 * 60 * 1000,
  });

  const orgs = useMemo(() => data?.data?.memberships ?? [], [data]);
  const currentOrg = orgs.find((o) => o.org_id === user?.org_id);

  const switchOrg = useMutation({
    mutationFn: (orgId: string) => bbbPost('/auth/me/switch-org', { org_id: orgId }),
    onSuccess: () => {
      fetchMe();
      qc.invalidateQueries();
    },
  });

  if (orgs.length <= 1) return null;

  return (
    <RadixDropdownMenu.Root>
      <RadixDropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <Building2 className="h-4 w-4 text-zinc-400" />
          <span className="max-w-[140px] truncate">{currentOrg?.name ?? 'Organization'}</span>
        </button>
      </RadixDropdownMenu.Trigger>
      <RadixDropdownMenu.Portal>
        <RadixDropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[200px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-1"
        >
          {orgs.map((org) => {
            const isActive = org.org_id === user?.org_id;
            return (
              <RadixDropdownMenu.Item
                key={org.org_id}
                onSelect={() => !isActive && switchOrg.mutate(org.org_id)}
                className={cn(
                  'flex items-center justify-between rounded-md px-3 py-2 text-sm cursor-pointer outline-none',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300'
                    : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                )}
              >
                <span className="truncate">{org.name}</span>
                {isActive && <Check className="h-3.5 w-3.5 text-primary-500 shrink-0" />}
              </RadixDropdownMenu.Item>
            );
          })}
        </RadixDropdownMenu.Content>
      </RadixDropdownMenu.Portal>
    </RadixDropdownMenu.Root>
  );
}
