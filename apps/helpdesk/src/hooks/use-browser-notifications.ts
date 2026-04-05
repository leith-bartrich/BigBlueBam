import { useEffect } from 'react';
import { ws } from '@/lib/websocket';
import { useAuthStore } from '@/stores/auth.store';

const BASE_PATH = '/helpdesk';

interface TicketMessagePayload {
  ticket_id: string;
  ticket_number?: number;
  author_id?: string;
  author_user_id?: string;
  author_name?: string;
  body?: string;
  content?: string;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}\u2026`;
}

/**
 * Listen for new ticket messages and show browser notifications when the
 * tab is not focused. Should be called once at the app root when the user
 * is authenticated.
 */
export function useBrowserNotifications() {
  const currentUserId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (!currentUserId) return;

    const unsubscribe = ws.on('ticket.message.created', (event) => {
      // Don't show if the tab is focused.
      if (!document.hidden) return;
      // Don't show if permission hasn't been granted.
      if (Notification.permission !== 'granted') return;

      const payload = event.payload as TicketMessagePayload;

      // Don't notify for the customer's own messages.
      const authorId = payload.author_user_id ?? payload.author_id;
      if (authorId && authorId === currentUserId) return;

      const ticketId = payload.ticket_id;
      if (!ticketId) return;

      const ticketLabel = payload.ticket_number
        ? `#${payload.ticket_number}`
        : `#${ticketId.slice(0, 8)}`;
      const rawBody = payload.body ?? payload.content ?? '';
      const body = truncate(rawBody.replace(/\s+/g, ' ').trim(), 100) || 'New message';

      try {
        const notification = new Notification(`New message on ticket ${ticketLabel}`, {
          body,
          tag: `ticket-${ticketId}`,
        });
        notification.onclick = () => {
          window.focus();
          const path = `${BASE_PATH}/tickets/${ticketId}`;
          if (window.location.pathname !== path) {
            window.history.pushState(null, '', path);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
          notification.close();
        };
      } catch {
        // Ignore notification construction failures.
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUserId]);
}
