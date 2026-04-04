import { useCallback } from 'react';
import { api } from '@/lib/api';
import { useChannelStore } from '@/stores/channel.store';

interface CallApiResponse {
  data: {
    call: {
      id: string;
      channel_id: string;
      type: 'voice' | 'video' | 'huddle';
      status: string;
      livekit_room_name: string;
    };
    token: string;
    livekit_url: string;
    existing?: boolean;
  };
}

/**
 * Hook for managing call lifecycle: start, join, leave, end calls.
 * Stores the LiveKit token and URL in the channel store so useLiveKit can connect.
 */
export function useCall() {
  const setActiveCall = useChannelStore((s) => s.setActiveCall);
  const clearActiveCall = useChannelStore((s) => s.clearActiveCall);
  const activeCallId = useChannelStore((s) => s.activeCallId);

  const startCall = useCallback(
    async (channelId: string, type: 'voice' | 'video' | 'huddle') => {
      const res = await api.post<CallApiResponse>(`/channels/${channelId}/calls`, { type });
      const { call, token, livekit_url } = res.data;
      setActiveCall(call.id, token, call.livekit_room_name, type, livekit_url);
      return { call, token, livekit_url };
    },
    [setActiveCall],
  );

  const joinCall = useCallback(
    async (callId: string) => {
      const res = await api.post<CallApiResponse>(`/calls/${callId}/join`);
      const { call, token, livekit_url } = res.data;
      setActiveCall(call.id, token, call.livekit_room_name, call.type as 'voice' | 'video' | 'huddle', livekit_url);
      return { call, token, livekit_url };
    },
    [setActiveCall],
  );

  const leaveCall = useCallback(async () => {
    if (!activeCallId) return;
    try {
      await api.post(`/calls/${activeCallId}/leave`);
    } catch {
      // Best effort
    }
    clearActiveCall();
  }, [activeCallId, clearActiveCall]);

  const endCall = useCallback(async () => {
    if (!activeCallId) return;
    try {
      await api.post(`/calls/${activeCallId}/end`);
    } catch {
      // Best effort
    }
    clearActiveCall();
  }, [activeCallId, clearActiveCall]);

  const inviteAgent = useCallback(async () => {
    if (!activeCallId) return;
    await api.post(`/calls/${activeCallId}/invite-agent`);
  }, [activeCallId]);

  const removeAgent = useCallback(async () => {
    if (!activeCallId) return;
    await api.post(`/calls/${activeCallId}/remove-agent`);
  }, [activeCallId]);

  const toggleRecording = useCallback(
    async (recording: boolean) => {
      if (!activeCallId) return;
      await api.patch(`/calls/${activeCallId}`, { recording });
    },
    [activeCallId],
  );

  const updateMediaState = useCallback(
    async (state: { has_audio?: boolean; has_video?: boolean; has_screen_share?: boolean }) => {
      if (!activeCallId) return;
      try {
        await api.patch(`/calls/${activeCallId}/media-state`, state);
      } catch {
        // Non-critical
      }
    },
    [activeCallId],
  );

  return {
    activeCallId,
    startCall,
    joinCall,
    leaveCall,
    endCall,
    inviteAgent,
    removeAgent,
    toggleRecording,
    updateMediaState,
  };
}
