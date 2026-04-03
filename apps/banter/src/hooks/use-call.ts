import { useCallback } from 'react';
import { api } from '@/lib/api';
import { useChannelStore } from '@/stores/channel.store';

interface StartCallResponse {
  data: {
    call: {
      id: string;
      channel_id: string;
      type: 'voice' | 'video' | 'huddle';
      status: string;
      livekit_room_name: string;
    };
    token: string;
    existing: boolean;
  };
}

/**
 * Hook for managing call state: start, join, leave, end calls.
 * When LiveKit client SDK is installed, this hook would also manage
 * the Room connection and track subscriptions.
 */
export function useCall() {
  const setActiveCall = useChannelStore((s) => s.setActiveCall);
  const clearActiveCall = useChannelStore((s) => s.clearActiveCall);
  const activeCallId = useChannelStore((s) => s.activeCallId);

  const startCall = useCallback(
    async (channelId: string, type: 'voice' | 'video' | 'huddle') => {
      const res = await api.post<StartCallResponse>(`/channels/${channelId}/calls`, { type });
      const { call, token } = res.data;
      setActiveCall(call.id, token, call.livekit_room_name, type);
      return { call, token };
    },
    [setActiveCall],
  );

  const joinCall = useCallback(
    async (callId: string) => {
      const res = await api.post<{ data: { call: { id: string; livekit_room_name: string; type: string }; token: string } }>(`/calls/${callId}/join`);
      const { call, token } = res.data;
      setActiveCall(call.id, token, call.livekit_room_name, call.type as 'voice' | 'video' | 'huddle');
      return { call, token };
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

  return {
    activeCallId,
    startCall,
    joinCall,
    leaveCall,
    endCall,
    inviteAgent,
    removeAgent,
    toggleRecording,
  };
}
