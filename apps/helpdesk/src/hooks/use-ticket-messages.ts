/**
 * useTicketMessages(ticketId) — HB-31 message pagination hook
 *
 * Fetches older messages via `GET /tickets/:id/messages?before=<cursor>&limit=...`
 * and merges them with the initial message set loaded by `useTicket`.
 *
 * The hook preserves its original public API — `visibleMessages`,
 * `totalMessages`, `hasMore`, `loadMore`, `isLoading` — so existing callers
 * in `ticket-detail.tsx` continue to work without changes.
 *
 * Messages are returned in chronological order (oldest -> newest) so they
 * can be rendered directly. The "Load older messages" button lives ABOVE
 * the list and calls `loadMore()`.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTicket, type TicketMessage } from './use-tickets';

const PAGE_SIZE = 20;

interface MessagesPage {
  data: TicketMessage[];
  has_more: boolean;
  next_before: string | null;
}

export interface UseTicketMessagesResult {
  /** Messages currently visible, in chronological order (oldest -> newest). */
  visibleMessages: TicketMessage[];
  /** Total count of messages currently known to the client. */
  totalMessages: number;
  /** True when there are older messages that have not yet been fetched. */
  hasMore: boolean;
  /** Fetch the next PAGE_SIZE older messages from the server. */
  loadMore: () => void;
  /** True while the underlying `useTicket` query is loading for the first time. */
  isLoading: boolean;
}

export function useTicketMessages(ticketId: string): UseTicketMessagesResult {
  const queryClient = useQueryClient();
  const { data: ticket, isLoading } = useTicket(ticketId);

  // Cursor for fetching the next older page. `null` means "no request yet".
  // Once set to a uuid, we fetch messages strictly older than that uuid.
  const [cursor, setCursor] = useState<string | null>(null);
  // Accumulated older messages fetched via the messages endpoint.
  const [olderMessages, setOlderMessages] = useState<TicketMessage[]>([]);
  // `true` once the server tells us there are no more messages upstream.
  const [exhausted, setExhausted] = useState(false);

  // Reset pagination state when switching tickets.
  useEffect(() => {
    setCursor(null);
    setOlderMessages([]);
    setExhausted(false);
  }, [ticketId]);

  // Fire a fetch whenever `cursor` is set. Using useQuery keeps the fetch
  // deduped, cached, and cancellable; we drain the result into local state
  // so multiple pages accumulate.
  const pageQuery = useQuery({
    queryKey: ['helpdesk', 'tickets', ticketId, 'messages', cursor],
    queryFn: () =>
      api
        .get<MessagesPage>(`/tickets/${ticketId}/messages`, {
          before: cursor ?? undefined,
          limit: PAGE_SIZE,
        }),
    enabled: !!ticketId && cursor !== null && !exhausted,
    staleTime: 1000 * 30,
  });

  // Drain page results into the accumulator.
  useEffect(() => {
    const page = pageQuery.data;
    if (!page) return;
    setOlderMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...prev];
      for (const m of page.data) {
        if (!seen.has(m.id)) merged.push(m);
      }
      return merged;
    });
    if (!page.has_more) {
      setExhausted(true);
    }
  }, [pageQuery.data]);

  const initialMessages = ticket?.messages ?? [];

  const visibleMessages = useMemo<TicketMessage[]>(() => {
    // Merge initial (from useTicket) with older fetched pages, dedupe by id,
    // and sort ascending by (created_at, id).
    const byId = new Map<string, TicketMessage>();
    for (const m of initialMessages) byId.set(m.id, m);
    for (const m of olderMessages) byId.set(m.id, m);
    return Array.from(byId.values()).sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      if (ta !== tb) return ta - tb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }, [initialMessages, olderMessages]);

  const totalMessages = visibleMessages.length;

  // hasMore is true if either:
  //  - we've never asked the server (cursor === null) AND the initial
  //    ticket payload looks "full" (server sends all by default today, so
  //    we assume the initial set is the newest window only when it hits
  //    a reasonable page size; conservatively, trust the server's
  //    has_more once a request has been made).
  //  - the server has indicated has_more on the latest fetched page.
  const hasMore = !exhausted && cursor !== null
    ? !!pageQuery.data?.has_more || pageQuery.isFetching
    : // Before any fetch: optimistically show the button only when there
      // are enough initial messages to suggest older ones might exist.
      initialMessages.length >= PAGE_SIZE;

  const loadMore = useCallback(() => {
    if (exhausted) return;
    // Cursor is the id of the oldest currently-visible message.
    const oldest = visibleMessages[0];
    if (!oldest) return;
    // If this is a repeat click and we haven't advanced, refetch.
    if (oldest.id === cursor) {
      queryClient.invalidateQueries({
        queryKey: ['helpdesk', 'tickets', ticketId, 'messages', cursor],
      });
      return;
    }
    setCursor(oldest.id);
  }, [visibleMessages, cursor, exhausted, queryClient, ticketId]);

  return {
    visibleMessages,
    totalMessages,
    hasMore,
    loadMore,
    isLoading,
  };
}
