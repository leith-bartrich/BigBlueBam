import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ws } from '@/lib/websocket';
import { useChannelStore } from '@/stores/channel.store';

/**
 * Subscribe to a channel room via WebSocket and invalidate
 * relevant queries when events arrive.
 */
export function useRealtimeChannel(channelId: string) {
  const queryClient = useQueryClient();
  const activeChannelId = useChannelStore((s) => s.activeChannelId);
  const setUnreadCount = useChannelStore((s) => s.setUnreadCount);

  useEffect(() => {
    if (!channelId) return;

    const room = `channel:${channelId}`;
    ws.joinRoom(room);

    const unsubMessage = ws.on('message.created', (event) => {
      const payload = event.payload as { channel_id: string };
      if (payload.channel_id === channelId) {
        queryClient.invalidateQueries({ queryKey: ['messages', channelId] });

        // If this is not the active channel, increment unread
        if (activeChannelId !== channelId) {
          queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
        }
      }
    });

    const unsubEdit = ws.on('message.updated', (event) => {
      const payload = event.payload as { channel_id: string };
      if (payload.channel_id === channelId) {
        queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
      }
    });

    const unsubDelete = ws.on('message.deleted', (event) => {
      const payload = event.payload as { channel_id: string };
      if (payload.channel_id === channelId) {
        queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
      }
    });

    const unsubReaction = ws.on('reaction.toggled', (event) => {
      const payload = event.payload as { channel_id: string };
      if (payload.channel_id === channelId) {
        queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
      }
    });

    const unsubUnread = ws.on('unread.updated', (event) => {
      const payload = event.payload as {
        channel_id: string;
        unread_messages: number;
        unread_mentions: number;
      };
      if (payload.channel_id === channelId) {
        setUnreadCount(channelId, payload.unread_messages, payload.unread_mentions);
      }
    });

    return () => {
      ws.leaveRoom(room);
      unsubMessage();
      unsubEdit();
      unsubDelete();
      unsubReaction();
      unsubUnread();
    };
  }, [channelId, activeChannelId, queryClient, setUnreadCount]);
}

/**
 * Subscribe to the user's global presence/notification room.
 */
export function useRealtimeGlobal() {
  const queryClient = useQueryClient();

  useEffect(() => {
    ws.joinRoom('global');

    const unsubChannels = ws.on('channel.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    });

    const unsubCreated = ws.on('channel.created', () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    });

    return () => {
      ws.leaveRoom('global');
      unsubChannels();
      unsubCreated();
    };
  }, [queryClient]);
}
