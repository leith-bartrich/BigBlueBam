import { type ReactNode } from 'react';
import { BanterSidebar } from '@/components/sidebar/banter-sidebar';
import { ThreadPanel } from '@/components/threads/thread-panel';
import { useChannelStore } from '@/stores/channel.store';
import { usePresence } from '@/hooks/use-presence';
import { useUnreadCounts } from '@/hooks/use-unread';
import { useRealtimeGlobal } from '@/hooks/use-realtime';

interface BanterLayoutProps {
  children: ReactNode;
  onNavigate: (path: string) => void;
  activeRoute: { page: string; slug?: string; id?: string };
}

export function BanterLayout({ children, onNavigate, activeRoute }: BanterLayoutProps) {
  const activeThreadMessageId = useChannelStore((s) => s.activeThreadMessageId);
  const sidebarCollapsed = useChannelStore((s) => s.sidebarCollapsed);
  const activeChannelId = useChannelStore((s) => s.activeChannelId);

  // Global hooks
  usePresence();
  useUnreadCounts();
  useRealtimeGlobal();

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <aside className="w-[260px] flex-shrink-0 bg-sidebar flex flex-col">
          <BanterSidebar onNavigate={onNavigate} activeRoute={activeRoute} />
        </aside>
      )}

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900">
        {children}
      </main>

      {/* Thread panel */}
      {activeThreadMessageId && activeChannelId && (
        <aside className="w-[400px] flex-shrink-0 border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 animate-slide-in-right">
          <ThreadPanel
            messageId={activeThreadMessageId}
            channelId={activeChannelId}
            onNavigate={onNavigate}
          />
        </aside>
      )}
    </div>
  );
}
