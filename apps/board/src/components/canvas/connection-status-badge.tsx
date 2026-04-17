import { Wifi, WifiOff, Users, Loader2 } from 'lucide-react';
import type { BoardConnectionStatus } from '@/hooks/use-board-sync';
import { cn } from '@/lib/utils';

interface ConnectionStatusBadgeProps {
  status: BoardConnectionStatus;
  peerCount: number;
}

/**
 * Small floating badge top-right that shows real-time sync status:
 * - connecting: amber spinner
 * - connected:  green Wifi icon, plus an avatar-count chip if peers > 0
 * - disconnected: red WifiOff with a "Reconnecting..." hint
 *
 * Kept compact so it doesn't crowd Excalidraw's own toolbar.
 */
export function ConnectionStatusBadge({ status, peerCount }: ConnectionStatusBadgeProps) {
  return (
    <div className="absolute top-14 right-3 z-[200] flex items-center gap-2 pointer-events-none">
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium backdrop-blur shadow-sm border',
          status === 'connected'
            && 'bg-green-50/90 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
          status === 'connecting'
            && 'bg-amber-50/90 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
          status === 'disconnected'
            && 'bg-red-50/90 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
        )}
        title={
          status === 'connected'
            ? 'Live sync active'
            : status === 'connecting'
              ? 'Connecting to live sync...'
              : 'Disconnected. Reconnecting...'
        }
      >
        {status === 'connected' && <Wifi className="h-3.5 w-3.5" />}
        {status === 'connecting' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {status === 'disconnected' && <WifiOff className="h-3.5 w-3.5" />}
        <span className="capitalize">
          {status === 'connecting' ? 'Connecting' : status === 'connected' ? 'Live' : 'Offline'}
        </span>
      </div>

      {status === 'connected' && peerCount > 0 && (
        <div
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-white/90 dark:bg-zinc-800/90 backdrop-blur shadow-sm border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
          title={`${peerCount} other ${peerCount === 1 ? 'editor' : 'editors'} on this board`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>{peerCount}</span>
        </div>
      )}
    </div>
  );
}
