import { useMemo, useRef, useEffect } from 'react';
import { Mic, MicOff, MonitorUp, Bot, VideoOff } from 'lucide-react';
import { cn, generateAvatarInitials } from '@/lib/utils';

export interface VideoParticipant {
  id: string;
  name: string;
  avatarUrl: string | null;
  isSpeaking: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isBot: boolean;
  /** Actual LiveKit camera track reference (null when no video) */
  videoTrack: MediaStreamTrack | null;
  /** Actual LiveKit screen share track reference (null when not sharing) */
  screenShareTrack: MediaStreamTrack | null;
}

interface VideoGridProps {
  participants: VideoParticipant[];
  localParticipantId: string;
}

// ---------------------------------------------------------------------------
// Reusable video track renderer
// ---------------------------------------------------------------------------

function VideoTrackRenderer({ track, mirror, objectFit }: {
  track: MediaStreamTrack;
  mirror?: boolean;
  objectFit?: 'cover' | 'contain';
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;
    const stream = new MediaStream([track]);
    el.srcObject = stream;
    return () => { el.srcObject = null; };
  }, [track]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={cn(
        'w-full h-full',
        objectFit === 'contain' ? 'object-contain' : 'object-cover',
        mirror && 'scale-x-[-1]',
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Grid layout
// ---------------------------------------------------------------------------

function gridCols(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count <= 2) return 'grid-cols-2';
  if (count <= 4) return 'grid-cols-2';
  if (count <= 6) return 'grid-cols-3';
  return 'grid-cols-3';
}

// ---------------------------------------------------------------------------
// Participant tile
// ---------------------------------------------------------------------------

function ParticipantTile({
  participant,
  isLocal,
  large = false,
}: {
  participant: VideoParticipant;
  isLocal: boolean;
  large?: boolean;
}) {
  const hasVideo = participant.videoTrack !== null && participant.isVideoEnabled;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-xl overflow-hidden bg-zinc-900',
        'border-2 transition-all',
        participant.isSpeaking
          ? 'border-green-500 shadow-lg shadow-green-500/20'
          : 'border-zinc-700',
        large ? 'min-h-[320px]' : 'min-h-[160px]',
      )}
    >
      {/* Video track or avatar placeholder */}
      {hasVideo ? (
        <div className="absolute inset-0">
          <VideoTrackRenderer
            track={participant.videoTrack!}
            mirror={isLocal}
            objectFit="cover"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2">
          <div
            className={cn(
              'rounded-full flex items-center justify-center text-white font-semibold',
              participant.isBot
                ? 'bg-purple-600'
                : 'bg-primary-600',
              large ? 'h-20 w-20 text-2xl' : 'h-12 w-12 text-sm',
            )}
          >
            {participant.avatarUrl ? (
              <img
                src={participant.avatarUrl}
                alt={participant.name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : participant.isBot ? (
              <Bot className={large ? 'h-8 w-8' : 'h-5 w-5'} />
            ) : (
              generateAvatarInitials(participant.name)
            )}
          </div>
          {!participant.isVideoEnabled && (
            <VideoOff className="h-4 w-4 text-zinc-500" />
          )}
        </div>
      )}

      {/* Bottom bar: name + indicators */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-3 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
        <span className="text-xs font-medium text-white truncate max-w-[70%]">
          {participant.name}
          {isLocal && ' (You)'}
        </span>

        <div className="flex items-center gap-1.5">
          {participant.isScreenSharing && (
            <MonitorUp className="h-3.5 w-3.5 text-blue-400" />
          )}
          {participant.isMuted ? (
            <MicOff className="h-3.5 w-3.5 text-red-400" />
          ) : (
            <Mic
              className={cn(
                'h-3.5 w-3.5',
                participant.isSpeaking ? 'text-green-400' : 'text-zinc-400',
              )}
            />
          )}
        </div>
      </div>

      {/* Speaking glow */}
      {participant.isSpeaking && (
        <span className="absolute inset-0 rounded-xl ring-2 ring-green-500/60 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen share layout
// ---------------------------------------------------------------------------

export function ScreenShareView({
  participants,
  localParticipantId,
}: VideoGridProps) {
  const presenter = participants.find((p) => p.isScreenSharing);
  const others = participants.filter((p) => p.id !== presenter?.id);

  if (!presenter) return null;

  return (
    <div className="flex h-full gap-2 p-2">
      {/* Main screen share area — 80% width */}
      <div className="w-4/5 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700 flex items-center justify-center min-h-[320px]">
        {presenter.screenShareTrack ? (
          <VideoTrackRenderer
            track={presenter.screenShareTrack}
            objectFit="contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <MonitorUp className="h-10 w-10" />
            <span className="text-sm font-medium">
              {presenter.name} is sharing their screen
            </span>
          </div>
        )}
      </div>

      {/* Side strip of participant tiles — 20% width */}
      <div className="w-1/5 flex flex-col gap-2 overflow-y-auto">
        <ParticipantTile
          participant={presenter}
          isLocal={presenter.id === localParticipantId}
        />
        {others.map((p) => (
          <ParticipantTile
            key={p.id}
            participant={p}
            isLocal={p.id === localParticipantId}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Standard grid layout
// ---------------------------------------------------------------------------

export function VideoGrid({ participants, localParticipantId }: VideoGridProps) {
  const screenSharer = useMemo(
    () => participants.find((p) => p.isScreenSharing),
    [participants],
  );

  // If someone is sharing, delegate to the screen share layout
  if (screenSharer) {
    return (
      <ScreenShareView
        participants={participants}
        localParticipantId={localParticipantId}
      />
    );
  }

  // Find the active speaker for the "large" highlight when more than 4 participants
  const activeSpeaker = participants.find((p) => p.isSpeaking);

  // With many participants, show the active speaker prominently
  if (participants.length > 4 && activeSpeaker) {
    const others = participants.filter((p) => p.id !== activeSpeaker.id);
    return (
      <div className="flex flex-col h-full gap-2 p-2">
        <div className="flex-1">
          <ParticipantTile
            participant={activeSpeaker}
            isLocal={activeSpeaker.id === localParticipantId}
            large
          />
        </div>
        <div className={cn('grid gap-2', gridCols(others.length))}>
          {others.map((p) => (
            <ParticipantTile
              key={p.id}
              participant={p}
              isLocal={p.id === localParticipantId}
            />
          ))}
        </div>
      </div>
    );
  }

  // Standard even grid
  return (
    <div className={cn('grid gap-2 h-full p-2', gridCols(participants.length))}>
      {participants.map((p) => (
        <ParticipantTile
          key={p.id}
          participant={p}
          isLocal={p.id === localParticipantId}
        />
      ))}
    </div>
  );
}
