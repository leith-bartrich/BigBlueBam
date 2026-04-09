import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { useChatMessages, useSendMessage } from '@/hooks/use-chat';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/common/avatar';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  boardId: string;
  open: boolean;
  onClose: () => void;
}

export function ChatPanel({ boardId, open, onClose }: ChatPanelProps) {
  const { data } = useChatMessages(open ? boardId : undefined);
  const messages = data?.data ?? [];
  const sendMessage = useSendMessage(boardId);
  const user = useAuthStore((s) => s.user);

  const [body, setBody] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed);
    setBody('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  return (
    <div className="absolute top-12 right-3 bottom-3 w-80 z-[250] flex flex-col rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border border-zinc-200 dark:border-zinc-700 shadow-xl animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Chat</h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4 custom-scrollbar"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-zinc-400">No messages yet</p>
            <p className="text-xs text-zinc-400 mt-1">Start a conversation with your collaborators</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwnMessage = msg.author_id === user?.id;
          return (
            <div key={msg.id} className="flex gap-2">
              {!isOwnMessage && (
                <Avatar name={msg.author_name} size="sm" className="mt-0.5 shrink-0" />
              )}
              <div className={cn('flex-1 min-w-0', isOwnMessage && 'ml-8')}>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {isOwnMessage ? 'You' : msg.author_name}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {formatRelativeTime(msg.created_at)}
                  </span>
                </div>
                <p className={cn(
                  'text-sm mt-0.5 rounded-lg px-3 py-1.5 inline-block max-w-full break-words',
                  isOwnMessage
                    ? 'bg-primary-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100',
                )}>
                  {msg.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <div className="px-3 py-3 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 border-none outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleSend}
            disabled={!body.trim() || sendMessage.isPending}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
