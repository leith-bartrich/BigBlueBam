import { useState, useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Shield, Search, Loader2, ArrowLeft, UserCheck, UserX } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { Select } from '@/components/common/select';
import { Avatar } from '@/components/common/avatar';
import { Badge } from '@/components/common/badge';
import {
  superuserUsersApi,
  type SuperuserUserListItem,
  type SuperuserUserListResponse,
} from '@/lib/api/superuser-users';
import { formatRelativeTime } from '@/lib/utils';

interface SuperuserPeopleListPageProps {
  onNavigate: (path: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

const SU_OPTIONS = [
  { value: 'all', label: 'All users' },
  { value: 'yes', label: 'SuperUsers' },
  { value: 'no', label: 'Non-SuperUsers' },
];

export function SuperuserPeopleListPage({ onNavigate }: SuperuserPeopleListPageProps) {
  const { user } = useAuthStore();

  // Gate
  useEffect(() => {
    if (user && user.is_superuser !== true) onNavigate('/');
  }, [user, onNavigate]);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [suFilter, setSuFilter] = useState<'all' | 'yes' | 'no'>('all');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isActiveParam =
    status === 'all' ? undefined : status === 'active' ? true : false;
  const isSuParam =
    suFilter === 'all' ? undefined : suFilter === 'yes' ? true : false;

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, error } =
    useInfiniteQuery<SuperuserUserListResponse, Error>({
      queryKey: [
        'superuser',
        'users',
        { search, is_active: isActiveParam, is_superuser: isSuParam },
      ],
      queryFn: ({ pageParam }) =>
        superuserUsersApi.listUsers({
          cursor: pageParam as string | null | undefined,
          search: search || undefined,
          is_active: isActiveParam,
          is_superuser: isSuParam,
          limit: 50,
        }),
      initialPageParam: null,
      getNextPageParam: (last) => last.next_cursor ?? undefined,
    });

  const rows: SuperuserUserListItem[] = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.data),
    [data],
  );

  if (!user || user.is_superuser !== true) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('/superuser')}
              className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Back to SuperUser console"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-red-100 dark:bg-red-900/30">
              <Shield className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">All users</h1>
              <p className="text-xs text-zinc-500">Server-wide user directory</p>
            </div>
            <span className="ml-2 inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
              {rows.length}
              {hasNextPage ? '+' : ''}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-md min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none z-10" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-9"
            />
          </div>
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onValueChange={(v) => setStatus(v as 'all' | 'active' | 'disabled')}
            className="w-40"
          />
          <Select
            options={SU_OPTIONS}
            value={suFilter}
            onValueChange={(v) => setSuFilter(v as 'all' | 'yes' | 'no')}
            className="w-48"
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load users: {error.message}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Orgs</th>
                  <th className="px-4 py-2.5">Last seen</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary-500 mx-auto" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  rows.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => onNavigate(`/superuser/people/${u.id}`)}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={u.avatar_url} name={u.display_name} size="sm" />
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {u.display_name || '(no name)'}
                            </span>
                            {u.is_superuser && (
                              <Shield
                                className="h-3.5 w-3.5 text-red-500 shrink-0"
                                aria-label="SuperUser"
                              />
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 truncate max-w-[240px]">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <OrgPills orgs={u.orgs} />
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                        {u.last_seen_at ? formatRelativeTime(u.last_seen_at) : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        {u.is_active ? (
                          <Badge variant="success">
                            <UserCheck className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="danger">
                            <UserX className="h-3 w-3" />
                            Disabled
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {hasNextPage && (
          <div className="flex justify-center">
            <Button variant="secondary" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
              Load more
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

function OrgPills({ orgs }: { orgs: SuperuserUserListItem['orgs'] }) {
  if (orgs.length === 0) {
    return <span className="text-xs text-zinc-400 italic">none</span>;
  }
  const shown = orgs.slice(0, 3);
  const extra = orgs.length - shown.length;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {shown.map((o) => (
        <span
          key={o.org_id}
          className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-300"
          title={`${o.name} — ${o.role}`}
        >
          <span className="truncate max-w-[120px]">{o.name}</span>
          <span className="text-[10px] text-zinc-500">{o.role}</span>
        </span>
      ))}
      {extra > 0 && (
        <span
          className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500"
          title={orgs
            .slice(3)
            .map((o) => `${o.name} (${o.role})`)
            .join(', ')}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

// Re-export with the spec's expected name
export { SuperuserPeopleListPage as default };
