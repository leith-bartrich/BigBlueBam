import { create } from 'zustand';
import type { BeaconStatus } from '@/hooks/use-beacons';

// ── Breadcrumb entry ────────────────────────────────────────────────

export interface GraphBreadcrumb {
  id: string;
  title: string;
}

// ── Filter overlay ──────────────────────────────────────────────────

export interface GraphFilterOverlay {
  status: BeaconStatus[];
  tags: string[];
}

// ── Store shape ─────────────────────────────────────────────────────

interface GraphState {
  /** Currently centered beacon, or null for Knowledge Home */
  focalBeaconId: string | null;
  /** Number of hops to expand around focal node */
  expandedHops: number;
  /** Breadcrumb trail for backtracking */
  breadcrumbs: GraphBreadcrumb[];
  /** Whether to show implicit (tag-affinity) edges */
  showImplicitEdges: boolean;
  /** Minimum shared tags for an implicit edge (1-5) */
  tagAffinityThreshold: number;
  /** Filter overlay (dims non-matching nodes) */
  filterOverlay: GraphFilterOverlay;
  /** Currently selected node (shows popover) */
  selectedNodeId: string | null;

  // Actions
  setFocalBeacon: (id: string, title: string) => void;
  clearFocal: () => void;
  setExpandedHops: (hops: number) => void;
  navigateBreadcrumb: (index: number) => void;
  setShowImplicitEdges: (show: boolean) => void;
  setTagAffinityThreshold: (threshold: number) => void;
  setFilterStatus: (statuses: BeaconStatus[]) => void;
  toggleFilterStatus: (status: BeaconStatus) => void;
  setFilterTags: (tags: string[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  reset: () => void;
}

const DEFAULT_STATE = {
  focalBeaconId: null as string | null,
  expandedHops: 1,
  breadcrumbs: [] as GraphBreadcrumb[],
  showImplicitEdges: true,
  tagAffinityThreshold: 2,
  filterOverlay: {
    status: [] as BeaconStatus[],
    tags: [] as string[],
  },
  selectedNodeId: null as string | null,
};

export const useGraphStore = create<GraphState>((set, get) => ({
  ...DEFAULT_STATE,

  setFocalBeacon: (id, title) => {
    const current = get();
    const newBreadcrumbs = [...current.breadcrumbs];

    // Don't duplicate the same node at the end
    if (newBreadcrumbs.length === 0 || newBreadcrumbs[newBreadcrumbs.length - 1]!.id !== id) {
      newBreadcrumbs.push({ id, title });
    }

    set({
      focalBeaconId: id,
      expandedHops: 1,
      breadcrumbs: newBreadcrumbs,
      selectedNodeId: null,
    });
  },

  clearFocal: () => {
    set({
      focalBeaconId: null,
      expandedHops: 1,
      breadcrumbs: [],
      selectedNodeId: null,
    });
  },

  setExpandedHops: (hops) => set({ expandedHops: Math.max(1, Math.min(3, hops)) }),

  navigateBreadcrumb: (index) => {
    const crumbs = get().breadcrumbs;
    if (index < 0 || index >= crumbs.length) return;
    const target = crumbs[index]!;
    set({
      focalBeaconId: target.id,
      expandedHops: 1,
      breadcrumbs: crumbs.slice(0, index + 1),
      selectedNodeId: null,
    });
  },

  setShowImplicitEdges: (show) => set({ showImplicitEdges: show }),
  setTagAffinityThreshold: (threshold) =>
    set({ tagAffinityThreshold: Math.max(1, Math.min(5, threshold)) }),

  setFilterStatus: (statuses) =>
    set((s) => ({ filterOverlay: { ...s.filterOverlay, status: statuses } })),

  toggleFilterStatus: (status) => {
    const current = get().filterOverlay.status;
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    set((s) => ({ filterOverlay: { ...s.filterOverlay, status: next } }));
  },

  setFilterTags: (tags) =>
    set((s) => ({ filterOverlay: { ...s.filterOverlay, tags } })),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  reset: () => set({ ...DEFAULT_STATE }),
}));
