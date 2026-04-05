import { useState, useMemo, useEffect } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Search, LogIn, Loader2, Users, FolderKanban, ListChecks, TicketIcon, MessageSquare, Building2, UserPlus, TrendingUp, ArrowLeft } from 'lucide-react';
import type { SuperuserOrgListItem, SuperuserOrgListResponse } from '@bigbluebam/shared';
import { useAuthStore } from '@/stores/auth.store';
import { superuserApi } from '@/lib/api/superuser';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { formatRelativeTime } from '@/lib/utils';

interface SuperuserPageProps {
  onNavigate: (path: string) => void;
}

type Tab = 'overview' | 'organizations';

export function SuperuserPage({ onNavigate }: SuperuserPageProps) {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('overview');

  // Guard: only SuperUsers can see this page
  useEffect(() => {
    if (user && user.is_superuser !== true) {
      onNavigate('/');
    }
  }, [user, onNavigate]);

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
              onClick={() => onNavigate('/')}
              className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-red-100 dark:bg-red-900/30">
              <Shield className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">SuperUser Console</h1>
              <p className="text-xs text-zinc-500">Server-wide administration</p>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 border-t border-zinc-100 dark:border-zinc-800">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
            Overview
          </TabButton>
          <TabButton active={tab === 'organizations'} onClick={() => setTab('organizations')}>
            Organizations
          </TabButton>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {tab === 'overview' ? <OverviewTab /> : <OrganizationsTab onNavigate={onNavigate} />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ' +
        (active
          ? 'border-primary-600 text-primary-700 dark:text-primary-400'
          : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')
      }
    >
      {children}
    </button>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['superuser', 'overview'],
    queryFn: () => superuserApi.getOverview(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load overview
      </div>
    );
  }

  const stats: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; accent?: string }[] = [
    { label: 'Organizations', value: data.total_orgs, icon: Building2 },
    { label: 'Users', value: data.total_users, icon: Users },
    { label: 'Active Sessions', value: data.total_active_sessions, icon: TrendingUp },
    { label: 'Projects', value: data.total_projects, icon: FolderKanban },
    { label: 'Tasks', value: data.total_tasks, icon: ListChecks },
    { label: 'Tickets', value: data.total_tickets, icon: TicketIcon },
    { label: 'Banter Channels', value: data.total_banter_channels, icon: MessageSquare },
  ];

  const growth = [
    { label: 'New Users (7d)', value: data.new_users_7d },
    { label: 'New Users (30d)', value: data.new_users_30d },
    { label: 'New Orgs (7d)', value: data.new_orgs_7d },
    { label: 'New Orgs (30d)', value: data.new_orgs_30d },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wider">
          Server Totals
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wider">
          <UserPlus className="inline h-4 w-4 mr-1" />
          Recent Growth
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {growth.map((g) => (
            <GrowthCard key={g.label} label={g.label} value={g.value} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-zinc-400" />
      </div>
      <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function GrowthCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-primary-200 dark:border-primary-900/50 bg-primary-50/50 dark:bg-primary-900/10 p-4">
      <div className="text-xs font-medium text-primary-700 dark:text-primary-400 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
        +{value.toLocaleString()}
      </div>
    </div>
  );
}

// ─── Organizations Tab ──────────────────────────────────────────────────────

function OrganizationsTab({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof SuperuserOrgListItem>('last_activity_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const queryClient = useQueryClient();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<
    SuperuserOrgListResponse,
    Error
  >({
    queryKey: ['superuser', 'organizations', { search }],
    queryFn: ({ pageParam }) =>
      superuserApi.listOrganizations({
        cursor: pageParam as string | null | undefined,
        search: search || undefined,
        limit: 50,
      }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const rows: SuperuserOrgListItem[] = useMemo(() => {
    const flat = (data?.pages ?? []).flatMap((p) => p.data);
    const sorted = [...flat].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return sorted;
  }, [data, sortKey, sortDir]);

  const switchContext = useMutation({
    mutationFn: (orgId: string) => superuserApi.switchContext(orgId),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      // Refresh the authenticated user so active_org_id updates
      await useAuthStore.getState().fetchMe();
      onNavigate('/');
    },
  });

  const toggleSort = (key: keyof SuperuserOrgListItem) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortIndicator = (key: keyof SuperuserOrgListItem) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none z-10" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or slug..."
            className="pl-9"
          />
        </div>
        <div className="text-xs text-zinc-500">
          {rows.length} {rows.length === 1 ? 'org' : 'orgs'}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <SortHeader onClick={() => toggleSort('name')}>Name{sortIndicator('name')}</SortHeader>
              <SortHeader onClick={() => toggleSort('slug')}>Slug{sortIndicator('slug')}</SortHeader>
              <SortHeader onClick={() => toggleSort('member_count')} align="right">
                Members{sortIndicator('member_count')}
              </SortHeader>
              <SortHeader onClick={() => toggleSort('project_count')} align="right">
                Projects{sortIndicator('project_count')}
              </SortHeader>
              <SortHeader onClick={() => toggleSort('task_count')} align="right">
                Tasks{sortIndicator('task_count')}
              </SortHeader>
              <SortHeader onClick={() => toggleSort('last_activity_at')}>
                Last Activity{sortIndicator('last_activity_at')}
              </SortHeader>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary-500 mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                  No organizations found
                </td>
              </tr>
            ) : (
              rows.map((org) => (
                <tr key={org.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 font-medium">{org.name}</td>
                  <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{org.slug}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {org.member_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {org.project_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {org.task_count}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {org.last_activity_at ? formatRelativeTime(org.last_activity_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => switchContext.mutate(org.id)}
                      loading={switchContext.isPending && switchContext.variables === org.id}
                      disabled={switchContext.isPending}
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      Enter
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  onClick,
  align = 'left',
  children,
}: {
  onClick?: () => void;
  align?: 'left' | 'right';
  children: React.ReactNode;
}) {
  return (
    <th
      onClick={onClick}
      className={
        'px-4 py-2.5 cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-300 ' +
        (align === 'right' ? 'text-right' : 'text-left')
      }
    >
      {children}
    </th>
  );
}
