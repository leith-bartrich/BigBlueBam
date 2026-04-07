import { useState } from 'react';
import { Plus, Search, Loader2, FolderOpen } from 'lucide-react';
import { useBeaconList, type BeaconStatus, type BeaconListFilters } from '@/hooks/use-beacons';
import { BeaconCard } from '@/components/beacon/beacon-card';
import { Button } from '@/components/common/button';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project.store';
import { useProjectName } from '@/hooks/use-projects';

interface BeaconListPageProps {
  onNavigate: (path: string) => void;
}

const STATUS_CHIPS: { value: BeaconStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'PendingReview', label: 'Pending Review' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Archived', label: 'Archived' },
];

export function BeaconListPage({ onNavigate }: BeaconListPageProps) {
  const [statusFilter, setStatusFilter] = useState<BeaconStatus | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProjectName = useProjectName(activeProjectId);

  const filters: BeaconListFilters = {};
  if (statusFilter !== 'all') filters.status = statusFilter;
  if (searchText.trim()) filters.search = searchText.trim();
  if (activeProjectId) filters.project_id = activeProjectId;

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useBeaconList(filters);

  const beacons = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search beacons..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-60 rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            />
          </div>

          {/* Status filter chips */}
          <div className="flex items-center gap-1">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setStatusFilter(chip.value)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  statusFilter === chip.value
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Project scope indicator */}
          <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            <FolderOpen className="h-3.5 w-3.5" />
            <span>
              {activeProjectName
                ? `Showing beacons for: ${activeProjectName}`
                : 'Showing all org beacons'}
            </span>
          </div>
        </div>

        <Button size="sm" onClick={() => onNavigate('/create')}>
          <Plus className="h-4 w-4" />
          New Beacon
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        ) : beacons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">No beacons yet. Create your first one.</p>
            <Button size="sm" className="mt-4" onClick={() => onNavigate('/create')}>
              <Plus className="h-4 w-4" />
              Create Beacon
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 max-w-4xl">
              {beacons.map((beacon) => (
                <BeaconCard
                  key={beacon.id}
                  beacon={beacon}
                  onClick={() => onNavigate(`/${beacon.slug ?? beacon.id}`)}
                />
              ))}
            </div>

            {hasNextPage && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  loading={isFetchingNextPage}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
