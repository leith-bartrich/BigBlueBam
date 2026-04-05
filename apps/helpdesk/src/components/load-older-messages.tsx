/**
 * LoadOlderMessages — HB-31 pagination button
 *
 * Renders above the message list in the ticket-detail view. Calls the
 * `loadMore()` function returned by `useTicketMessages(ticketId)`.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * INTEGRATION GUIDE (for whoever merges this into ticket-detail.tsx):
 * ──────────────────────────────────────────────────────────────────────────
 *
 *   import { useTicketMessages } from '@/hooks/use-ticket-messages';
 *   import { LoadOlderMessages } from '@/components/load-older-messages';
 *
 *   const { visibleMessages, totalMessages, hasMore, loadMore } =
 *     useTicketMessages(ticketId);
 *
 *   <div className="flex flex-col gap-4">
 *     <LoadOlderMessages
 *       hasMore={hasMore}
 *       remaining={totalMessages - visibleMessages.length}
 *       onClick={loadMore}
 *     />
 *     {visibleMessages.map((m) => <MessageRow key={m.id} message={m} />)}
 *   </div>
 *
 * Styling follows the zinc palette used throughout the helpdesk SPA.
 */

import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadOlderMessagesProps {
  hasMore: boolean;
  remaining: number;
  onClick: () => void;
  className?: string;
}

export function LoadOlderMessages({
  hasMore,
  remaining,
  onClick,
  className,
}: LoadOlderMessagesProps) {
  if (!hasMore && remaining <= 0) {
    // Render nothing when there is nothing older to load — avoids layout
    // churn on tickets with few messages.
    return null;
  }

  const label = hasMore
    ? `Load older messages (${remaining} more)`
    : 'All messages loaded';

  return (
    <div className={cn('flex justify-center py-2', className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={!hasMore}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
          hasMore
            ? 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            : 'cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500',
        )}
      >
        <ChevronUp className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    </div>
  );
}
