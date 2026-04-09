/**
 * Lightweight WebSocket hook for real-time Board drawing sync.
 *
 * Connects to /board/ws, joins a room for the boardId, and:
 * - Sends element diffs when the local scene changes
 * - Buffers incoming remote updates and applies them on a 500ms interval
 *   (works around browser throttling of unfocused tabs)
 * - Forces a re-apply when the tab becomes visible
 *
 * Does NOT touch localStorage or server persistence — those stay
 * in the canvas page's own onChange handler.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { reconcileElements } from '@/lib/scene-sync';

export function useBoardSync(
  boardId: string,
  getAPI: () => ExcalidrawImperativeAPI | null,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const lastElementsRef = useRef<readonly any[]>([]);
  const joinedRef = useRef(false);
  const mountedRef = useRef(true);
  const applyingRemoteRef = useRef(false);

  // Buffer: accumulate remote elements between apply ticks
  const pendingRemoteRef = useRef<any[]>([]);

  // Remote collaborator pointers (for laser + cursor rendering)
  const collaboratorsRef = useRef<Map<string, any>>(new Map());

  // Apply buffered remote updates to Excalidraw
  const applyPending = useCallback(() => {
    const pending = pendingRemoteRef.current;
    if (pending.length === 0) return;
    const api = getAPI();
    if (!api) return;

    // Drain the buffer
    pendingRemoteRef.current = [];

    applyingRemoteRef.current = true;
    try {
      const local = api.getSceneElements() as any[];
      const merged = reconcileElements(local, pending);
      api.updateScene({ elements: merged });
      lastElementsRef.current = merged;
    } finally {
      setTimeout(() => {
        applyingRemoteRef.current = false;
      }, 100);
    }
  }, [getAPI]);

  // ── Connect + apply interval ──────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    joinedRef.current = false;
    pendingRemoteRef.current = [];

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/board/ws`;
    let ws: WebSocket;
    let pingTimer: ReturnType<typeof setInterval>;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let retries = 0;

    // Apply buffered updates every 500ms — survives browser throttling
    const applyTimer = setInterval(() => {
      applyPending();
    }, 500);

    // Also apply immediately when tab becomes visible
    function handleVisibility() {
      if (!document.hidden) {
        applyPending();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    function connect() {
      if (!mountedRef.current) return;
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        retries = 0;
      });

      ws.addEventListener('message', (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (msg.type) {
          case 'connected':
            ws.send(JSON.stringify({ type: 'join_board', boardId }));
            break;

          case 'room_state':
            joinedRef.current = true;
            clearInterval(pingTimer);
            pingTimer = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
              }
            }, 30_000);
            break;

          case 'scene_update': {
            const remoteElements = msg.data?.elements;
            if (!Array.isArray(remoteElements) || remoteElements.length === 0) break;
            // Buffer — don't apply immediately (browser may throttle rendering)
            pendingRemoteRef.current.push(...remoteElements);
            break;
          }

          case 'cursor_update': {
            // Update the collaborator pointer in Excalidraw's collaborators Map.
            // When tool is "laser", Excalidraw natively renders the laser trail.
            const d = msg.data;
            if (!d?.userId || !d?.pointer) break;
            const api = getAPI();
            if (!api) break;

            collaboratorsRef.current.set(d.userId, {
              pointer: {
                x: d.pointer.x,
                y: d.pointer.y,
                tool: d.tool ?? 'pointer',
              },
              button: d.button ?? 'up',
              username: d.username ?? 'User',
              color: { background: d.color ?? '#3b82f6', stroke: d.color ?? '#3b82f6' },
              isCurrentUser: false,
            });

            // Push updated collaborators to Excalidraw
            api.updateScene({
              collaborators: collaboratorsRef.current,
            });
            break;
          }

          case 'user_left': {
            const leftId = msg.data?.id;
            if (leftId) {
              collaboratorsRef.current.delete(leftId);
              const api = getAPI();
              if (api) {
                api.updateScene({ collaborators: collaboratorsRef.current });
              }
            }
            break;
          }
        }
      });

      ws.addEventListener('close', () => {
        clearInterval(pingTimer);
        joinedRef.current = false;
        if (!mountedRef.current) return;
        const delay = Math.min(1000 * 2 ** retries, 30_000);
        retries++;
        reconnectTimer = setTimeout(connect, delay);
      });

      ws.addEventListener('error', () => {
        // close fires after error
      });
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearInterval(pingTimer);
      clearInterval(applyTimer);
      clearTimeout(reconnectTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (ws && ws.readyState <= WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [boardId, getAPI, applyPending]);

  // ── Send local changes ────────────────────────────────────────────
  // Excalidraw mutates elements in-place during drawing (version only
  // bumps on mouse-up). To sync in-progress strokes we store the latest
  // elements and flush diffs on a 150ms throttle so the remote side sees
  // live drawing without flooding the WS on every pixel.
  const pendingSendRef = useRef<readonly any[] | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const snapshotRef = useRef<Map<string, string>>(new Map());

  const flushSend = useCallback(() => {
    const elements = pendingSendRef.current;
    pendingSendRef.current = null;
    if (!elements) return;
    if (applyingRemoteRef.current) return;

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !joinedRef.current) return;

    const changed: any[] = [];
    const nextSnapshot = new Map<string, string>();
    for (const el of elements) {
      const json = JSON.stringify(el);
      nextSnapshot.set(el.id, json);
      if (snapshotRef.current.get(el.id) !== json) {
        changed.push(el);
      }
    }
    snapshotRef.current = nextSnapshot;

    if (changed.length === 0) return;
    lastElementsRef.current = elements;
    ws.send(JSON.stringify({ type: 'scene_update', boardId, elements: changed }));
  }, [boardId]);

  const sendChanges = useCallback(
    (elements: readonly any[]) => {
      pendingSendRef.current = elements;
      // Throttle: flush at most every 150ms
      if (!sendTimerRef.current) {
        sendTimerRef.current = setTimeout(() => {
          sendTimerRef.current = undefined;
          flushSend();
        }, 150);
      }
    },
    [flushSend],
  );

  // ── Send pointer updates (for laser + cursor) ─────────────────────
  const sendPointer = useCallback(
    (payload: { pointer: { x: number; y: number }; button: 'up' | 'down'; pointersMap?: Map<number, any> }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !joinedRef.current) return;

      // Determine active tool from Excalidraw's app state
      const api = getAPI();
      const appState = api?.getAppState?.();
      const tool = appState?.activeTool?.type ?? 'pointer';

      ws.send(JSON.stringify({
        type: 'cursor_update',
        boardId,
        pointer: payload.pointer,
        button: payload.button,
        tool,
      }));
    },
    [boardId, getAPI],
  );

  // Clean up send timer on unmount
  useEffect(() => {
    return () => clearTimeout(sendTimerRef.current);
  }, []);

  return { sendChanges, sendPointer };
}
