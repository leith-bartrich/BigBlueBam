import { Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HuddleParticipant {
  id: string;
  name: string;
  avatar_url?: string;
}

interface HuddleBannerProps {
  huddleId: string;
  participants: HuddleParticipant[];
  onJoin: () => void;
}

export function HuddleBanner({ huddleId: _huddleId, participants, onJoin }: HuddleBannerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
      <div className="flex items-center gap-2">
        <Headphones className="h-4 w-4 text-green-600 dark:text-green-400" />
        <span className="text-sm font-medium text-green-700 dark:text-green-300">
          Huddle in progress
        </span>
      </div>

      {/* Participant avatars */}
      <div className="flex -space-x-2">
        {participants.slice(0, 5).map((p) => {
          const initials = p.name
            .split(/\s+/)
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={p.id}
              className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold',
                'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
                'border-2 border-green-50 dark:border-green-900/20',
              )}
              title={p.name}
            >
              {p.avatar_url ? (
                <img
                  src={p.avatar_url}
                  alt={p.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
          );
        })}
        {participants.length > 5 && (
          <div
            className={cn(
              'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold',
              'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300',
              'border-2 border-green-50 dark:border-green-900/20',
            )}
          >
            +{participants.length - 5}
          </div>
        )}
      </div>

      {participants.length > 0 && (
        <span className="text-xs text-green-600 dark:text-green-400">
          {participants.length} participant{participants.length !== 1 ? 's' : ''}
        </span>
      )}

      <button
        onClick={onJoin}
        className={cn(
          'ml-auto px-3 py-1 rounded-md text-sm font-medium transition-colors',
          'bg-green-600 text-white hover:bg-green-700',
        )}
      >
        Join
      </button>
    </div>
  );
}
