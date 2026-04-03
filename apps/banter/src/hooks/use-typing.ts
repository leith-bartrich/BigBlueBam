import { useCallback, useRef, useEffect, useState } from 'react';
import { ws } from '@/lib/websocket';

const TYPING_INTERVAL = 3000; // Send typing event every 3 seconds
const TYPING_TIMEOUT = 5000; // Expire after 5 seconds of no event

/**
 * Send typing indicator for a channel.
 * Call `sendTyping()` whenever the user types. It throttles to every 3s.
 */
export function useSendTyping(channelId: string) {
  const lastSent = useRef(0);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current < TYPING_INTERVAL) return;
    lastSent.current = now;

    ws.sendMessage({
      type: 'typing.start',
      channel_id: channelId,
    });
  }, [channelId]);

  return { sendTyping };
}

interface TypingUser {
  userId: string;
  displayName: string;
  expiresAt: number;
}

/**
 * Listen for typing indicators on a channel.
 * Returns list of currently typing display names.
 */
export function useTypingIndicators(channelId: string) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  useEffect(() => {
    const unsubscribe = ws.on('typing.start', (event) => {
      const payload = event.payload as {
        channel_id: string;
        user_id: string;
        display_name: string;
      };
      if (payload.channel_id !== channelId) return;

      setTypingUsers((prev) => {
        const now = Date.now();
        // Remove expired and update/add this user
        const filtered = prev.filter(
          (u) => u.expiresAt > now && u.userId !== payload.user_id,
        );
        return [
          ...filtered,
          {
            userId: payload.user_id,
            displayName: payload.display_name,
            expiresAt: now + TYPING_TIMEOUT,
          },
        ];
      });
    });

    // Cleanup timer to expire stale typing indicators
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => prev.filter((u) => u.expiresAt > now));
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [channelId]);

  return typingUsers.map((u) => u.displayName);
}
