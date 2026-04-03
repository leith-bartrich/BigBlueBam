import { useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Bot,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Participant {
  id: string;
  name: string;
  avatar_url?: string;
  is_speaking: boolean;
  is_muted: boolean;
  is_bot: boolean;
}

interface CallPanelProps {
  callId: string;
  channelId: string;
  participants: Participant[];
  onLeave: () => void;
  onToggleMute: () => void;
  onInviteAgent: () => void;
  isMuted: boolean;
}

export function CallPanel({
  callId,
  channelId,
  participants,
  onLeave,
  onToggleMute,
  onInviteAgent,
  isMuted,
}: CallPanelProps) {
  const [showParticipants, setShowParticipants] = useState(true);

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
      {/* Call header bar */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Call in progress
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

          {/* Invite agent */}
          <button
            onClick={onInviteAgent}
            className="p-2 rounded-md text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Invite AI agent"
          >
            <Bot className="h-4 w-4" />
          </button>

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
            participant.is_bot
              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
              : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
            participant.is_speaking && 'ring-2 ring-green-500 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-900',
          )}
        >
          {participant.avatar_url ? (
            <img
              src={participant.avatar_url}
              alt={participant.name}
              className="h-full w-full rounded-full object-cover"
            />
          ) : participant.is_bot ? (
            <Bot className="h-4 w-4" />
          ) : (
            initials
          )}
        </div>

        {/* Muted indicator */}
        {participant.is_muted && (
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
            <MicOff className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>

      <span className="text-xs text-zinc-600 dark:text-zinc-400 max-w-[60px] truncate text-center">
        {participant.name.split(' ')[0]}
      </span>
    </div>
  );
}
