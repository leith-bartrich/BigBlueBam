import { useState, useRef, useEffect } from 'react';
import { useTicket, usePostMessage, useReopenTicket } from '@/hooks/use-tickets';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/common/button';
import { StatusBadge, PriorityBadge } from '@/components/common/badge';
import { RichTextEditor } from '@/components/common/rich-text-editor';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { markdownToHtml, sanitizeHtml } from '@/lib/markdown';
import { api } from '@/lib/api';
import { ArrowLeft, Loader2, Send, RotateCcw, CheckCircle, ChevronDown, MessageSquareShare } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showShareBanter, setShowShareBanter] = useState(false);
  const [banterChannelId, setBanterChannelId] = useState('');
  const [banterMessage, setBanterMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const isClosedOrResolved = ticket?.status === 'resolved' || ticket?.status === 'closed';

  const updatePriority = useMutation({
    mutationFn: (priority: string) =>
      api.post(`/tickets/${ticketId}/update-priority`, { priority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk-ticket', ticketId] });
      setShowPriorityMenu(false);
    },
  });

  const closeTicket = useMutation({
    mutationFn: () =>
      api.post(`/tickets/${ticketId}/close`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk-ticket', ticketId] });
    },
  });

  // Banter channels for "Share to Banter"
  const { data: banterChannelsRes } = useQuery({
    queryKey: ['banter-channels'],
    queryFn: () => api.get<{ data: { id: string; name: string }[] }>('/banter/api/v1/channels'),
    enabled: showShareBanter,
  });
  const banterChannels = (banterChannelsRes as { data?: { id: string; name: string }[] })?.data ?? [];

  // Share ticket to Banter mutation
  const shareToBanter = useMutation({
    mutationFn: (channelId: string) => {
      const ticketNum = ticket ? `#${ticket.ticket_number}` : '';
      const subject = ticket?.subject ?? '';
      const msgPrefix = banterMessage ? `${banterMessage}\n\n` : '';
      return api.post(`/banter/api/v1/channels/${channelId}/messages`, {
        content: `${msgPrefix}Shared from Helpdesk: **${ticketNum} -- ${subject}**\n\n> Status: ${ticket?.status ?? 'unknown'} | Priority: ${ticket?.priority ?? 'unknown'}${ticket?.category ? ` | Category: ${ticket.category}` : ''}\n\n[Open Ticket ->](/helpdesk/tickets/${ticketId})`,
        metadata: {
          bbb_entity: {
            type: 'ticket',
            id: ticketId,
            ticket_number: ticket?.ticket_number,
            subject,
          },
        },
      });
    },
    onSuccess: () => {
      setShowShareBanter(false);
      setBanterChannelId('');
      setBanterMessage('');
    },
  });

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
          {/* Priority with dropdown to change */}
          <div className="relative">
            <button
              onClick={() => setShowPriorityMenu(!showPriorityMenu)}
              className="inline-flex items-center gap-1"
            >
              <PriorityBadge priority={ticket.priority} />
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            </button>
            {showPriorityMenu && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[120px]">
                {['low', 'medium', 'high'].map((p) => (
                  <button
                    key={p}
                    onClick={() => updatePriority.mutate(p)}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${ticket.priority === p ? 'font-medium text-primary-600' : 'text-zinc-700 dark:text-zinc-300'}`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {ticket.category && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {ticket.category}
            </span>
          )}
          <span className="text-sm text-zinc-400 ml-2">Created on {formatDate(ticket.created_at)}</span>
          {/* Share to Banter */}
          <div className="relative ml-auto">
            <button
              onClick={() => setShowShareBanter((v) => !v)}
              className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Share to Banter"
            >
              <MessageSquareShare className="h-4.5 w-4.5" />
            </button>
            {showShareBanter && (
              <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-zinc-200 bg-white shadow-xl dark:bg-zinc-800 dark:border-zinc-700 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Share to Banter</h4>
                <div>
                  <label className="text-xs font-medium text-zinc-500 mb-1 block">Channel</label>
                  <select
                    value={banterChannelId}
                    onChange={(e) => setBanterChannelId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100"
                  >
                    <option value="">Select a channel...</option>
                    {banterChannels.map((ch) => (
                      <option key={ch.id} value={ch.id}>#{ch.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500 mb-1 block">Message (optional)</label>
                  <textarea
                    value={banterMessage}
                    onChange={(e) => setBanterMessage(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm resize-none dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowShareBanter(false)}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => banterChannelId && shareToBanter.mutate(banterChannelId)}
                    disabled={!banterChannelId || shareToBanter.isPending}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    {shareToBanter.isPending ? 'Sharing...' : 'Share'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Close button */}
          {!isClosedOrResolved && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { if (confirm('Close this ticket?')) closeTicket.mutate(); }}
              loading={closeTicket.isPending}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Close Ticket
            </Button>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="mb-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Description</h2>
        <div
          className="rich-text-content text-sm text-zinc-800 dark:text-zinc-200"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(ticket.description)) }}
        />
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
                  <div
                    className="rich-text-content text-sm break-words"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(msg.body)) }}
                  />
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply box */}
        {!isClosedOrResolved && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
            <form onSubmit={handleSendReply} className="space-y-3">
              <RichTextEditor
                value={replyText}
                onChange={setReplyText}
                placeholder="Type your reply..."
                minRows={2}
                onImageUpload={async (file) => {
                  const formData = new FormData();
                  formData.append('file', file);
                  const res = await api.upload<{ url: string }>('/upload', formData);
                  return res.url ?? (res as unknown as { data: { url: string } }).data?.url ?? '';
                }}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  loading={postMessage.isPending}
                  disabled={!replyText.trim()}
                >
                  <Send className="h-4 w-4" />
                  Send Reply
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
