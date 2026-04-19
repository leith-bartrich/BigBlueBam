import {
  PlusCircle,
  List,
  Network,
  Search,
  AlertTriangle,
  Clock,
  BookOpen,
} from 'lucide-react';
import { useBeaconStats } from '@/hooks/use-beacons';
import { useGraphRecent } from '@/hooks/use-graph';
import { StatusBadge } from '@/components/beacon/status-badge';
import { FreshnessIndicator } from '@/components/beacon/freshness-indicator';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { data: stats } = useBeaconStats();
  const { data: recentNodes } = useGraphRecent('organization', undefined, 7);

  const totalBeacons = stats?.total ?? 0;
  const atRiskCount = stats?.at_risk ?? 0;
  const recentCount = stats?.recently_updated ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Knowledge Home</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Welcome to Beacon, your team's knowledge base.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<BookOpen className="h-5 w-5 text-primary-500" />}
          label="Total Beacons"
          value={totalBeacons}
          onClick={() => onNavigate('/list')}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />}
          label="At Risk (7d)"
          value={atRiskCount}
          accent={atRiskCount > 0 ? 'yellow' : undefined}
          onClick={() => onNavigate('/list')}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-green-500" />}
          label="Recently Updated"
          value={recentCount}
          onClick={() => onNavigate('/graph')}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ActionCard
          icon={<PlusCircle className="h-5 w-5" />}
          title="Create a Beacon"
          description="Write a new knowledge article"
          onClick={() => onNavigate('/create')}
        />
        <ActionCard
          icon={<List className="h-5 w-5" />}
          title="Browse"
          description="Explore existing articles"
          onClick={() => onNavigate('/list')}
        />
        <ActionCard
          icon={<Search className="h-5 w-5" />}
          title="Search"
          description="Find knowledge with semantic search"
          onClick={() => onNavigate('/search')}
        />
        <ActionCard
          icon={<Network className="h-5 w-5" />}
          title="Knowledge Graph"
          description="Visualize connections"
          onClick={() => onNavigate('/graph')}
        />
      </div>

      {/* Recent activity */}
      {recentNodes && recentNodes.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            Recent Activity
          </h2>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentNodes.slice(0, 8).map((node) => (
              <button
                key={node.id}
                onClick={() => onNavigate(`/${node.slug}`)}
                className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {node.title}
                  </p>
                  {node.summary && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {node.summary}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <FreshnessIndicator
                    lastVerifiedAt={node.last_verified_at}
                    expiresAt={node.expires_at}
                  />
                  <StatusBadge status={node.status} />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: 'yellow';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 text-left hover:border-primary-300 hover:bg-primary-50/30 dark:hover:border-primary-700 dark:hover:bg-primary-900/10 transition-colors"
    >
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {value}
          </p>
          <p className={`text-xs ${accent === 'yellow' && value > 0 ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 'text-zinc-500 dark:text-zinc-400'}`}>
            {label}
          </p>
        </div>
      </div>
    </button>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 text-left hover:border-primary-300 hover:bg-primary-50/50 dark:hover:border-primary-700 dark:hover:bg-primary-900/10 transition-colors"
    >
      <div className="text-primary-600 dark:text-primary-400 mb-2">{icon}</div>
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </button>
  );
}
