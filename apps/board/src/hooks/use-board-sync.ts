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

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { reconcileElements } from '@/lib/scene-sync';

export type BoardConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function useBoardSync(
  boardId: string,
  getAPI: () => ExcalidrawImperativeAPI | null,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const lastElementsRef = useRef<readonly any[]>([]);
  const joinedRef = useRef(false);
  const mountedRef = useRef(true);
  const applyingRemoteRef = useRef(false);
  const [status, setStatus] = useState<BoardConnectionStatus>('connecting');
  // Track distinct collaborator userIds seen via cursor_update / user_left
  // so the toolbar can show a live "N editors" count without each caller
  // wiring its own collaborators map.
  const [peerCount, setPeerCount] = useState(0);
  const peersRef = useRef<Set<string>>(new Set());

  // Buffer: accumulate remote elements between apply ticks
  const pendingRemoteRef = useRef<any[]>([]);

  // Last seen Redis-stream sequence id for scene_update events. Used by
  // the reconnect-replay protocol: when the WS drops and reconnects, we
  // send this back on join_board and the server replays everything that
  // landed after it. Closes the "edits during reconnect gap silently
  // dropped" window. Cleared only when the user navigates away from the
  // board entirely; preserved across WS drop+reconnect cycles.
  const lastSeenSeqRef = useRef<string | null>(null);

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
    // Don't wipe pendingRemoteRef across reconnects — the server's
    // replay-since-last-seen-seq protocol will refill it with everything
    // we missed. Wiping was the previous-version data-loss path on a
    // reconnect that overlapped a peer's edit. Initial mount also lands
    // here; pendingRemoteRef defaults to [] from the useRef init so
    // there's nothing stale to clear on first connect either.

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
        setStatus('connected');
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
            // Echo last_seen_seq back so the server can replay any peer
            // edits that landed during a reconnect gap. On a fresh
            // session lastSeenSeqRef is null and the server skips
            // replay; on a reconnect it's the id of the last
            // scene_update we saw.
            ws.send(
              JSON.stringify({
                type: 'join_board',
                boardId,
                last_seen_seq: lastSeenSeqRef.current ?? undefined,
              }),
            );
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
            if (typeof msg.seq === 'string') {
              lastSeenSeqRef.current = msg.seq;
            }
            if (!Array.isArray(remoteElements) || remoteElements.length === 0) break;
            // Buffer — don't apply immediately (browser may throttle rendering)
            pendingRemoteRef.current.push(...remoteElements);
            break;
          }

          case 'replay': {
            // Server response to join_board with last_seen_seq. Each
            // entry is a scene_update event the server already broadcast
            // while we were disconnected. Apply them in order so the
            // local state catches up before we accept new realtime
            // updates from peers.
            const events = msg.data?.events;
            if (!Array.isArray(events)) break;
            for (const ev of events) {
              if (ev?.type === 'scene_update') {
                if (typeof ev.seq === 'string') {
                  lastSeenSeqRef.current = ev.seq;
                }
                const els = ev.data?.elements;
                if (Array.isArray(els) && els.length > 0) {
                  pendingRemoteRef.current.push(...els);
                }
              }
            }
            break;
          }

          case 'cursor_update': {
            // Update the collaborator pointer in Excalidraw's collaborators Map.
            // When tool is "laser", Excalidraw natively renders the laser trail.
            const d = msg.data;
            if (!d?.userId || !d?.pointer) break;
            const api = getAPI();
            if (!api) break;

            // Track peer set so the toolbar badge reflects live editors
            if (!peersRef.current.has(d.userId)) {
              peersRef.current.add(d.userId);
              setPeerCount(peersRef.current.size);
            }

            // Create a NEW Map so Excalidraw detects the change
            const next = new Map(collaboratorsRef.current);
            next.set(d.userId, {
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
            collaboratorsRef.current = next;

            // Push updated collaborators to Excalidraw. The Map's value
            // type is intentionally `any` at the ref level (we build
            // plain objects from WS messages); Excalidraw's API signature
            // expects its Collaborator-shaped Map, so cast through
            // Parameters to keep tsc happy without importing the full
            // internal Collaborator type.
            api.updateScene({
              collaborators: next as unknown as Parameters<typeof api.updateScene>[0]['collaborators'],
            });
            break;
          }

          case 'user_left': {
            const leftId = msg.data?.id;
            if (leftId) {
              if (peersRef.current.delete(leftId)) {
                setPeerCount(peersRef.current.size);
              }
              const next = new Map(collaboratorsRef.current);
              next.delete(leftId);
              collaboratorsRef.current = next;
              const api = getAPI();
              if (api) {
                api.updateScene({
                  collaborators: next as unknown as Parameters<typeof api.updateScene>[0]['collaborators'],
                });
              }
            }
            break;
          }
        }
      });

      ws.addEventListener('close', () => {
        clearInterval(pingTimer);
        joinedRef.current = false;
        peersRef.current.clear();
        setPeerCount(0);
        setStatus('disconnected');
        if (!mountedRef.current) return;
        const delay = Math.min(1000 * 2 ** retries, 30_000);
        retries++;
        reconnectTimer = setTimeout(() => {
          setStatus('connecting');
          connect();
        }, delay);
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
  const lastPointerSentRef = useRef(0);
  const sendPointer = useCallback(
    (payload: { pointer: { x: number; y: number }; button: 'up' | 'down'; pointersMap?: Map<number, any> }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !joinedRef.current) return;

      // Throttle: max 20 updates/sec
      const now = Date.now();
      if (now - lastPointerSentRef.current < 50) return;
      lastPointerSentRef.current = now;

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

  return { sendChanges, sendPointer, status, peerCount };
}
