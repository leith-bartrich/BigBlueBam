import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ws } from '@/lib/websocket';

/**
 * List-level realtime hook for the tickets list page.
 *
 * First-pass simpler approach: join a global "tickets" room while the list
 * page is open, and invalidate the tickets list query on any ticket event.
 *
 * A future enhancement would be to subscribe to a per-user channel
 * (e.g. `user:${userId}`) so the backend can selectively broadcast only
 * events for tickets the user is authorized to see. For now, the backend
 * can broadcast to a shared "tickets" room scoped per-org, and the server
 * itself enforces authorization on the HTTP query when we invalidate.
 */
export function useRealtimeTickets() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const room = 'tickets';
    ws.joinRoom(room);

    const unsubMessage = ws.on('ticket.message.created', () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets'] });
    });

    const unsubStatus = ws.on('ticket.status.changed', () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets'] });
    });

    const unsubCreated = ws.on('ticket.created', () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk', 'tickets'] });
    });

    return () => {
      ws.leaveRoom(room);
      unsubMessage();
      unsubStatus();
      unsubCreated();
    };
  }, [queryClient]);
}
