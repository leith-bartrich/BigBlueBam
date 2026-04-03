import { useState, useRef, useEffect } from 'react';
import { Bot, Send } from 'lucide-react';
import { cn, formatMessageTime } from '@/lib/utils';

interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

interface AgentTextSidebarProps {
  callId: string;
  messages: AgentMessage[];
  onSendMessage: (content: string) => void;
  isAgentTyping: boolean;
}

export function AgentTextSidebar({
  callId: _callId,
  messages,
  onSendMessage,
  isAgentTyping,
}: AgentTextSidebarProps) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change or agent starts typing
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isAgentTyping]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setDraft('');
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-full w-80 border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-purple-100 dark:bg-purple-900/40">
          <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          AI Agent
        </span>
        <span className="ml-auto text-[10px] uppercase font-semibold text-zinc-400 dark:text-zinc-500 tracking-wide">
          Text mode
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !isAgentTyping && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-8">
            Send a message to the AI agent.
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex flex-col gap-0.5 max-w-[90%]',
              msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start',
            )}
          >
            <div
              className={cn(
                'rounded-lg px-3 py-2 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200',
              )}
            >
              {msg.content}
            </div>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 px-1">
              {formatMessageTime(msg.timestamp)}
            </span>
          </div>
        ))}

        {/* Agent typing indicator */}
        {isAgentTyping && (
          <div className="flex items-center gap-2 mr-auto">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-900/40">
              <Bot className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex gap-0.5 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse-dot"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse-dot"
                style={{ animationDelay: '200ms' }}
              />
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse-dot"
                style={{ animationDelay: '400ms' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message AI agent..."
          className={cn(
            'flex-1 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800',
            'px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200',
            'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          )}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
            draft.trim()
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed',
          )}
          title="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
