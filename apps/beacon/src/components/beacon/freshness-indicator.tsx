import { cn } from '@/lib/utils';

type Freshness = 'fresh' | 'expiring' | 'expired';

function computeFreshness(lastVerifiedAt: string | null, expiresAt: string | null): Freshness {
  const now = Date.now();

  // If there is an explicit expiry date, check it
  if (expiresAt) {
    const expiryMs = new Date(expiresAt).getTime();
    if (expiryMs < now) return 'expired';
    const daysUntilExpiry = (expiryMs - now) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry <= 14) return 'expiring';
  }

  // Fall back to last-verified staleness check
  if (lastVerifiedAt) {
    const daysSinceVerify = (now - new Date(lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceVerify > 30) return 'expired';
    if (daysSinceVerify > 16) return 'expiring';
    return 'fresh';
  }

  // Never verified — treat as expired
  return 'expired';
}

const freshnessColors: Record<Freshness, string> = {
  fresh: 'bg-green-500',
  expiring: 'bg-yellow-500',
  expired: 'bg-red-500',
};

const freshnessLabels: Record<Freshness, string> = {
  fresh: 'Verified recently',
  expiring: 'Expiring soon',
  expired: 'Needs verification',
};

interface FreshnessIndicatorProps {
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  className?: string;
}

export function FreshnessIndicator({ lastVerifiedAt, expiresAt, className }: FreshnessIndicatorProps) {
  const freshness = computeFreshness(lastVerifiedAt, expiresAt);

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={freshnessLabels[freshness]}>
      <span className={cn('h-2 w-2 rounded-full shrink-0', freshnessColors[freshness])} />
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{freshnessLabels[freshness]}</span>
    </span>
  );
}
