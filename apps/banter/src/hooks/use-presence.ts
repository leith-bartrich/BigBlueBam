import { useEffect, useCallback, useRef } from 'react';
import { ws } from '@/lib/websocket';
import { useAuthStore } from '@/stores/auth.store';

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Track and broadcast user presence.
 * - Sets presence to "online" on activity
 * - Sets presence to "idle" after 5 minutes of no interaction
 * - Sends presence updates via WebSocket
 */
export function usePresence() {
  const user = useAuthStore((s) => s.user);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStatus = useRef<string>('online');

  const setPresence = useCallback(
    (status: 'online' | 'idle' | 'dnd') => {
      if (currentStatus.current === status) return;
      currentStatus.current = status;
      ws.sendMessage({ type: 'presence.update', status });
    },
    [],
  );

  const resetIdleTimer = useCallback(() => {
    if (currentStatus.current === 'dnd') return; // Don't override DND

    setPresence('online');

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      if (currentStatus.current !== 'dnd') {
        setPresence('idle');
      }
    }, IDLE_TIMEOUT);
  }, [setPresence]);

  useEffect(() => {
    if (!user) return;

    // Set initial presence
    setPresence('online');
    resetIdleTimer();

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    for (const event of events) {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    }

    return () => {
      for (const event of events) {
        window.removeEventListener(event, resetIdleTimer);
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [user, setPresence, resetIdleTimer]);

  return { setPresence };
}
