import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number;
  scan_status: string | null;
  created_at: string;
  url: string | null;
}

export function useTicketAttachments(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['helpdesk-ticket', ticketId, 'attachments'],
    queryFn: () =>
      api.get<{ data: TicketAttachment[] }>(`/tickets/${ticketId}/attachments`),
    enabled: !!ticketId,
    staleTime: 30_000,
  });
}
