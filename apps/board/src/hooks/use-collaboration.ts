import { useEffect, useRef, useCallback, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { diffElements, reconcileElements } from '@/lib/scene-sync';
import { useBoardWs, type RemoteCursor } from './use-board-ws';

export interface CollaboratorCursor {
  x: number;
  y: number;
  color: string;
  name: string;
}

interface UseCollaborationReturn {
  collaborators: { id: string; name: string; color: string; avatar_url?: string | null }[];
  collaboratorCursors: Map<string, CollaboratorCursor>;
  isConnected: boolean;
  handleChange: (elements: readonly any[], appState: Record<string, any>, files: any) => void;
  handlePointerUpdate: (payload: { pointer: { x: number; y: number }; button: 'up' | 'down' }) => void;
}

const CURSOR_STALE_MS = 10_000;

export function useCollaboration(
  boardId: string,
  excalidrawAPI: ExcalidrawImperativeAPI | null,
): UseCollaborationReturn {
  const lastElementsRef = useRef<readonly any[]>([]);
  const [collaboratorCursors, setCollaboratorCursors] = useState<Map<string, CollaboratorCursor>>(
    () => new Map(),
  );
  const sceneLoadedRef = useRef(false);

  // ── Remote scene updates ─────────────────────────────────────────────────
  const handleRemoteUpdate = useCallback(
    (remoteElements: any[]) => {
      if (!excalidrawAPI) return;
      const localElements = excalidrawAPI.getSceneElements();
      const merged = reconcileElements(localElements, remoteElements);
      excalidrawAPI.updateScene({ elements: merged });
      lastElementsRef.current = merged;
    },
    [excalidrawAPI],
  );

  // ── Remote cursor updates ────────────────────────────────────────────────
  const handleCursorUpdate = useCallback((cursor: RemoteCursor) => {
    setCollaboratorCursors((prev) => {
      const next = new Map(prev);
      next.set(cursor.userId, {
        x: cursor.x,
        y: cursor.y,
        color: cursor.color,
        name: cursor.name,
      });
      return next;
    });
  }, []);

  // ── WebSocket connection ─────────────────────────────────────────────────
  const { status, collaborators, sendSceneUpdate, sendCursorUpdate } = useBoardWs({
    boardId,
    onRemoteUpdate: handleRemoteUpdate,
    onCursorUpdate: handleCursorUpdate,
  });

  // ── Load initial scene from server ───────────────────────────────────────
  useEffect(() => {
    if (!excalidrawAPI || sceneLoadedRef.current) return;
    sceneLoadedRef.current = true;

    (async () => {
      try {
        const res = await fetch(`/board/api/v1/boards/${boardId}/scene`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        const elements = data.elements ?? [];
        const appState = data.appState ?? {};
        excalidrawAPI.updateScene({ elements, appState });
        lastElementsRef.current = elements;
      } catch {
        // Scene load failed — start with empty canvas
      }
    })();
  }, [boardId, excalidrawAPI]);

  // ── Stale cursor cleanup ─────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setCollaboratorCursors((prev) => {
        // We don't track timestamps in CollaboratorCursor itself to keep it light.
        // Stale cursors are removed when the user leaves (user_left event).
        // This interval just forces a re-render so the CursorOverlay can fade.
        return new Map(prev);
      });
    }, CURSOR_STALE_MS);
    return () => clearInterval(interval);
  }, []);

  // ── Save scene on page unload ────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!excalidrawAPI) return;
      const elements = excalidrawAPI.getSceneElements();
      const body = JSON.stringify({ elements });
      navigator.sendBeacon(
        `/board/api/v1/boards/${boardId}/scene`,
        new Blob([body], { type: 'application/json' }),
      );
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [boardId, excalidrawAPI]);

  // ── Local change handler (wired to Excalidraw onChange) ──────────────────
  const handleChange = useCallback(
    (elements: readonly any[], _appState: Record<string, any>, _files: any) => {
      const changed = diffElements(lastElementsRef.current, elements);
      if (changed.length > 0) {
        sendSceneUpdate(changed);
      }
      lastElementsRef.current = elements;
    },
    [sendSceneUpdate],
  );

  // ── Pointer update handler (wired to Excalidraw onPointerUpdate) ────────
  const handlePointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number }; button: 'up' | 'down' }) => {
      sendCursorUpdate(payload.pointer, payload.button);
    },
    [sendCursorUpdate],
  );

  return {
    collaborators,
    collaboratorCursors,
    isConnected: status === 'connected',
    handleChange,
    handlePointerUpdate,
  };
}
