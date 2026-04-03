import { useState } from 'react';
import {
  Hash,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Bookmark,
  Settings,
  Compass,
  MessageSquarePlus,
} from 'lucide-react';
import { useChannels, type Channel } from '@/hooks/use-channels';
import { useAuthStore } from '@/stores/auth.store';
import { useChannelStore } from '@/stores/channel.store';
import { cn, generateAvatarInitials, presenceColor } from '@/lib/utils';

interface BanterSidebarProps {
  onNavigate: (path: string) => void;
  activeRoute: { page: string; slug?: string; id?: string };
}

export function BanterSidebar({ onNavigate, activeRoute }: BanterSidebarProps) {
  const user = useAuthStore((s) => s.user);
  const unreadCounts = useChannelStore((s) => s.unreadCounts);
  const { data: channels } = useChannels();

  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);

  const regularChannels = channels?.filter((c) => c.type === 'channel') ?? [];
  const dmChannels = channels?.filter((c) => c.type === 'dm' || c.type === 'group_dm') ?? [];

  const isActive = (slug: string, type: 'channel' | 'dm') => {
    if (type === 'channel') return activeRoute.page === 'channel' && activeRoute.slug === slug;
    return activeRoute.page === 'dm' && activeRoute.id === slug;
  };

  return (
    <div className="flex flex-col h-full text-zinc-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800 flex-shrink-0">
        <h1 className="text-lg font-bold text-white tracking-tight">Banter</h1>
        <button
          onClick={() => onNavigate('/dm/new')}
          className="p-1.5 rounded-md hover:bg-sidebar-hover text-zinc-400 hover:text-zinc-200 transition-colors"
          title="New direct message"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </div>

      {/* Quick actions */}
      <div className="px-2 py-2 space-y-0.5">
        <SidebarButton
          icon={<Search className="h-4 w-4" />}
          label="Search"
          active={activeRoute.page === 'search'}
          onClick={() => onNavigate('/search')}
        />
        <SidebarButton
          icon={<Bookmark className="h-4 w-4" />}
          label="Bookmarks"
          active={activeRoute.page === 'bookmarks'}
          onClick={() => onNavigate('/bookmarks')}
        />
        <SidebarButton
          icon={<Compass className="h-4 w-4" />}
          label="Browse channels"
          active={activeRoute.page === 'browse'}
          onClick={() => onNavigate('/browse')}
        />
      </div>

      {/* Scrollable channel/DM list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
        {/* Channels section */}
        <div className="mt-2">
          <button
            onClick={() => setChannelsOpen(!channelsOpen)}
            className="flex items-center gap-1 px-2 py-1 w-full text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {channelsOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Channels
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('/browse');
              }}
              className="ml-auto p-0.5 rounded hover:bg-sidebar-hover"
              title="Add channel"
            >
              <Plus className="h-3 w-3" />
            </button>
          </button>

          {channelsOpen && (
            <div className="space-y-0.5 mt-0.5">
              {regularChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  active={isActive(channel.slug, 'channel')}
                  unread={unreadCounts[channel.id]}
                  onClick={() => onNavigate(`/channels/${channel.slug}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Direct Messages section */}
        <div className="mt-4">
          <button
            onClick={() => setDmsOpen(!dmsOpen)}
            className="flex items-center gap-1 px-2 py-1 w-full text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {dmsOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Direct Messages
          </button>

          {dmsOpen && (
            <div className="space-y-0.5 mt-0.5">
              {dmChannels.map((channel) => (
                <DmItem
                  key={channel.id}
                  channel={channel}
                  active={isActive(channel.id, 'dm')}
                  unread={unreadCounts[channel.id]}
                  onClick={() => onNavigate(`/dm/${channel.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: user info + settings */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-zinc-800 flex-shrink-0">
        <div className="relative">
          <div className="h-8 w-8 rounded-md bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
            {generateAvatarInitials(user?.display_name)}
          </div>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar',
              presenceColor(user?.presence ?? 'offline'),
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate">
            {user?.display_name}
          </p>
        </div>
        <button
          onClick={() => onNavigate('/settings')}
          className="p-1.5 rounded-md hover:bg-sidebar-hover text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Preferences"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function SidebarButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm transition-colors',
        active
          ? 'bg-sidebar-active text-white'
          : 'text-zinc-400 hover:bg-sidebar-hover hover:text-zinc-200',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ChannelItem({
  channel,
  active,
  unread,
  onClick,
}: {
  channel: Channel;
  active: boolean;
  unread?: { messages: number; mentions: number };
  onClick: () => void;
}) {
  const hasUnread = unread && unread.messages > 0;
  const hasMentions = unread && unread.mentions > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-2 py-1 rounded-md text-sm transition-colors',
        active
          ? 'bg-sidebar-active text-white'
          : hasUnread
            ? 'text-white hover:bg-sidebar-hover'
            : 'text-zinc-400 hover:bg-sidebar-hover hover:text-zinc-200',
      )}
    >
      <Hash className="h-4 w-4 flex-shrink-0 opacity-60" />
      <span className={cn('truncate', hasUnread && !active && 'font-semibold')}>
        {channel.name}
      </span>
      {hasMentions && (
        <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
          {unread.mentions}
        </span>
      )}
      {hasUnread && !hasMentions && (
        <span className="ml-auto h-2 w-2 rounded-full bg-zinc-400" />
      )}
    </button>
  );
}

function DmItem({
  channel,
  active,
  unread,
  onClick,
}: {
  channel: Channel;
  active: boolean;
  unread?: { messages: number; mentions: number };
  onClick: () => void;
}) {
  const hasUnread = unread && unread.messages > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-2 py-1 rounded-md text-sm transition-colors',
        active
          ? 'bg-sidebar-active text-white'
          : hasUnread
            ? 'text-white hover:bg-sidebar-hover'
            : 'text-zinc-400 hover:bg-sidebar-hover hover:text-zinc-200',
      )}
    >
      <div className="relative flex-shrink-0">
        <div className="h-5 w-5 rounded-md bg-zinc-600 flex items-center justify-center text-[10px] font-medium text-zinc-200">
          {generateAvatarInitials(channel.name)}
        </div>
        {/* Presence dot would come from channel member data */}
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-sidebar bg-presence-online" />
      </div>
      <span className={cn('truncate', hasUnread && !active && 'font-semibold')}>
        {channel.name}
      </span>
      {hasUnread && (
        <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
          {unread!.messages}
        </span>
      )}
    </button>
  );
}
