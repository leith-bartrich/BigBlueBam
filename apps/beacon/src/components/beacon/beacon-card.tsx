import type { Beacon } from '@/hooks/use-beacons';
import { StatusBadge } from './status-badge';
import { FreshnessIndicator } from './freshness-indicator';
import { truncate, formatRelativeTime } from '@/lib/utils';

interface BeaconCardProps {
  beacon: Beacon;
  onClick: () => void;
}

export function BeaconCard({ beacon, onClick }: BeaconCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 hover:border-primary-300 hover:bg-primary-50/30 dark:hover:border-primary-700 dark:hover:bg-primary-900/10 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {beacon.title}
            </h3>
            <StatusBadge status={beacon.status} />
          </div>

          {beacon.summary && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
              {truncate(beacon.summary, 200)}
            </p>
          )}

          {beacon.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {beacon.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <FreshnessIndicator
            lastVerifiedAt={beacon.last_verified_at}
            expiresAt={beacon.expires_at}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        {beacon.owner_name && <span>{beacon.owner_name}</span>}
        {beacon.project_name && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span>{beacon.project_name}</span>
          </>
        )}
        <span aria-hidden="true">&middot;</span>
        <span>{formatRelativeTime(beacon.updated_at)}</span>
      </div>
    </button>
  );
}
