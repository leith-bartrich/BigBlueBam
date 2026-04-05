import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';

/**
 * Small banner prompting the user to enable browser notifications.
 * Only shown when Notification.permission is 'default' (not yet requested).
 */
export function NotificationPrompt() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  if (permission !== 'default' || dismissed) return null;

  const handleEnable = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/40 px-4 py-3 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        <Bell className="h-4 w-4 text-primary-600 dark:text-primary-400 shrink-0" />
        <p className="text-sm text-primary-900 dark:text-primary-100 truncate">
          Get notified when agents respond to your tickets.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleEnable}
          className="text-sm font-medium px-3 py-1.5 rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          Enable notifications
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="p-1 rounded-md text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/60 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
