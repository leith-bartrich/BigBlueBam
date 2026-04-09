import { useEffect, useRef, useCallback, useState } from 'react';

// ── Message types ────────────────────────────────────────────────────────────

interface JoinBoardMsg {
  type: 'join_board';
  boardId: string;
}

interface SceneUpdateMsg {
  type: 'scene_update';
  boardId: string;
  elements: any[];
}

interface CursorUpdateMsg {
  type: 'cursor_update';
  boardId: string;
  pointer: { x: number; y: number };
  button: 'up' | 'down';
}

interface PingMsg {
  type: 'ping';
}

type OutgoingMessage = JoinBoardMsg | SceneUpdateMsg | CursorUpdateMsg | PingMsg;

export interface RemoteUser {
  id: string;
  name: string;
  color: string;
  avatar_url?: string | null;
}

export interface RemoteCursor {
  userId: string;
  x: number;
  y: number;
  color: string;
  name: string;
  button: 'up' | 'down';
  lastUpdated: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseBoardWsOptions {
  boardId: string;
  onRemoteUpdate: (elements: any[]) => void;
  onCursorUpdate: (cursor: RemoteCursor) => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBoardWs({
  boardId,
  onRemoteUpdate,
  onCursorUpdate,
}: UseBoardWsOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [collaborators, setCollaborators] = useState<RemoteUser[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pingTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const mountedRef = useRef(true);

  // Keep callbacks in refs so reconnect logic always sees latest
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  onRemoteUpdateRef.current = onRemoteUpdate;
  const onCursorUpdateRef = useRef(onCursorUpdate);
  onCursorUpdateRef.current = onCursorUpdate;

  const send = useCallback((msg: OutgoingMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/board/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus('connecting');

    ws.addEventListener('open', () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      setStatus('connected');
      retriesRef.current = 0;
      ws.send(JSON.stringify({ type: 'join_board', boardId }));

      // Start ping interval
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30_000);
    });

    ws.addEventListener('message', (event) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'room_state':
          setCollaborators(msg.users ?? []);
          break;
        case 'user_joined':
          setCollaborators((prev) => {
            if (prev.some((u) => u.id === msg.user.id)) return prev;
            return [...prev, msg.user];
          });
          break;
        case 'user_left':
          setCollaborators((prev) => prev.filter((u) => u.id !== msg.userId));
          break;
        case 'scene_update':
          onRemoteUpdateRef.current(msg.elements);
          break;
        case 'cursor_update':
          onCursorUpdateRef.current({
            userId: msg.userId,
            x: msg.pointer.x,
            y: msg.pointer.y,
            color: msg.color ?? '#3b82f6',
            name: msg.name ?? 'Unknown',
            button: msg.button ?? 'up',
            lastUpdated: Date.now(),
          });
          break;
        case 'pong':
          // heartbeat acknowledged
          break;
      }
    });

    ws.addEventListener('close', () => {
      clearInterval(pingTimerRef.current);
      if (!mountedRef.current) return;
      setStatus('disconnected');
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      // error always precedes close, so reconnect happens in close handler
    });
  }, [boardId, send]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000);
    retriesRef.current += 1;
    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(connect, delay);
  }, [connect]);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      clearInterval(pingTimerRef.current);
      const ws = wsRef.current;
      if (ws) {
        ws.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendSceneUpdate = useCallback(
    (elements: any[]) => {
      send({ type: 'scene_update', boardId, elements });
    },
    [send, boardId],
  );

  const sendCursorUpdate = useCallback(
    (pointer: { x: number; y: number }, button: 'up' | 'down') => {
      send({ type: 'cursor_update', boardId, pointer, button });
    },
    [send, boardId],
  );

  return {
    status,
    collaborators,
    sendSceneUpdate,
    sendCursorUpdate,
  };
}
