import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Hash,
  Users,
  Pin,
  Mic,
  Video,
  Settings,
} from 'lucide-react';
import { Track } from 'livekit-client';
import { useChannel } from '@/hooks/use-channels';
import { useChannelStore } from '@/stores/channel.store';
import { useRealtimeChannel } from '@/hooks/use-realtime';
import { useLiveKit } from '@/hooks/use-livekit';
import { useDevices } from '@/hooks/use-devices';
import { MessageTimeline } from '@/components/messages/message-timeline';
import { MessageCompose } from '@/components/messages/message-compose';
import { TypingIndicator } from '@/components/messages/typing-indicator';
import { ChannelSettings } from '@/components/channels/channel-settings';
import { CallPanel } from '@/components/calls/call-panel';
import { DeviceSettingsDialog } from '@/components/calls/device-settings-dialog';
import { VideoGrid, type VideoParticipant } from '@/components/calls/video-grid';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ChannelViewProps {
  slug: string;
  type: 'channel' | 'dm';
  onNavigate: (path: string) => void;
}

export function ChannelView({ slug, type, onNavigate }: ChannelViewProps) {
  const { data: channel, isLoading } = useChannel(slug);
  const setActiveChannel = useChannelStore((s) => s.setActiveChannel);
  const clearUnread = useChannelStore((s) => s.clearUnread);
  const activeCallId = useChannelStore((s) => s.activeCallId);
  const activeCallToken = useChannelStore((s) => s.activeCallToken);
  const activeCallRoomName = useChannelStore((s) => s.activeCallRoomName);
  const activeCallType = useChannelStore((s) => s.activeCallType);
  const setActiveCall = useChannelStore((s) => s.setActiveCall);
  const clearActiveCall = useChannelStore((s) => s.clearActiveCall);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [callLoading, setCallLoading] = useState<'voice' | 'video' | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const activeCallLivekitUrl = useChannelStore((s) => s.activeCallLivekitUrl);

  // LiveKit connection — only connects when we have a valid token and URL
  const livekit = useLiveKit({
    serverUrl: activeCallLivekitUrl ?? undefined,
    token: activeCallId && activeCallToken ? activeCallToken : null,
  });

  // Device selection
  const devices = useDevices();

  const startCall = useCallback(
    async (callType: 'voice' | 'video') => {
      if (!channel?.id || callLoading) return;
      setCallLoading(callType);
      setCallError(null);
      try {
        const res = await api.post<{
          data: {
            call: { id: string; livekit_room_name: string; type: string };
            token: string;
            livekit_url: string;
            existing: boolean;
          };
        }>(`/channels/${channel.id}/calls`, { type: callType });
        const { call, token, livekit_url } = res.data;
        setActiveCall(call.id, token, call.livekit_room_name, callType, livekit_url);
      } catch (err: any) {
        setCallError(err?.message ?? 'Failed to start call');
        setTimeout(() => setCallError(null), 3000);
      } finally {
        setCallLoading(null);
      }
    },
    [channel?.id, callLoading, setActiveCall],
  );

  const leaveCall = useCallback(async () => {
    if (!activeCallId) return;
    // Disconnect from LiveKit first, then notify the API
    livekit.disconnect();
    try {
      await api.post(`/calls/${activeCallId}/leave`);
    } catch {}
    clearActiveCall();
  }, [activeCallId, clearActiveCall, livekit]);

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

  // Map LiveKit participants to VideoParticipant objects for the video grid
  const videoParticipants = useMemo((): VideoParticipant[] => {
    if (!livekit.isConnected) return [];

    const result: VideoParticipant[] = [];

    // Local participant
    if (livekit.localParticipant) {
      const lp = livekit.localParticipant;
      result.push({
        id: lp.identity,
        name: lp.name ?? lp.identity,
        avatarUrl: null,
        isSpeaking: livekit.activeSpeakers.includes(lp.identity),
        isMuted: !lp.isMicrophoneEnabled,
        isVideoEnabled: lp.isCameraEnabled,
        isScreenSharing: lp.isScreenShareEnabled,
        isBot: false,
        videoTrack:
          lp.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack ?? null,
        screenShareTrack:
          lp.getTrackPublication(Track.Source.ScreenShare)?.track?.mediaStreamTrack ?? null,
      });
    }

    // Remote participants
    for (const rp of livekit.participants) {
      result.push({
        id: rp.identity,
        name: rp.name ?? rp.identity,
        avatarUrl: null,
        isSpeaking: livekit.activeSpeakers.includes(rp.identity),
        isMuted: !rp.isMicrophoneEnabled,
        isVideoEnabled: rp.isCameraEnabled,
        isScreenSharing: rp.isScreenShareEnabled,
        isBot: false,
        videoTrack:
          rp.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack ?? null,
        screenShareTrack:
          rp.getTrackPublication(Track.Source.ScreenShare)?.track?.mediaStreamTrack ?? null,
      });
    }

    return result;
  }, [livekit.isConnected, livekit.localParticipant, livekit.participants, livekit.activeSpeakers]);

  const showVideoGrid = activeCallType === 'video' && livekit.isConnected && videoParticipants.length > 0;

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
          {!activeCallId ? (
            <>
              <HeaderButton
                icon={<Mic className="h-4 w-4" />}
                label={callLoading === 'voice' ? '...' : ''}
                title="Voice call"
                onClick={() => startCall('voice')}
              />
              <HeaderButton
                icon={<Video className="h-4 w-4" />}
                label={callLoading === 'video' ? '...' : ''}
                title="Video call"
                onClick={() => startCall('video')}
              />
            </>
          ) : (
            <button
              onClick={leaveCall}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Leave call
            </button>
          )}
          <HeaderButton
            icon={<Settings className="h-4 w-4" />}
            label=""
            title="Channel settings"
            onClick={() => setShowSettings(true)}
          />
          {callError && (
            <span className="text-xs text-red-500 ml-1">{callError}</span>
          )}
        </div>
      </header>

      {/* Call panel (shown when a call is active) */}
      {activeCallId && activeCallToken && (
        <CallPanel
          participants={livekit.participants.map((p) => ({
            id: p.identity,
            name: p.name ?? p.identity,
            isSpeaking: livekit.activeSpeakers.includes(p.identity),
            isMuted: !p.isMicrophoneEnabled,
            isBot: false,
            hasVideo: p.isCameraEnabled,
          }))}
          localParticipantId={livekit.localParticipant?.identity ?? null}
          activeSpeakers={livekit.activeSpeakers}
          isMuted={livekit.isMuted}
          isCameraOn={livekit.isCameraOn}
          isScreenSharing={livekit.isScreenSharing}
          isConnected={livekit.isConnected}
          isRecording={false}
          isTranscribing={false}
          callType={activeCallType ?? 'voice'}
          connectionError={livekit.connectionError}
          onToggleMute={livekit.toggleMute}
          onToggleCamera={livekit.toggleCamera}
          onToggleScreenShare={livekit.toggleScreenShare}
          onInviteAgent={async () => {
            if (activeCallId) {
              try { await api.post(`/calls/${activeCallId}/invite-agent`); } catch {}
            }
          }}
          onLeave={leaveCall}
          onOpenDeviceSettings={() => setShowDeviceSettings(true)}
        />
      )}

      {/* Video grid (shown for video calls when connected) */}
      {showVideoGrid && (
        <div className="flex-shrink-0" style={{ height: '60%' }}>
          <VideoGrid
            participants={videoParticipants}
            localParticipantId={livekit.localParticipant?.identity ?? ''}
          />
        </div>
      )}

      {/* Message timeline */}
      <div className="flex-1 min-h-0">
        <MessageTimeline channelId={channel.id} onNavigate={onNavigate} />
      </div>

      {/* Typing indicator + Compose */}
      <div className="flex-shrink-0">
        <TypingIndicator channelId={channel.id} />
        <MessageCompose channelId={channel.id} channelName={channel.name} />
      </div>

      {/* Channel settings modal */}
      {showSettings && (
        <ChannelSettings channel={channel} onClose={() => setShowSettings(false)} onNavigate={onNavigate} />
      )}

      {/* Device settings dialog */}
      {showDeviceSettings && (
        <DeviceSettingsDialog
          open={showDeviceSettings}
          onClose={() => setShowDeviceSettings(false)}
          audioInputs={devices.audioInputs}
          audioOutputs={devices.audioOutputs}
          videoInputs={devices.videoInputs}
          selectedMicId={devices.selectedMicId}
          selectedSpeakerId={devices.selectedSpeakerId}
          selectedCameraId={devices.selectedCameraId}
          onSelectMic={(id) => {
            devices.setSelectedMic(id);
            livekit.setMicrophoneDevice(id);
          }}
          onSelectSpeaker={(id) => {
            devices.setSelectedSpeaker(id);
            livekit.setSpeakerDevice(id);
          }}
          onSelectCamera={(id) => {
            devices.setSelectedCamera(id);
            livekit.setCameraDevice(id);
          }}
          onRequestPermissions={devices.requestPermissions}
          hasPermission={devices.hasPermission}
        />
      )}
    </div>
  );
}

function HeaderButton({
  icon,
  label,
  title,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  title?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        'flex items-center gap-1 px-2 py-1.5 rounded-md hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm',
        active
          ? 'text-green-600 dark:text-green-400'
          : 'text-zinc-500',
      )}
      title={title}
      onClick={onClick}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}
