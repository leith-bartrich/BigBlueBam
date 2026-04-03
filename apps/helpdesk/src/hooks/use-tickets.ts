import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
  status_changes?: TicketStatusChange[];
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
  return useMutation({
    mutationFn: (data: { body: string }) =>
      api.post<{ data: TicketMessage }>(`/tickets/${ticketId}/messages`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets', ticketId] });
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
