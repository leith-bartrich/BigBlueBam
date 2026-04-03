import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { MessageSquare, Mail, Clock } from 'lucide-react';
import { cn, generateAvatarInitials, presenceColor } from '@/lib/utils';

interface UserProfilePopoverProps {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  email?: string;
  presence?: string;
  role?: string;
  children: React.ReactNode;
  onStartDM?: (userId: string) => void;
}

export function UserProfilePopover({
  userId,
  displayName,
  avatarUrl,
  email,
  presence = 'offline',
  role,
  children,
  onStartDM,
}: UserProfilePopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="w-72 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl p-4 z-50 animate-in fade-in-0 zoom-in-95"
          sideOffset={8}
          align="start"
        >
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <div className="h-12 w-12 rounded-xl bg-primary-600 flex items-center justify-center text-white text-lg font-semibold">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  generateAvatarInitials(displayName)
                )}
              </div>
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-zinc-800',
                  presenceColor(presence),
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                {displayName}
              </p>
              {role && (
                <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
                  {role}
                </span>
              )}
              <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
                <Clock className="h-3 w-3" />
                <span className="capitalize">{presence}</span>
              </div>
            </div>
          </div>

          {email && (
            <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500">
              <Mail className="h-3 w-3" />
              <span className="truncate">{email}</span>
            </div>
          )}

          {onStartDM && (
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => {
                  onStartDM(userId);
                  setOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Send direct message
              </button>
            </div>
          )}

          <Popover.Arrow className="fill-white dark:fill-zinc-800" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
