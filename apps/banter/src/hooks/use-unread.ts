import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useChannelStore } from '@/stores/channel.store';

interface UnreadEntry {
  channel_id: string;
  unread_messages: number;
  unread_mentions: number;
}

/** Fetch and sync unread counts into the channel store */
export function useUnreadCounts() {
  const setUnreadCount = useChannelStore((s) => s.setUnreadCount);

  const query = useQuery({
    queryKey: ['unread-counts'],
    queryFn: () => api.get<{ data: UnreadEntry[] }>('/me/unreads').then((r) => r.data),
    refetchInterval: 30000, // Poll every 30 seconds as a fallback
  });

  useEffect(() => {
    if (query.data) {
      for (const entry of query.data) {
        setUnreadCount(entry.channel_id, entry.unread_messages, entry.unread_mentions);
      }
    }
  }, [query.data, setUnreadCount]);

  return query;
}
