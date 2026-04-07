import { useEffect, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  Filter,
} from 'lucide-react';
import { useGraphStore } from '@/stores/graph.store';
import { useGraphNeighbors } from '@/hooks/use-graph';
import { GraphCanvas } from '@/components/graph/graph-canvas';
import { KnowledgeHome } from '@/components/graph/knowledge-home';
import { EdgeLegend } from '@/components/graph/edge-legend';
import { TraversalBreadcrumb } from '@/components/graph/traversal-breadcrumb';
import { cn } from '@/lib/utils';
import type { BeaconStatus } from '@/hooks/use-beacons';

// ── Status filter options ───────────────────────────────────────────

const STATUS_OPTIONS: BeaconStatus[] = ['Active', 'PendingReview', 'Draft', 'Archived'];

// ── Component ───────────────────────────────────────────────────────

interface GraphExplorerPageProps {
  focalId?: string;
  onNavigate: (path: string) => void;
}

export function GraphExplorerPage({ focalId, onNavigate }: GraphExplorerPageProps) {
  const store = useGraphStore();

  // Sync route focal ID into store on mount / change
  useEffect(() => {
    if (focalId && focalId !== store.focalBeaconId) {
      store.setFocalBeacon(focalId, focalId); // title will be resolved once data loads
    } else if (!focalId && store.focalBeaconId) {
      store.clearFocal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focalId]);

  // Fetch neighbors when we have a focal node
  const { data: neighborsData, isLoading: neighborsLoading } = useGraphNeighbors(
    store.focalBeaconId ?? undefined,
    store.expandedHops,
    {
      includeImplicit: store.showImplicitEdges,
      tagAffinityThreshold: store.tagAffinityThreshold,
      enabled: !!store.focalBeaconId,
    },
  );

  // Update breadcrumb title once we have data (first entry might just have an ID)
  useEffect(() => {
    if (!neighborsData || !store.focalBeaconId) return;
    const focal = neighborsData.nodes.find((n) => n.id === store.focalBeaconId);
    if (!focal) return;
    const crumbs = store.breadcrumbs;
    const last = crumbs[crumbs.length - 1];
    if (last && last.id === focal.id && last.title !== focal.title) {
      // Replace last breadcrumb with resolved title
      const updated = [...crumbs.slice(0, -1), { id: focal.id, title: focal.title }];
      // Directly set via store internals — this is a cosmetic fix
      useGraphStore.setState({ breadcrumbs: updated });
    }
  }, [neighborsData, store.focalBeaconId, store.breadcrumbs]);

  const handleExpandNode = useCallback(
    (id: string, title: string) => {
      store.setFocalBeacon(id, title);
      // Update URL without full navigation
      const newPath = `/graph/${id}`;
      window.history.pushState(null, '', `/beacon${newPath}`);
    },
    [store],
  );

  const handleViewBeacon = useCallback(
    (slug: string) => {
      onNavigate(`/${slug}`);
    },
    [onNavigate],
  );

  const handleGoHome = useCallback(() => {
    store.clearFocal();
    window.history.pushState(null, '', '/beacon/graph');
  }, [store]);

  // ── Render ────────────────────────────────────────────────────────

  const hasFocal = !!store.focalBeaconId;
  const nodes = neighborsData?.nodes ?? [];
  const edges = neighborsData?.edges ?? [];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Knowledge Graph
          </h1>
          {hasFocal && (
            <TraversalBreadcrumb
              breadcrumbs={store.breadcrumbs}
              onNavigate={store.navigateBreadcrumb}
              onGoHome={handleGoHome}
            />
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Implicit edges toggle */}
          <button
            onClick={() => store.setShowImplicitEdges(!store.showImplicitEdges)}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              store.showImplicitEdges
                ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300',
            )}
            title={store.showImplicitEdges ? 'Hide implicit edges' : 'Show implicit edges'}
          >
            {store.showImplicitEdges ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Hops control (only when focused) */}
          {hasFocal && (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Hops:</span>
              {[1, 2, 3].map((h) => (
                <button
                  key={h}
                  onClick={() => store.setExpandedHops(h)}
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
                    store.expandedHops === h
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400'
                      : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300',
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
          )}

          {/* Filter overlay toggle */}
          <FilterPanel
            filterOverlay={store.filterOverlay}
            onToggleStatus={store.toggleFilterStatus}
            onClear={() => {
              store.setFilterStatus([]);
              store.setFilterTags([]);
            }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden p-4">
        {hasFocal ? (
          <div className="h-full flex flex-col">
            {neighborsLoading && nodes.length === 0 ? (
              <div className="flex items-center justify-center h-full text-zinc-400">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-primary-500" />
                  Loading graph data...
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden">
                  <GraphCanvas
                    nodes={nodes}
                    edges={edges}
                    focalNodeId={store.focalBeaconId}
                    selectedNodeId={store.selectedNodeId}
                    showImplicitEdges={store.showImplicitEdges}
                    filterOverlay={store.filterOverlay}
                    onSelectNode={store.setSelectedNodeId}
                    onExpandNode={handleExpandNode}
                    onViewBeacon={handleViewBeacon}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <EdgeLegend showImplicit={store.showImplicitEdges} />
                  <span className="text-xs text-zinc-400">
                    {nodes.length} node{nodes.length !== 1 ? 's' : ''}, {edges.length} edge{edges.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <KnowledgeHome
            selectedNodeId={store.selectedNodeId}
            showImplicitEdges={store.showImplicitEdges}
            onSelectNode={store.setSelectedNodeId}
            onExpandNode={handleExpandNode}
            onViewBeacon={handleViewBeacon}
          />
        )}
      </div>
    </div>
  );
}

// ── Filter Panel (inline dropdown) ──────────────────────────────────

function FilterPanel({
  filterOverlay,
  onToggleStatus,
  onClear,
}: {
  filterOverlay: { status: BeaconStatus[]; tags: string[] };
  onToggleStatus: (status: BeaconStatus) => void;
  onClear: () => void;
}) {
  const hasFilters = filterOverlay.status.length > 0 || filterOverlay.tags.length > 0;

  return (
    <div className="relative ml-2 group">
      <button
        className={cn(
          'rounded-md px-2 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1',
          hasFilters
            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400'
            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300',
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        {hasFilters && (
          <span className="text-[10px]">({filterOverlay.status.length})</span>
        )}
      </button>

      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 hidden group-hover:block z-40">
        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Filter by Status</span>
          {hasFilters && (
            <button
              onClick={onClear}
              className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>
        <div className="p-2 space-y-1">
          {STATUS_OPTIONS.map((status) => {
            const active = filterOverlay.status.includes(status);
            return (
              <button
                key={status}
                onClick={() => onToggleStatus(status)}
                className={cn(
                  'w-full text-left rounded px-2 py-1 text-xs transition-colors',
                  active
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800',
                )}
              >
                {status === 'PendingReview' ? 'Pending Review' : status}
              </button>
            );
          })}
        </div>
        <div className="px-3 py-1.5 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-[10px] text-zinc-400">
            Filtered nodes are dimmed, not hidden.
          </p>
        </div>
      </div>
    </div>
  );
}
