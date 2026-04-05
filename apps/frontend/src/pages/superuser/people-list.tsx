import { useState, useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Search,
  Loader2,
  ArrowLeft,
  UserCheck,
  UserX,
  Download,
  X,
} from 'lucide-react';
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
import { exportCsv, todayStamp, type CsvColumn } from '@/lib/csv';

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

interface BulkProgress {
  label: string;
  done: number;
  total: number;
  succeeded: number;
  failed: { id: string; name: string; reason: string }[];
  skipped: { id: string; name: string; reason: string }[];
  finished: boolean;
}

export function SuperuserPeopleListPage({ onNavigate }: SuperuserPeopleListPageProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);

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

  const selectedUsers = useMemo(
    () => rows.filter((u) => selectedIds.has(u.id)),
    [rows, selectedIds],
  );

  const allChecked =
    rows.length > 0 && rows.every((u) => selectedIds.has(u.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (allChecked) {
        const next = new Set(prev);
        for (const r of rows) next.delete(r.id);
        return next;
      }
      const next = new Set(prev);
      for (const r of rows) next.add(r.id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['superuser', 'users'] });

  async function runBulk(
    label: string,
    targets: SuperuserUserListItem[],
    action: (u: SuperuserUserListItem) => Promise<unknown>,
  ) {
    const skipped: BulkProgress['skipped'] = [];
    const runnable: SuperuserUserListItem[] = [];
    for (const u of targets) {
      const name = u.display_name || u.email;
      if (u.id === user?.id) {
        skipped.push({ id: u.id, name, reason: 'self' });
        continue;
      }
      runnable.push(u);
    }

    const total = runnable.length;
    const failed: BulkProgress['failed'] = [];
    let done = 0;
    let succeeded = 0;

    setBulkProgress({
      label,
      done: 0,
      total,
      succeeded: 0,
      failed: [],
      skipped,
      finished: total === 0,
    });

    if (total === 0) {
      invalidate();
      return;
    }

    await Promise.all(
      runnable.map(async (u) => {
        try {
          await action(u);
          succeeded += 1;
        } catch (err) {
          const name = u.display_name || u.email;
          const reason = (err as Error)?.message ?? 'failed';
          failed.push({ id: u.id, name, reason });
        } finally {
          done += 1;
          setBulkProgress((prev) =>
            prev
              ? {
                  ...prev,
                  done,
                  succeeded,
                  failed: [...failed],
                  finished: done === total,
                }
              : prev,
          );
        }
      }),
    );

    invalidate();
  }

  const bulkSetActive = (isActive: boolean) =>
    runBulk(
      isActive ? 'Enabling' : 'Disabling',
      selectedUsers.filter((u) => u.is_active !== isActive),
      (u) => superuserUsersApi.setActive(u.id, isActive),
    );

  const handleExportCsv = () => {
    const exportRows = selectedUsers.length > 0 ? selectedUsers : rows;
    const columns: CsvColumn<SuperuserUserListItem>[] = [
      { header: 'id', value: (r) => r.id },
      { header: 'email', value: (r) => r.email },
      { header: 'display_name', value: (r) => r.display_name },
      { header: 'is_active', value: (r) => r.is_active },
      { header: 'is_superuser', value: (r) => r.is_superuser },
      { header: 'created_at', value: (r) => r.created_at },
      { header: 'last_seen_at', value: (r) => r.last_seen_at ?? '' },
      { header: 'org_count', value: (r) => r.orgs.length },
    ];
    exportCsv(`people-all-${todayStamp()}.csv`, exportRows, columns);
  };

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
                  <th className="px-4 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="rounded border-zinc-300 dark:border-zinc-700"
                      aria-label="Select all"
                    />
                  </th>
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
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary-500 mx-auto" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
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
                      <td
                        className="px-4 py-3 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleSelect(u.id)}
                          className="rounded border-zinc-300 dark:border-zinc-700"
                          aria-label={`Select ${u.display_name || u.email}`}
                        />
                      </td>
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

      {/* Floating bulk-action toolbar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            key="bulk-toolbar"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(calc(100vw-2rem),56rem)] max-w-4xl"
          >
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 shadow-lg shadow-zinc-900/10 dark:shadow-black/40">
              <span className="inline-flex items-center rounded-full bg-primary-100 dark:bg-primary-900/40 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300 tabular-nums">
                {selectedIds.size} selected
              </span>

              <button
                type="button"
                onClick={() => bulkSetActive(false)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <UserX className="h-3.5 w-3.5" />
                Disable
              </button>
              <button
                type="button"
                onClick={() => bulkSetActive(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Enable
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>

              <div className="flex-1" />
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Clear selection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk-action progress toast */}
      <AnimatePresence>
        {bulkProgress && (
          <motion.div
            key="bulk-progress"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-24 right-6 z-50 w-80 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
          >
            <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {bulkProgress.finished
                  ? 'Done'
                  : `${bulkProgress.label} ${bulkProgress.done} of ${bulkProgress.total}…`}
              </div>
              <button
                type="button"
                onClick={() => setBulkProgress(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-3 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
              {!bulkProgress.finished && bulkProgress.total > 0 && (
                <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all"
                    style={{
                      width: `${Math.round(
                        (bulkProgress.done / bulkProgress.total) * 100,
                      )}%`,
                    }}
                  />
                </div>
              )}
              {bulkProgress.finished && (
                <>
                  <div>
                    {bulkProgress.succeeded} succeeded
                    {bulkProgress.failed.length > 0 &&
                      `, ${bulkProgress.failed.length} failed`}
                    {bulkProgress.skipped.length > 0 &&
                      `, ${bulkProgress.skipped.length} skipped`}
                  </div>
                  {bulkProgress.failed.length > 0 && (
                    <ul className="space-y-0.5 text-red-600 dark:text-red-400 max-h-24 overflow-auto">
                      {bulkProgress.failed.map((f) => (
                        <li key={`f-${f.id}`}>
                          {f.name}: {f.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                  {bulkProgress.skipped.length > 0 && (
                    <ul className="space-y-0.5 text-zinc-500 max-h-24 overflow-auto">
                      {bulkProgress.skipped.map((s) => (
                        <li key={`s-${s.id}`}>
                          {s.name}: skipped ({s.reason})
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
