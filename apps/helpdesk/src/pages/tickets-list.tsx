import { useTickets } from '@/hooks/use-tickets';
import { Button } from '@/components/common/button';
import { StatusBadge, PriorityBadge } from '@/components/common/badge';
import { formatRelativeTime } from '@/lib/utils';
import { Plus, Loader2, Inbox } from 'lucide-react';

interface TicketsListPageProps {
  onNavigate: (path: string) => void;
}

export function TicketsListPage({ onNavigate }: TicketsListPageProps) {
  const { data: tickets, isLoading, error } = useTickets();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Tickets</h1>
        <Button onClick={() => onNavigate('/tickets/new')}>
          <Plus className="h-4 w-4" />
          New Ticket
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
          Failed to load tickets. Please try again.
        </div>
      )}

      {/* Empty state */}
      {tickets && tickets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Inbox className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-4" />
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">No tickets yet</h2>
          <p className="text-zinc-500 mb-6">Create your first one!</p>
          <Button onClick={() => onNavigate('/tickets/new')}>
            <Plus className="h-4 w-4" />
            New Ticket
          </Button>
        </div>
      )}

      {/* Ticket list */}
      {tickets && tickets.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid sm:grid-cols-[60px_1fr_120px_90px_110px_120px] gap-4 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 text-xs font-medium text-zinc-500 uppercase tracking-wider">
            <span>#</span>
            <span>Subject</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Category</span>
            <span>Updated</span>
          </div>

          {/* Rows */}
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => onNavigate(`/tickets/${ticket.id}`)}
              className="w-full text-left grid grid-cols-1 sm:grid-cols-[60px_1fr_120px_90px_110px_120px] gap-2 sm:gap-4 px-4 py-3 border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors last:border-b-0"
            >
              <span className="text-sm text-zinc-400 font-mono">#{ticket.ticket_number}</span>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {ticket.subject}
              </span>
              <span>
                <StatusBadge status={ticket.status} />
              </span>
              <span>
                <PriorityBadge priority={ticket.priority} />
              </span>
              <span className="text-sm text-zinc-500 truncate">{ticket.category ?? '--'}</span>
              <span className="text-sm text-zinc-400">{formatRelativeTime(ticket.updated_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
