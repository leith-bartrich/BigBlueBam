import { useState, useCallback, useRef, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { BoardToolbar } from '@/components/canvas/board-toolbar';
import { ChatPanel } from '@/components/canvas/chat-panel';
import { ConnectionStatusBadge } from '@/components/canvas/connection-status-badge';
import { useBoardSync } from '@/hooks/use-board-sync';

interface BoardCanvasPageProps {
  boardId: string;
  onNavigate: (path: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Local persistence (reliable — survives refresh)                    */
/* ------------------------------------------------------------------ */

const STORAGE_KEY_PREFIX = 'excalidraw-board-';

function loadSavedScene(boardId: string) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + boardId);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.elements?.length > 0) return parsed;
    }
  } catch {
    /* ignore corrupt data */
  }
  return null;
}

let saveTimer: ReturnType<typeof setTimeout>;
function debouncedSave(boardId: string, elements: readonly any[], appState: Record<string, any>, files: any) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      // Only save app state fields that matter for restoring the view
      const cleanState = {
        viewBackgroundColor: appState.viewBackgroundColor,
        gridSize: appState.gridSize,
      };
      localStorage.setItem(
        STORAGE_KEY_PREFIX + boardId,
        JSON.stringify({ elements, appState: cleanState, files }),
      );
    } catch {
      /* localStorage full or unavailable */
    }
  }, 500);
}

/* ------------------------------------------------------------------ */
/*  Server persistence (best-effort — for collaboration & backup)      */
/* ------------------------------------------------------------------ */

let serverSaveTimer: ReturnType<typeof setTimeout>;
function debouncedServerSave(boardId: string, elements: readonly any[]) {
  clearTimeout(serverSaveTimer);
  serverSaveTimer = setTimeout(() => {
    fetch(`/board/api/v1/boards/${boardId}/scene`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ elements }),
    }).catch(() => {/* ignore */});
  }, 3000);
}

function getTheme(): 'dark' | 'light' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BoardCanvasPage({ boardId, onNavigate }: BoardCanvasPageProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [isDark] = useState(() => getTheme() === 'dark');
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const getAPI = useCallback(() => excalidrawAPIRef.current, []);

  // Real-time sync via WebSocket (layered on top of localStorage persistence)
  const { sendChanges, sendPointer, status, peerCount } = useBoardSync(boardId, getAPI);

  // Load initial data: prefer localStorage, fall back to server, then empty
  const [initialData] = useState(() => {
    const local = loadSavedScene(boardId);
    if (local) return local;
    return { elements: [], appState: { viewBackgroundColor: '#ffffff' } };
  });

  // Also try loading from server (in case another device saved there)
  useEffect(() => {
    const api = excalidrawAPIRef.current;
    if (!api) return;

    const localHasContent = (initialData?.elements?.length ?? 0) > 0;
    if (localHasContent) return; // local data takes priority

    fetch(`/board/api/v1/boards/${boardId}/scene`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.elements?.length > 0 && excalidrawAPIRef.current) {
          excalidrawAPIRef.current.updateScene({ elements: data.elements });
        }
      })
      .catch(() => {/* ignore */});
  }, [boardId, initialData]);

  const handleChange = useCallback(
    (elements: readonly any[], appState: Record<string, any>, files: any) => {
      debouncedSave(boardId, elements, appState, files);
      debouncedServerSave(boardId, elements);
      sendChanges(elements);
    },
    [boardId, sendChanges],
  );

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="flex-1 relative">
        <div style={{ height: '100%', width: '100%' }}>
          <Excalidraw
            excalidrawAPI={(api) => {
              excalidrawAPIRef.current = api;
            }}
            initialData={initialData}
            onChange={handleChange}
            onPointerUpdate={sendPointer}
            theme={isDark ? 'dark' : 'light'}
            validateEmbeddable
          />
        </div>

        {/* Floating toolbar on top of canvas */}
        <BoardToolbar
          boardId={boardId}
          onNavigate={onNavigate}
          onToggleChat={() => setChatOpen((prev) => !prev)}
          chatOpen={chatOpen}
        />

        {/* Real-time connection + peer-count indicator */}
        <ConnectionStatusBadge status={status} peerCount={peerCount} />

        {/* Chat panel overlay */}
        <ChatPanel
          boardId={boardId}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      </div>
    </div>
  );
}
