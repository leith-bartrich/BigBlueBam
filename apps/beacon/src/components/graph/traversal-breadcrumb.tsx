import { ChevronRight, Home } from 'lucide-react';
import type { GraphBreadcrumb } from '@/stores/graph.store';

interface TraversalBreadcrumbProps {
  breadcrumbs: GraphBreadcrumb[];
  onNavigate: (index: number) => void;
  onGoHome: () => void;
}

export function TraversalBreadcrumb({ breadcrumbs, onNavigate, onGoHome }: TraversalBreadcrumbProps) {
  if (breadcrumbs.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto scrollbar-none py-1">
      <button
        onClick={onGoHome}
        className="shrink-0 rounded px-1.5 py-0.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        title="Knowledge Home"
      >
        <Home className="h-3.5 w-3.5" />
      </button>
      {breadcrumbs.map((crumb, i) => {
        const isLast = i === breadcrumbs.length - 1;
        return (
          <span key={`${crumb.id}-${i}`} className="inline-flex items-center gap-1 shrink-0">
            <ChevronRight className="h-3 w-3 text-zinc-400 dark:text-zinc-600" />
            {isLast ? (
              <span className="font-medium text-zinc-900 dark:text-zinc-100 max-w-[180px] truncate">
                {crumb.title}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(i)}
                className="rounded px-1.5 py-0.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors max-w-[160px] truncate"
              >
                {crumb.title}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
