import { useState, useRef, useEffect } from 'react';
import { useTicket, usePostMessage, useReopenTicket } from '@/hooks/use-tickets';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/common/button';
import { StatusBadge, PriorityBadge } from '@/components/common/badge';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { ArrowLeft, Loader2, Send, RotateCcw } from 'lucide-react';

interface TicketDetailPageProps {
  ticketId: string;
  onNavigate: (path: string) => void;
}

export function TicketDetailPage({ ticketId, onNavigate }: TicketDetailPageProps) {
  const { data: ticket, isLoading, error } = useTicket(ticketId);
  const postMessage = usePostMessage(ticketId);
  const reopenTicket = useReopenTicket(ticketId);
  const { user } = useAuthStore();

  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isClosedOrResolved = ticket?.status === 'resolved' || ticket?.status === 'closed';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    try {
      await postMessage.mutateAsync({ body: replyText.trim() });
      setReplyText('');
    } catch {
      // error handled by mutation
    }
  };

  const handleReopen = async () => {
    try {
      await reopenTicket.mutateAsync();
    } catch {
      // error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div>
        <button
          onClick={() => onNavigate('/tickets')}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tickets
        </button>
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
          Failed to load ticket. It may not exist or you may not have access.
        </div>
      </div>
    );
  }

  // Build a timeline combining messages and status changes
  type TimelineItem =
    | { kind: 'message'; data: (typeof ticket.messages)[number] }
    | { kind: 'status_change'; from_status: string; to_status: string; changed_at: string };

  const timeline: TimelineItem[] = [];

  for (const msg of ticket.messages) {
    timeline.push({ kind: 'message', data: msg });
  }

  if (ticket.status_changes) {
    for (const sc of ticket.status_changes) {
      timeline.push({
        kind: 'status_change',
        from_status: sc.from_status,
        to_status: sc.to_status,
        changed_at: sc.changed_at,
      });
    }
  }

  timeline.sort((a, b) => {
    const aTime = a.kind === 'message' ? a.data.created_at : a.changed_at;
    const bTime = b.kind === 'message' ? b.data.created_at : b.changed_at;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => onNavigate('/tickets')}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </button>

      {/* Ticket header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            <span className="text-zinc-400 font-mono">#{ticket.ticket_number}</span>
            {' — '}
            {ticket.subject}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          {ticket.category && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {ticket.category}
            </span>
          )}
          <span className="text-sm text-zinc-400 ml-2">Created on {formatDate(ticket.created_at)}</span>
        </div>
      </div>

      {/* Resolved/Closed banner */}
      {isClosedOrResolved && (
        <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-3 mb-6">
          <span className="text-sm text-yellow-800 dark:text-yellow-400">
            This ticket has been {ticket.status === 'resolved' ? 'resolved' : 'closed'}.
          </span>
          <Button size="sm" variant="secondary" onClick={handleReopen} loading={reopenTicket.isPending}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reopen
          </Button>
        </div>
      )}

      {/* Message timeline */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 space-y-4 min-h-[200px] max-h-[600px] overflow-y-auto">
          {timeline.length === 0 && (
            <p className="text-center text-sm text-zinc-400 py-8">No messages yet.</p>
          )}

          {timeline.map((item, i) => {
            if (item.kind === 'status_change') {
              return (
                <div key={`sc-${i}`} className="flex justify-center">
                  <span className="text-xs italic text-zinc-400 dark:text-zinc-500">
                    Status changed from{' '}
                    <span className="font-medium">{item.from_status.replace(/_/g, ' ')}</span> to{' '}
                    <span className="font-medium">{item.to_status.replace(/_/g, ' ')}</span>
                    {' — '}
                    {formatRelativeTime(item.changed_at)}
                  </span>
                </div>
              );
            }

            const msg = item.data;
            const isClient = msg.author_type === 'client';
            const isOwn = isClient && msg.author_id === user?.id;

            return (
              <div
                key={msg.id}
                className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                    isClient
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-medium ${
                        isClient ? 'text-primary-100' : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {isOwn ? 'You' : msg.author_name}
                    </span>
                    <span
                      className={`text-xs ${
                        isClient ? 'text-primary-200' : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    >
                      {formatRelativeTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply box */}
        {!isClosedOrResolved && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
            <form onSubmit={handleSendReply} className="flex gap-3">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={2}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700 resize-y"
              />
              <Button
                type="submit"
                loading={postMessage.isPending}
                disabled={!replyText.trim()}
                className="self-end"
              >
                <Send className="h-4 w-4" />
                Send Reply
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
