import type { SearchResult } from '@/hooks/use-search';
import { StatusBadge } from '@/components/beacon/status-badge';
import { FreshnessIndicator } from '@/components/beacon/freshness-indicator';
import { cn } from '@/lib/utils';
import { Link2, ShieldCheck } from 'lucide-react';

// ── Match source styling ────────────────────────────────────────────

const MATCH_SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  semantic: {
    label: 'Semantic match',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  tag_expansion: {
    label: 'Tag expansion',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  link_traversal: {
    label: 'Link traversal',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  fulltext_fallback: {
    label: 'Keyword match',
    className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
};

// ── Highlight renderer ──────────────────────────────────────────────

/**
 * Render a highlight string that may contain **bold** markers for matched terms.
 * Converts **term** to <mark> tags for visibility.
 */
function HighlightText({ text }: { text: string }) {
  // Split on **...**  patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2);
          return (
            <mark
              key={i}
              className="bg-yellow-200/80 dark:bg-yellow-700/40 text-inherit rounded-sm px-0.5"
            >
              {inner}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ── Result card ─────────────────────────────────────────────────────

interface ResultCardProps {
  result: SearchResult;
  onNavigate: (path: string) => void;
  onAddTag: (tag: string) => void;
}

export function ResultCard({ result, onNavigate, onAddTag }: ResultCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
      {/* Title + status */}
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => onNavigate(`/${result.slug ?? result.beacon_id}`)}
          className="text-left font-semibold text-zinc-900 dark:text-zinc-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          {result.title}
        </button>
        <StatusBadge status={result.status} className="shrink-0" />
      </div>

      {/* Summary */}
      {result.summary && (
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
          {result.summary}
        </p>
      )}

      {/* Highlight / matched passage */}
      {result.highlight && (
        <div className="mt-2 rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 italic">
          &ldquo;<HighlightText text={result.highlight} />&rdquo;
        </div>
      )}

      {/* Tags (clickable chips) */}
      {result.tags?.length > 0 && (
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          {result.tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onAddTag(tag)}
              title={`Add "${tag}" to filters`}
              className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-900/30 dark:hover:text-primary-400 transition-colors cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Match source badges */}
      {result.match_sources?.length > 0 && (
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          {result.match_sources.map((source) => {
            const config = MATCH_SOURCE_CONFIG[source];
            if (!config) return null;
            return (
              <span
                key={source}
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  config.className,
                )}
              >
                {config.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Metadata row: freshness, verifications, owner */}
      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500 flex-wrap">
        <FreshnessIndicator
          lastVerifiedAt={result.last_verified_at}
          expiresAt={result.expires_at}
        />
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          {result.verification_count} verification{result.verification_count !== 1 ? 's' : ''}
        </span>
        {result.owner_name && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span>@{result.owner_name}</span>
          </>
        )}
      </div>

      {/* Linked Beacons preview (first 2) */}
      {result.linked_beacons?.length > 0 && (
        <div className="mt-2.5 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-1">
          {result.linked_beacons.slice(0, 2).map((lb) => (
            <button
              key={lb.id}
              onClick={() => onNavigate(`/${lb.slug ?? lb.id}`)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <Link2 className="h-3 w-3 shrink-0" />
              <span>{lb.title}</span>
              <span className="text-zinc-400 dark:text-zinc-500">({lb.link_type})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
