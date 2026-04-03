import { useEffect } from 'react';
import {
  Hash,
  Users,
  Pin,
  Headphones,
  Phone,
} from 'lucide-react';
import { useChannel } from '@/hooks/use-channels';
import { useChannelStore } from '@/stores/channel.store';
import { useRealtimeChannel } from '@/hooks/use-realtime';
import { MessageTimeline } from '@/components/messages/message-timeline';
import { MessageCompose } from '@/components/messages/message-compose';
import { TypingIndicator } from '@/components/messages/typing-indicator';

interface ChannelViewProps {
  slug: string;
  type: 'channel' | 'dm';
  onNavigate: (path: string) => void;
}

export function ChannelView({ slug, type, onNavigate }: ChannelViewProps) {
  const { data: channel, isLoading } = useChannel(slug);
  const setActiveChannel = useChannelStore((s) => s.setActiveChannel);
  const clearUnread = useChannelStore((s) => s.clearUnread);

  // Set active channel for thread panel and unread tracking
  useEffect(() => {
    if (channel?.id) {
      setActiveChannel(channel.id);
      clearUnread(channel.id);
    }
    return () => setActiveChannel(null);
  }, [channel?.id, setActiveChannel, clearUnread]);

  // Subscribe to realtime events for this channel
  useRealtimeChannel(channel?.id ?? '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        <p>Channel not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <header className="flex items-center gap-3 px-4 h-14 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {type === 'channel' && <Hash className="h-5 w-5 text-zinc-400 flex-shrink-0" />}
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {channel.name}
          </h2>
        </div>

        {channel.topic && (
          <>
            <span className="text-zinc-300 dark:text-zinc-600">|</span>
            <p className="text-sm text-zinc-500 truncate">{channel.topic}</p>
          </>
        )}

        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <HeaderButton icon={<Users className="h-4 w-4" />} label={`${channel.member_count}`} />
          <HeaderButton icon={<Pin className="h-4 w-4" />} label="" title="Pinned messages" />
          <HeaderButton icon={<Headphones className="h-4 w-4" />} label="" title="Start huddle" />
          <HeaderButton icon={<Phone className="h-4 w-4" />} label="" title="Start call" />
        </div>
      </header>

      {/* Message timeline */}
      <div className="flex-1 min-h-0">
        <MessageTimeline channelId={channel.id} onNavigate={onNavigate} />
      </div>

      {/* Typing indicator + Compose */}
      <div className="flex-shrink-0">
        <TypingIndicator channelId={channel.id} />
        <MessageCompose channelId={channel.id} channelName={channel.name} />
      </div>
    </div>
  );
}

function HeaderButton({
  icon,
  label,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  title?: string;
}) {
  return (
    <button
      className="flex items-center gap-1 px-2 py-1.5 rounded-md text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm"
      title={title}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}
