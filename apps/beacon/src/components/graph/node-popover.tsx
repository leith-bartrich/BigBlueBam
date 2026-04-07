import { X, ExternalLink, Compass } from 'lucide-react';
import { StatusBadge } from '@/components/beacon/status-badge';
import { FreshnessIndicator } from '@/components/beacon/freshness-indicator';
import type { GraphNode } from '@/hooks/use-graph';

interface NodePopoverProps {
  node: GraphNode;
  /** Screen position for the popover */
  position: { x: number; y: number };
  onClose: () => void;
  onViewBeacon: (slug: string) => void;
  onExploreFromHere: (id: string, title: string) => void;
}

export function NodePopover({ node, position, onClose, onViewBeacon, onExploreFromHere }: NodePopoverProps) {
  // Position the popover near the node, offset to the right
  const style: React.CSSProperties = {
    position: 'absolute',
    left: position.x + 16,
    top: position.y - 20,
    zIndex: 50,
  };

  return (
    <div style={style} className="w-72 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {node.title}
          </h4>
        </div>
        <StatusBadge status={node.status} className="shrink-0" />
        <button
          onClick={onClose}
          className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-2">
        {node.summary && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3">
            {node.summary}
          </p>
        )}

        {/* Tags */}
        {node.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {node.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <FreshnessIndicator
            lastVerifiedAt={node.last_verified_at}
            expiresAt={node.expires_at}
          />
          <span>{node.verification_count} verification{node.verification_count !== 1 ? 's' : ''}</span>
        </div>

        {node.owner_name && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Owner: {node.owner_name}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <button
          onClick={() => onViewBeacon(node.slug)}
          className="inline-flex items-center gap-1 rounded-md bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          View Beacon
        </button>
        <button
          onClick={() => onExploreFromHere(node.id, node.title)}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
        >
          <Compass className="h-3 w-3" />
          Explore from here
        </button>
      </div>
    </div>
  );
}
