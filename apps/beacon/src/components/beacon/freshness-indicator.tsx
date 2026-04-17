import { cn } from '@/lib/utils';

type Freshness = 'fresh' | 'stale' | 'expiring' | 'expired';

export function computeFreshness(lastVerifiedAt: string | null, expiresAt: string | null): Freshness {
  const now = Date.now();

  // If there is an explicit expiry date, check it first
  if (expiresAt) {
    const expiryMs = new Date(expiresAt).getTime();
    if (expiryMs < now) return 'expired';
    const daysUntilExpiry = (expiryMs - now) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry <= 14) return 'expiring';
  }

  // Fall back to last-verified staleness check
  if (lastVerifiedAt) {
    const daysSinceVerify = (now - new Date(lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceVerify > 90) return 'expired';
    if (daysSinceVerify > 30) return 'stale';
    if (daysSinceVerify > 16) return 'expiring';
    return 'fresh';
  }

  // Never verified -- treat as expired
  return 'expired';
}

const freshnessColors: Record<Freshness, string> = {
  fresh: 'bg-green-500',
  stale: 'bg-amber-500',
  expiring: 'bg-yellow-500',
  expired: 'bg-red-500',
};

const freshnessLabels: Record<Freshness, string> = {
  fresh: 'Verified recently',
  stale: 'Content is stale',
  expiring: 'Expiring soon',
  expired: 'Needs verification',
};

interface FreshnessIndicatorProps {
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  className?: string;
  /** When true, renders a pill-style badge instead of a dot + text. */
  badge?: boolean;
}

const badgeStyles: Record<Freshness, string> = {
  fresh: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  stale: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  expiring: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function FreshnessIndicator({ lastVerifiedAt, expiresAt, className, badge }: FreshnessIndicatorProps) {
  const freshness = computeFreshness(lastVerifiedAt, expiresAt);

  if (badge) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
          badgeStyles[freshness],
          className,
        )}
        title={freshnessLabels[freshness]}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', freshnessColors[freshness])} />
        {freshness === 'fresh' ? 'Fresh' : freshness === 'stale' ? 'Stale' : freshness === 'expiring' ? 'Expiring' : 'Expired'}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={freshnessLabels[freshness]}>
      <span className={cn('h-2 w-2 rounded-full shrink-0', freshnessColors[freshness])} />
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{freshnessLabels[freshness]}</span>
    </span>
  );
}
