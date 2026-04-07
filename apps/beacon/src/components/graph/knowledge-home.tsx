import { useMemo } from 'react';
import { Loader2, AlertTriangle, Clock, Network } from 'lucide-react';
import { useGraphHubs, useGraphRecent, type GraphNode } from '@/hooks/use-graph';
import { GraphCanvas } from '@/components/graph/graph-canvas';
import { EdgeLegend } from '@/components/graph/edge-legend';
import { StatusBadge } from '@/components/beacon/status-badge';
import { FreshnessIndicator } from '@/components/beacon/freshness-indicator';
import { formatRelativeTime } from '@/lib/utils';

interface KnowledgeHomeProps {
  selectedNodeId: string | null;
  showImplicitEdges: boolean;
  onSelectNode: (id: string | null) => void;
  onExpandNode: (id: string, title: string) => void;
  onViewBeacon: (slug: string) => void;
}

function isExpiringWithin7d(node: GraphNode): boolean {
  if (!node.expires_at) return false;
  const days = (new Date(node.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days > 0 && days <= 7;
}

export function KnowledgeHome({
  selectedNodeId,
  showImplicitEdges,
  onSelectNode,
  onExpandNode,
  onViewBeacon,
}: KnowledgeHomeProps) {
  const { data: hubsData, isLoading: hubsLoading } = useGraphHubs('organization');
  const { data: recentNodes, isLoading: recentLoading } = useGraphRecent('organization');

  const hubNodes = hubsData?.data ?? [];
  const hubEdges = hubsData?.edges ?? [];

  const atRiskNodes = useMemo(
    () => hubNodes.filter(isExpiringWithin7d),
    [hubNodes],
  );

  if (hubsLoading && recentLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Left: Hub graph */}
      <div className="flex-1 min-h-[400px] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Hub Beacons
            </h3>
            <span className="text-xs text-zinc-400">
              Top {hubNodes.length} most-connected
            </span>
          </div>
        </div>

        <div className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden">
          {hubNodes.length > 0 ? (
            <GraphCanvas
              nodes={hubNodes}
              edges={hubEdges}
              selectedNodeId={selectedNodeId}
              showImplicitEdges={showImplicitEdges}
              onSelectNode={onSelectNode}
              onExpandNode={onExpandNode}
              onViewBeacon={onViewBeacon}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-600 text-sm">
              No beacon connections yet. Create and link beacons to see the knowledge graph.
            </div>
          )}
        </div>

        <EdgeLegend showImplicit={showImplicitEdges} className="mt-2" />
      </div>

      {/* Right sidebar */}
      <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-5">
        {/* At-Risk Beacons */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              At Risk
            </h3>
            {atRiskNodes.length > 0 && (
              <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
                {atRiskNodes.length}
              </span>
            )}
          </div>
          {atRiskNodes.length > 0 ? (
            <ul className="space-y-1">
              {atRiskNodes.map((node) => (
                <li key={node.id}>
                  <button
                    onClick={() => onExpandNode(node.id, node.title)}
                    className="w-full text-left rounded-md border border-zinc-100 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {node.title}
                    </p>
                    <FreshnessIndicator
                      lastVerifiedAt={node.last_verified_at}
                      expiresAt={node.expires_at}
                      className="mt-0.5"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-400">No beacons expiring within 7 days.</p>
          )}
        </section>

        {/* Recently Updated */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Recently Updated
            </h3>
          </div>
          {recentLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              <span className="text-xs text-zinc-400">Loading...</span>
            </div>
          ) : recentNodes && recentNodes.length > 0 ? (
            <ul className="space-y-1">
              {recentNodes.slice(0, 10).map((node) => (
                <li key={node.id}>
                  <button
                    onClick={() => onExpandNode(node.id, node.title)}
                    className="w-full text-left rounded-md border border-zinc-100 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {node.title}
                      </p>
                      <StatusBadge status={node.status} className="shrink-0" />
                    </div>
                    {node.last_verified_at && (
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Verified {formatRelativeTime(node.last_verified_at)}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-400">No recent activity.</p>
          )}
        </section>
      </div>
    </div>
  );
}
