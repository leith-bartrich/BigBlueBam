import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bbbGet, bbbPost } from '@/lib/bbb-api';
import { formatRelativeTime } from '@/lib/utils';

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  deep_link?: string | null;
}

interface NotificationsBellProps {
  /** Called when a notification's deep_link is an in-app (/banter/...) path. */
  onNavigate?: (path: string) => void;
}

/**
 * Banter port of Bam's notifications dropdown. The unified notifications
 * source is /b3/api/me/notifications (a sibling agent is extending the
 * backend to include Banter notifications).
 *
 * Navigation rules when a notification is clicked:
 *   - marks the notification read via POST /me/notifications/:id/read
 *   - if deep_link starts with /banter/ → onNavigate(relativePath)
 *   - otherwise → window.location.href = deep_link (cross-app)
 */
export function NotificationsBell({ onNavigate }: NotificationsBellProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: notificationsRes } = useQuery({
    queryKey: ['bbb', 'notifications'],
    queryFn: () => bbbGet<{ data: Notification[] }>('/me/notifications'),
    refetchInterval: 30_000,
  });
  const notifications = notificationsRes?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useMutation({
    mutationFn: () => bbbPost('/me/notifications/mark-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bbb', 'notifications'] });
    },
  });

  const markOneRead = useMutation({
    mutationFn: (id: string) => bbbPost(`/me/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bbb', 'notifications'] });
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleNotifClick = (notif: Notification) => {
    if (!notif.read) {
      markOneRead.mutate(notif.id);
    }
    setOpen(false);
    const deepLink = notif.deep_link;
    if (!deepLink) return;
    if (deepLink.startsWith('/banter/')) {
      // Strip the /banter prefix to get the SPA route
      const relative = deepLink.replace(/^\/banter/, '') || '/';
      if (onNavigate) {
        onNavigate(relative);
      } else {
        window.location.href = deepLink;
      }
    } else {
      window.location.href = deepLink;
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-80 max-h-96 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl dark:bg-zinc-800 dark:border-zinc-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>
          {notifications.length > 0 ? (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700/40 transition-colors ${
                    !notif.read ? 'bg-primary-50/50 dark:bg-zinc-800/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notif.read && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {notif.title}
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400 line-clamp-2">{notif.body}</p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {formatRelativeTime(notif.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">No notifications yet</div>
          )}
        </div>
      )}
    </div>
  );
}
