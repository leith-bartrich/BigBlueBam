/**
 * Canonical NotificationsBell component shared across all BigBlueBam apps.
 *
 * Every frontend app imports this file via a Vite alias:
 *   '@bigbluebam/ui/notifications-bell' -> '<root>/packages/ui/notifications-bell.tsx'
 *
 * Reads the unified per-user notification feed from the Bam auth API
 * (GET /b3/api/me/notifications, authenticated via the shared session
 * cookie). Polls every 30 seconds to refresh the unread badge.
 *
 * Clicking a notification marks it read (POST /me/notifications/:id/read)
 * and either routes in-app (when its `deep_link` matches `inAppPrefix`)
 * or navigates cross-app via a full page load.
 */

import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  deep_link?: string | null;
}

export interface NotificationsBellProps {
  /**
   * When a notification's `deep_link` starts with this prefix (e.g.
   * '/blast/'), we strip the prefix and call `onNavigate` with the
   * remaining SPA path. Otherwise we navigate cross-app via
   * window.location.href.
   */
  inAppPrefix: string;
  /** In-app navigation handler for the host SPA's router. */
  onNavigate?: (path: string) => void;
}

function joinUrl(path: string): string {
  return `/b3/api${path}`;
}

async function bbbGet<T>(path: string): Promise<T> {
  const res = await fetch(joinUrl(path), { credentials: 'include' });
  if (!res.ok) throw new Error(`Bam API error: ${res.status}`);
  return res.json();
}

async function bbbPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(joinUrl(path), {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Bam API error: ${res.status}`);
  return res.json();
}

/** Best-effort relative time formatter that does not pull in date-fns. */
function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.round(mo / 12);
  return `${yr}y ago`;
}

export function NotificationsBell({ inAppPrefix, onNavigate }: NotificationsBellProps) {
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

  // Close dropdown on outside click.
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
    if (deepLink.startsWith(inAppPrefix)) {
      const relative = deepLink.slice(inAppPrefix.length - 1) || '/';
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
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell className="h-4.5 w-4.5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-1 z-50 w-80 max-h-96 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl dark:bg-zinc-800 dark:border-zinc-700"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
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
                  type="button"
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
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
              No notifications yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
