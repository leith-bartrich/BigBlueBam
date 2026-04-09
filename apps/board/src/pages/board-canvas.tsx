import { useState } from 'react';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { BoardToolbar } from '@/components/canvas/board-toolbar';
import { ChatPanel } from '@/components/canvas/chat-panel';
import { PresenceBar } from '@/components/canvas/presence-bar';

interface BoardCanvasPageProps {
  boardId: string;
  onNavigate: (path: string) => void;
}

export function BoardCanvasPage({ boardId, onNavigate }: BoardCanvasPageProps) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="fixed inset-0 flex flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Canvas fills entire viewport */}
      <div className="flex-1 relative">
        <Tldraw
          persistenceKey={`board-${boardId}`}
          onMount={(editor) => {
            // Set touch-action: none for multitouch support
            const container = editor.getContainer();
            if (container) {
              container.style.touchAction = 'none';
            }
          }}
        />

        {/* Floating toolbar on top of canvas */}
        <BoardToolbar
          boardId={boardId}
          onNavigate={onNavigate}
          onToggleChat={() => setChatOpen((prev) => !prev)}
          chatOpen={chatOpen}
        />

        {/* Presence bar overlay */}
        <PresenceBar boardId={boardId} />

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
