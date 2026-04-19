import { useEffect, useRef, useMemo } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useAuthStore } from '@/stores/auth.store';

// ---------------------------------------------------------------------------
// Yjs collaboration hook for Brief documents
//
// Creates a Y.Doc and connects a WebsocketProvider to brief-api's /ws
// endpoint. The provider handles the sync protocol, awareness, and
// automatic reconnection. Returns the doc and provider so the Tiptap
// Collaboration + CollaborationCursor extensions can bind to them.
// ---------------------------------------------------------------------------

const CURSOR_COLORS = [
  '#FF6B6B', // red
  '#4ECDC4', // teal
  '#45B7D1', // sky blue
  '#96CEB4', // sage
  '#FFEAA7', // yellow
  '#DDA0DD', // plum
  '#98D8C8', // mint
  '#F7DC6F', // gold
];

function pickColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]!;
}

export interface CollaborationState {
  ydoc: Y.Doc;
  provider: WebsocketProvider | null;
  isConnected: boolean;
  isSynced: boolean;
}

/**
 * Manages a Yjs document and WebSocket provider for a given document ID.
 *
 * Returns a stable ydoc reference so Tiptap's Collaboration extension can bind
 * to it during editor initialization. The provider connects to the brief-api
 * WebSocket endpoint at /brief/ws?doc=<docId>.
 *
 * When `docId` is null/undefined, no connection is made (useful during initial
 * loading when the document ID is not yet known).
 */
export function useCollaboration(docId: string | null | undefined) {
  const user = useAuthStore((s) => s.user);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  // Create a stable Y.Doc for the lifetime of the docId
  const ydoc = useMemo(() => {
    if (ydocRef.current) {
      ydocRef.current.destroy();
    }
    const doc = new Y.Doc();
    ydocRef.current = doc;
    return doc;
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!docId || !user) return;

    // Build the WebSocket URL. In production this is proxied through nginx
    // at /brief/ws. In development it may point to a different host.
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/brief/ws`;

    const provider = new WebsocketProvider(wsUrl, docId, ydoc, {
      connect: true,
      // The y-websocket provider appends ?doc=<roomName> by default through
      // the room name parameter. No extra query wiring needed.
    });

    // Set awareness local state so other users see cursor info
    provider.awareness.setLocalStateField('user', {
      name: user.display_name,
      color: pickColor(user.id),
      userId: user.id,
    });

    providerRef.current = provider;

    return () => {
      provider.disconnect();
      provider.destroy();
      providerRef.current = null;
    };
  }, [docId, user, ydoc]);

  // Clean up ydoc on unmount
  useEffect(() => {
    return () => {
      if (ydocRef.current) {
        ydocRef.current.destroy();
        ydocRef.current = null;
      }
    };
  }, []);

  return {
    ydoc,
    provider: providerRef.current,
  };
}
