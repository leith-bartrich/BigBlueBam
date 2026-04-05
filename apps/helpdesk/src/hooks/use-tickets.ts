import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ws } from '@/lib/websocket';

export interface Ticket {
  id: string;
  ticket_number: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  // HB-55
  merged_at?: string | null;
  merged_by?: string | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_type: 'client' | 'agent';
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface TicketStatusChange {
  type: 'status_change';
  from_status: string;
  to_status: string;
  changed_at: string;
}

export interface TicketDuplicateOf {
  id: string;
  ticket_number: number;
  subject: string;
}

export interface TicketDuplicate {
  id: string;
  ticket_number: number;
  subject: string;
  merged_at: string | null;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
  status_changes?: TicketStatusChange[];
  // HB-55: duplicate/merge relationships expanded by the server.
  duplicate_of?: TicketDuplicateOf | null;
  duplicates?: TicketDuplicate[];
}

export interface HelpdeskSettings {
  categories: string[];
}

export function useTickets() {
  return useQuery({
    queryKey: ['helpdesk', 'tickets'],
    queryFn: () => api.get<{ data: Ticket[] }>('/tickets').then((r) => r.data),
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['helpdesk', 'tickets', id],
    queryFn: () => api.get<{ data: TicketDetail }>(`/tickets/${id}`).then((r) => r.data),
    enabled: !!id,
    refetchOnWindowFocus: true,
  });
}

export function useHelpdeskSettings() {
  return useQuery({
    queryKey: ['helpdesk', 'settings'],
    queryFn: () => api.get<{ data: HelpdeskSettings }>('/settings').then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { subject: string; description: string; priority: string; category?: string }) =>
      api.post<{ data: Ticket }>('/tickets', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets'] });
    },
  });
}

export function usePostMessage(ticketId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['helpdesk', 'tickets', ticketId];
  return useMutation({
    mutationFn: (data: { body: string }) =>
      api.post<{ data: TicketMessage }>(`/tickets/${ticketId}/messages`, data).then((r) => r.data),
    onMutate: async (data) => {
      // Cancel in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value for rollback
      const previousTicket = queryClient.getQueryData<TicketDetail>(queryKey);

      // Optimistically append the new message with a temp ID
      if (previousTicket) {
        const optimisticMessage: TicketMessage = {
          id: `optimistic-${Date.now()}`,
          ticket_id: ticketId,
          author_type: 'client',
          author_id: 'optimistic',
          author_name: 'You',
          body: data.body,
          created_at: new Date().toISOString(),
        };
        queryClient.setQueryData<TicketDetail>(queryKey, {
          ...previousTicket,
          messages: [...previousTicket.messages, optimisticMessage],
        });
      }

      return { previousTicket };
    },
    onSuccess: (newMessage) => {
      // Replace optimistic message with real server message (targeted update, no refetch)
      const current = queryClient.getQueryData<TicketDetail>(queryKey);
      if (current) {
        queryClient.setQueryData<TicketDetail>(queryKey, {
          ...current,
          messages: [
            ...current.messages.filter((m) => !m.id.startsWith('optimistic-')),
            newMessage,
          ],
        });
      }
    },
    onError: (_err, _data, context) => {
      // Restore snapshot on failure
      if (context?.previousTicket) {
        queryClient.setQueryData(queryKey, context.previousTicket);
      }
      // Invalidate for safety to resync from server
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Subscribes the tickets list query to realtime events so that the list
 * re-fetches when messages are posted or ticket statuses change anywhere.
 */
export function useRealtimeTicketsList() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets'] });
    };
    const unsub1 = ws.on('ticket.message.created', invalidate);
    const unsub2 = ws.on('ticket.status.changed', invalidate);
    return () => {
      unsub1();
      unsub2();
    };
  }, [queryClient]);
}

// HB-55: mark the current ticket as a duplicate of another ticket owned by
// the same customer, identified by ticket_number (human-readable).
export function useMarkDuplicate(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (primary_ticket_number: string | number) =>
      api.post<{ data: { id: string; duplicate_of: string; primary_number: number } }>(
        `/tickets/${ticketId}/mark-duplicate`,
        { primary_ticket_number },
      ).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets'] });
    },
  });
}

export function useUnmarkDuplicate(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.delete<{ data: { id: string; duplicate_of: null } }>(
        `/tickets/${ticketId}/mark-duplicate`,
      ).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets'] });
    },
  });
}

export function useReopenTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ data: Ticket }>(`/tickets/${ticketId}/reopen`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets'] });
    },
  });
}
