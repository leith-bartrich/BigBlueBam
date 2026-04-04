import { useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Bot,
  Users,
  Circle,
  Video,
  VideoOff,
  Monitor,
  Settings,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Participant {
  id: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isBot: boolean;
  hasVideo: boolean;
}

interface CallPanelProps {
  // LiveKit state
  participants: Participant[];
  localParticipantId: string | null;
  activeSpeakers: string[];
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isConnected: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  callType: 'voice' | 'video' | 'huddle';
  connectionError: string | null;
  // Callbacks
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording?: () => void;
  onInviteAgent: () => void;
  onLeave: () => void;
  // Device selection
  onOpenDeviceSettings?: () => void;
}

export function CallPanel({
  participants,
  localParticipantId: _localParticipantId,
  activeSpeakers: _activeSpeakers,
  isMuted,
  isCameraOn,
  isScreenSharing,
  isConnected,
  isRecording,
  isTranscribing,
  callType,
  connectionError,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onToggleRecording,
  onInviteAgent,
  onLeave,
  onOpenDeviceSettings,
}: CallPanelProps) {
  const [showParticipants, setShowParticipants] = useState(true);

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
      {/* Connection error banner */}
      {connectionError && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
          <span className="text-xs font-medium text-red-600 dark:text-red-400">
            {connectionError}
          </span>
        </div>
      )}

      {/* Recording consent indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <Circle className="h-3 w-3 text-red-500 fill-red-500 animate-pulse" />
          <span className="text-xs font-medium text-red-600 dark:text-red-400">
            This call is being recorded
          </span>
        </div>
      )}

      {isTranscribing && !isRecording && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Live transcription is active
          </span>
        </div>
      )}

      {/* Call header bar */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          {/* Connection status indicator */}
          {isConnected ? (
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          ) : connectionError ? (
            <div className="h-2 w-2 rounded-full bg-red-500" />
          ) : (
            <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />
          )}
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {!isConnected && !connectionError
              ? 'Connecting...'
              : callType === 'huddle'
                ? 'Huddle'
                : callType === 'video'
                  ? 'Video call'
                  : 'Voice call'}{' '}
            {isConnected && 'in progress'}
          </span>
          <span className="text-xs text-zinc-500">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle participants list */}
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className={cn(
              'p-2 rounded-md transition-colors',
              showParticipants
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800',
            )}
            title="Toggle participants"
          >
            <Users className="h-4 w-4" />
          </button>

          {/* Mute button */}
          <button
            onClick={onToggleMute}
            className={cn(
              'p-2 rounded-md transition-colors',
              isMuted
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800',
            )}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Camera toggle (video calls) */}
          {(callType === 'video' || callType === 'huddle') && (
            <button
              onClick={onToggleCamera}
              className={cn(
                'p-2 rounded-md transition-colors',
                !isCameraOn
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800',
              )}
              title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </button>
          )}

          {/* Screen share toggle */}
          <button
            onClick={onToggleScreenShare}
            className={cn(
              'p-2 rounded-md transition-colors',
              isScreenSharing
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800',
            )}
            title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          >
            <Monitor className="h-4 w-4" />
          </button>

          {/* Record toggle */}
          {onToggleRecording && (
            <button
              onClick={onToggleRecording}
              className={cn(
                'p-2 rounded-md transition-colors',
                isRecording
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800',
              )}
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              <Circle className={cn('h-4 w-4', isRecording && 'fill-red-500')} />
            </button>
          )}

          {/* Invite agent */}
          <button
            onClick={onInviteAgent}
            className="p-2 rounded-md text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Invite AI agent"
          >
            <Bot className="h-4 w-4" />
          </button>

          {/* Device settings */}
          {onOpenDeviceSettings && (
            <button
              onClick={onOpenDeviceSettings}
              className="p-2 rounded-md text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Audio & video settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}

          {/* Leave call */}
          <button
            onClick={onLeave}
            className="p-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
            title="Leave call"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Participants list */}
      {showParticipants && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-3">
            {participants.map((p) => (
              <ParticipantBubble key={p.id} participant={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ParticipantBubble({ participant }: { participant: Participant }) {
  const initials = participant.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {/* Avatar circle with speaking indicator */}
        <div
          className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
            participant.isBot
              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
              : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
            participant.isSpeaking && 'ring-2 ring-green-500 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-900',
          )}
        >
          {participant.isBot ? (
            <Bot className="h-4 w-4" />
          ) : (
            initials
          )}
        </div>

        {/* Muted indicator */}
        {participant.isMuted && (
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
            <MicOff className="h-2.5 w-2.5 text-white" />
          </div>
        )}

        {/* Video indicator */}
        {participant.hasVideo && (
          <div className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
            <Video className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>

      <span className="text-xs text-zinc-600 dark:text-zinc-400 max-w-[60px] truncate text-center">
        {participant.name.split(' ')[0]}
      </span>
    </div>
  );
}
