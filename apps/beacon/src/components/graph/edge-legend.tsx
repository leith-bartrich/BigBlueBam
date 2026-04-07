import { cn } from '@/lib/utils';

const EXPLICIT_EDGE_TYPES = [
  { type: 'RelatedTo', color: '#3b82f6', label: 'Related To', dash: false },
  { type: 'Supersedes', color: '#a855f7', label: 'Supersedes', dash: false },
  { type: 'DependsOn', color: '#f97316', label: 'Depends On', dash: false },
  { type: 'ConflictsWith', color: '#ef4444', label: 'Conflicts With', dash: true },
  { type: 'SeeAlso', color: '#6b7280', label: 'See Also', dash: false },
] as const;

const IMPLICIT_EDGE = { color: '#9ca3af', label: 'Tag Affinity (implicit)', dash: true };

interface EdgeLegendProps {
  showImplicit: boolean;
  className?: string;
}

export function EdgeLegend({ showImplicit, className }: EdgeLegendProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400', className)}>
      {EXPLICIT_EDGE_TYPES.map((e) => (
        <span key={e.type} className="inline-flex items-center gap-1.5">
          <svg width="24" height="8" className="shrink-0">
            <line
              x1="0" y1="4" x2="24" y2="4"
              stroke={e.color}
              strokeWidth="2"
              strokeDasharray={e.dash ? '4 3' : undefined}
            />
          </svg>
          {e.label}
        </span>
      ))}
      {showImplicit && (
        <span className="inline-flex items-center gap-1.5">
          <svg width="24" height="8" className="shrink-0">
            <line
              x1="0" y1="4" x2="24" y2="4"
              stroke={IMPLICIT_EDGE.color}
              strokeWidth="1.5"
              strokeDasharray="3 4"
            />
          </svg>
          {IMPLICIT_EDGE.label}
        </span>
      )}
    </div>
  );
}

/** Color for an edge given its type */
export function edgeColor(edgeType: 'explicit' | 'implicit', linkType?: string): string {
  if (edgeType === 'implicit') return IMPLICIT_EDGE.color;
  const found = EXPLICIT_EDGE_TYPES.find((e) => e.type === linkType);
  return found?.color ?? '#6b7280';
}

/** Whether an edge should be dashed */
export function edgeDashed(edgeType: 'explicit' | 'implicit', linkType?: string): boolean {
  if (edgeType === 'implicit') return true;
  const found = EXPLICIT_EDGE_TYPES.find((e) => e.type === linkType);
  return found?.dash ?? false;
}
