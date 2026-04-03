import { Phone, PhoneOff, Video } from 'lucide-react';
import { cn, generateAvatarInitials } from '@/lib/utils';

interface IncomingCallOverlayProps {
  callerName: string;
  callerAvatarUrl: string | null;
  callType: 'voice' | 'video';
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallOverlay({
  callerName,
  callerAvatarUrl,
  callType,
  onAccept,
  onDecline,
}: IncomingCallOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xl px-10 py-8 max-w-sm w-full mx-4">
        {/* Ringing animation ring */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing rings */}
          <span className="absolute h-24 w-24 rounded-full bg-green-500/20 animate-ping" />
          <span
            className="absolute h-20 w-20 rounded-full bg-green-500/30 animate-ping"
            style={{ animationDelay: '300ms' }}
          />

          {/* Avatar */}
          <div className="relative h-16 w-16 rounded-full bg-primary-600 flex items-center justify-center text-white text-xl font-semibold z-10 ring-4 ring-white dark:ring-zinc-800">
            {callerAvatarUrl ? (
              <img
                src={callerAvatarUrl}
                alt={callerName}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              generateAvatarInitials(callerName)
            )}
          </div>
        </div>

        {/* Caller info */}
        <div className="text-center">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {callerName}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Incoming {callType === 'video' ? 'video' : 'voice'} call...
          </p>
        </div>

        {/* Accept / Decline buttons */}
        <div className="flex items-center gap-6">
          <button
            onClick={onDecline}
            className={cn(
              'flex flex-col items-center gap-1.5 group',
            )}
            title="Decline"
          >
            <span className="flex items-center justify-center h-14 w-14 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transition-colors group-active:scale-95">
              <PhoneOff className="h-6 w-6" />
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Decline
            </span>
          </button>

          <button
            onClick={onAccept}
            className={cn(
              'flex flex-col items-center gap-1.5 group',
            )}
            title="Accept"
          >
            <span className="flex items-center justify-center h-14 w-14 rounded-full bg-green-600 text-white shadow-lg hover:bg-green-700 transition-colors group-active:scale-95 animate-bounce">
              {callType === 'video' ? (
                <Video className="h-6 w-6" />
              ) : (
                <Phone className="h-6 w-6" />
              )}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Accept
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
