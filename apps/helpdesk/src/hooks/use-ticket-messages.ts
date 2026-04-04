/**
 * useTicketMessages(ticketId) — HB-31 message pagination hook
 *
 * Wraps the existing `useTicket(ticketId)` React Query cache and returns
 * a progressively-revealed window of messages (most-recent-first pagination).
 *
 * This hook does NOT make separate API calls — it piggy-backs on the
 * already-cached TicketDetail data populated by `useTicket`. A future
 * enhancement could swap this out for a dedicated
 *   GET /tickets/:id/messages?cursor=...&limit=...
 * endpoint (not yet implemented in apps/helpdesk-api/src/routes/ticket.routes.ts)
 * without changing the public API of this hook.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * INTEGRATION GUIDE (for whoever merges this into ticket-detail.tsx):
 * ──────────────────────────────────────────────────────────────────────────
 *
 *   // BEFORE (current ticket-detail.tsx):
 *   const { data: ticket } = useTicket(id);
 *   return ticket.messages.map((m) => <MessageRow key={m.id} message={m} />);
 *
 *   // AFTER:
 *   const { data: ticket } = useTicket(id);
 *   const { visibleMessages, totalMessages, hasMore, loadMore } =
 *     useTicketMessages(id);
 *
 *   return (
 *     <>
 *       <LoadOlderMessages
 *         hasMore={hasMore}
 *         remaining={totalMessages - visibleMessages.length}
 *         onClick={loadMore}
 *       />
 *       {visibleMessages.map((m) => <MessageRow key={m.id} message={m} />)}
 *     </>
 *   );
 *
 * Notes:
 *   - `visibleMessages` is returned in chronological order (oldest → newest)
 *     so it can be rendered directly. The "window" grows from the tail.
 *   - The button should appear ABOVE the message list (older messages load
 *     at the top).
 *   - When new messages arrive via the realtime hook or optimistic updates
 *     (E9/E10), they extend the tail and are always visible — the window
 *     always includes the newest message.
 *
 * FUTURE ENHANCEMENTS:
 *   - Virtualization (windowed rendering of visibleMessages by scroll
 *     position) is NOT implemented here to avoid conflicts with in-flight
 *     ticket-detail.tsx work. Pagination via loadMore is the MVP.
 *   - Backend: add GET /tickets/:id/messages?before=<cursor>&limit=20 to
 *     apps/helpdesk-api/src/routes/ticket.routes.ts so that we don't have
 *     to ship the entire message array on ticket load.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTicket, type TicketMessage } from './use-tickets';

const INITIAL_PAGE_SIZE = 20;
const PAGE_SIZE = 20;

export interface UseTicketMessagesResult {
  /** Messages currently visible, in chronological order (oldest → newest). */
  visibleMessages: TicketMessage[];
  /** Total number of messages on the ticket (from cache). */
  totalMessages: number;
  /** True when there are older messages that have not yet been revealed. */
  hasMore: boolean;
  /** Reveal the next PAGE_SIZE older messages. Safe no-op when !hasMore. */
  loadMore: () => void;
  /** True while the underlying `useTicket` query is loading for the first time. */
  isLoading: boolean;
}

export function useTicketMessages(ticketId: string): UseTicketMessagesResult {
  const { data: ticket, isLoading } = useTicket(ticketId);

  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_PAGE_SIZE);

  // Reset pagination when switching tickets.
  useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE);
  }, [ticketId]);

  const allMessages = ticket?.messages ?? [];
  const totalMessages = allMessages.length;

  const visibleMessages = useMemo<TicketMessage[]>(() => {
    if (totalMessages === 0) return [];
    // Sort defensively by created_at ascending in case the server order varies.
    const sorted = [...allMessages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    // Take the most recent `visibleCount` messages from the tail.
    const start = Math.max(0, sorted.length - visibleCount);
    return sorted.slice(start);
  }, [allMessages, totalMessages, visibleCount]);

  const hasMore = visibleCount < totalMessages;

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, Number.MAX_SAFE_INTEGER));
  }, []);

  return {
    visibleMessages,
    totalMessages,
    hasMore,
    loadMore,
    isLoading,
  };
}
