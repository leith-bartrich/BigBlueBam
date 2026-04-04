import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ws } from '@/lib/websocket';

/**
 * Subscribe to a ticket room via WebSocket and invalidate the ticket
 * query when messages or status changes arrive.
 */
export function useRealtimeTicket(ticketId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ticketId) return;

    const room = `ticket:${ticketId}`;
    ws.joinRoom(room);

    const unsubMessage = ws.on('ticket.message.created', (event) => {
      const payload = event.payload as { ticket_id: string };
      if (payload.ticket_id === ticketId) {
        queryClient.invalidateQueries({ queryKey: ['helpdesk-ticket', ticketId] });
      }
    });

    const unsubStatus = ws.on('ticket.status.changed', (event) => {
      const payload = event.payload as { ticket_id: string };
      if (payload.ticket_id === ticketId) {
        queryClient.invalidateQueries({ queryKey: ['helpdesk-ticket', ticketId] });
        queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets'] });
      }
    });

    return () => {
      ws.leaveRoom(room);
      unsubMessage();
      unsubStatus();
    };
  }, [ticketId, queryClient]);
}
