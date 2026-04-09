import { Plug, Plus, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ConnectionsPageProps {
  onNavigate?: (path: string) => void;
}

export function ConnectionsPage({ onNavigate }: ConnectionsPageProps) {
  // Placeholder: external calendar sync connections
  // Real implementation would fetch from /v1/connections
  const connections: Array<{
    id: string;
    provider: string;
    external_calendar_id: string;
    sync_status: string;
    last_sync_at: string | null;
  }> = [];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Plug className="h-6 w-6 text-blue-600" />
          External Calendar Connections
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Connect Google Calendar or Microsoft Outlook for two-way sync
        </p>
      </div>

      <div className="grid gap-3">
        {/* Google Calendar card */}
        <div className="flex items-center justify-between p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
              <span className="text-lg font-bold text-red-600">G</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Google Calendar</h3>
              <p className="text-xs text-zinc-500">Sync events with your Google Calendar</p>
            </div>
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            disabled
          >
            <Plus className="h-3.5 w-3.5" />
            Connect
          </button>
        </div>

        {/* Microsoft Outlook card */}
        <div className="flex items-center justify-between p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
              <span className="text-lg font-bold text-blue-600">M</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Microsoft Outlook</h3>
              <p className="text-xs text-zinc-500">Sync events with your Outlook Calendar</p>
            </div>
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            disabled
          >
            <Plus className="h-3.5 w-3.5" />
            Connect
          </button>
        </div>
      </div>

      {connections.length === 0 && (
        <div className="text-center py-8 text-zinc-400">
          <p className="text-sm">No external calendars connected yet.</p>
          <p className="text-xs mt-1">OAuth integration requires Google/Microsoft credentials in the server configuration.</p>
        </div>
      )}
    </div>
  );
}
