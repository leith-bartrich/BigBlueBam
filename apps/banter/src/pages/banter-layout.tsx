import { type ReactNode } from 'react';
import { ClipboardList, MessageCircle, Headset } from 'lucide-react';
import { BanterSidebar } from '@/components/sidebar/banter-sidebar';
import { ThreadPanel } from '@/components/threads/thread-panel';
import { useChannelStore } from '@/stores/channel.store';
import { usePresence } from '@/hooks/use-presence';
import { useUnreadCounts } from '@/hooks/use-unread';
import { useRealtimeGlobal } from '@/hooks/use-realtime';
import { useAuthStore } from '@/stores/auth.store';

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

  const { user } = useAuthStore();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Cross-app navigation bar */}
      <header className="flex items-center justify-between h-10 px-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <nav className="flex items-center gap-1">
          <a href="/b3/" className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
            <ClipboardList className="h-3.5 w-3.5" /> BBB
          </a>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-zinc-800 text-white">
            <MessageCircle className="h-3.5 w-3.5" /> Banter
          </span>
          <a href="/helpdesk/" className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
            <Headset className="h-3.5 w-3.5" /> Helpdesk
          </a>
        </nav>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{user?.display_name}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
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
    </div>
  );
}
