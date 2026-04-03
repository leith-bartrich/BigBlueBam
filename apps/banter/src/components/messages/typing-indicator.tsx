import { useTypingIndicators } from '@/hooks/use-typing';
import { useAuthStore } from '@/stores/auth.store';

interface TypingIndicatorProps {
  channelId: string;
}

export function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const typingNames = useTypingIndicators(channelId);
  const currentUser = useAuthStore((s) => s.user);

  // Filter out the current user
  const others = typingNames.filter((name) => name !== currentUser?.display_name);

  if (others.length === 0) return null;

  let text: string;
  if (others.length === 1) {
    text = `${others[0]} is typing`;
  } else if (others.length === 2) {
    text = `${others[0]} and ${others[1]} are typing`;
  } else {
    text = `${others[0]}, ${others[1]}, and ${others.length - 2} more are typing`;
  }

  return (
    <div className="px-4 py-1 h-6">
      <p className="text-xs text-zinc-500 flex items-center gap-1">
        <span className="flex gap-0.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse-dot" style={{ animationDelay: '0ms' }} />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse-dot" style={{ animationDelay: '200ms' }} />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse-dot" style={{ animationDelay: '400ms' }} />
        </span>
        {text}
      </p>
    </div>
  );
}
