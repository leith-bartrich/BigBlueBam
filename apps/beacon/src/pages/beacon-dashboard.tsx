import { useState, useMemo } from 'react';
import {
  Loader2,
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Bot,
  ShieldCheck,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/common/button';
import { StatusBadge } from '@/components/beacon/status-badge';
import { useVerifyBeacon, useChallengeBeacon, useRestoreBeacon, useRetireBeacon } from '@/hooks/use-beacons';
import type { Beacon } from '@/hooks/use-beacons';
import {
  useFreshnessScore,
  useAtRiskBeacons,
  useArchivedBacklog,
  useActiveBeacons,
  useRecentVerifications,
} from '@/hooks/use-dashboard';
import { formatDate, formatRelativeTime } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────

interface BeaconDashboardPageProps {
  onNavigate: (path: string) => void;
}

type DashboardTab = 'overview' | 'at-risk' | 'archived' | 'agent-activity';

// ── Main Page ────────────────────────────────────────────────────────

export function BeaconDashboardPage({ onNavigate: _onNavigate }: BeaconDashboardPageProps) {
  const [tab, setTab] = useState<DashboardTab>('overview');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Activity className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Fridge Cleanout
              </h1>
              <p className="text-xs text-zinc-500">Knowledge governance dashboard</p>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 border-t border-zinc-100 dark:border-zinc-800">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
            Overview
          </TabButton>
          <TabButton active={tab === 'at-risk'} onClick={() => setTab('at-risk')}>
            At-Risk
          </TabButton>
          <TabButton active={tab === 'archived'} onClick={() => setTab('archived')}>
            Archived
          </TabButton>
          <TabButton active={tab === 'agent-activity'} onClick={() => setTab('agent-activity')}>
            Agent Activity
          </TabButton>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'at-risk' && <AtRiskTab />}
        {tab === 'archived' && <ArchivedTab />}
        {tab === 'agent-activity' && <AgentActivityTab />}
      </main>
    </div>
  );
}

// ── Tab Button ───────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ' +
        (active
          ? 'border-primary-600 text-primary-700 dark:text-primary-400'
          : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')
      }
    >
      {children}
    </button>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'default',
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const iconAccent: Record<string, string> = {
    default: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <div className={'flex items-center justify-center h-8 w-8 rounded-lg ' + iconAccent[accent]}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

// ── Loading / Error helpers ──────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
      {message}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────

function OverviewTab() {
  const { score, isLoading: scoreLoading } = useFreshnessScore();
  const { data: atRisk, isLoading: riskLoading } = useAtRiskBeacons();
  const { data: archived, isLoading: archiveLoading } = useArchivedBacklog();
  const { data: active, isLoading: activeLoading } = useActiveBeacons();

  const isLoading = scoreLoading || riskLoading || archiveLoading || activeLoading;

  const archivedOlderThan30 = useMemo(() => {
    if (!archived) return 0;
    const cutoff = Date.now() - 30 * 86400000;
    return archived.filter((b) => new Date(b.updated_at).getTime() < cutoff).length;
  }, [archived]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wider">
          Knowledge Health
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Freshness Score"
            value={`${score.percent}%`}
            icon={CheckCircle2}
            accent={score.percent >= 80 ? 'success' : score.percent >= 50 ? 'warning' : 'danger'}
          />
          <StatCard
            label="At-Risk (7 days)"
            value={atRisk?.length ?? 0}
            icon={AlertTriangle}
            accent={(atRisk?.length ?? 0) > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label="Archived Backlog"
            value={archivedOlderThan30}
            icon={Archive}
            accent={archivedOlderThan30 > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label="Total Active"
            value={active?.length ?? 0}
            icon={Activity}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wider">
          Freshness Breakdown
        </h2>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <div className="h-3 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className={
                    'h-full rounded-full transition-all duration-500 ' +
                    (score.percent >= 80
                      ? 'bg-green-500'
                      : score.percent >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500')
                  }
                  style={{ width: `${score.percent}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 tabular-nums w-12 text-right">
              {score.percent}%
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {score.fresh} of {score.total} active beacons verified within 30 days
          </p>
        </div>
      </section>
    </div>
  );
}

// ── At-Risk Tab ──────────────────────────────────────────────────────

function AtRiskTab() {
  const { data: beacons, isLoading, error } = useAtRiskBeacons();
  const verify = useVerifyBeacon();
  const challenge = useChallengeBeacon();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message="Failed to load at-risk beacons" />;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!beacons) return;
    if (selected.size === beacons.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(beacons.map((b) => b.id)));
    }
  };

  const bulkVerify = async () => {
    for (const id of selected) {
      await verify.mutateAsync(id);
    }
    setSelected(new Set());
  };

  if (!beacons || beacons.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-3" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No beacons expiring within 7 days. All clear!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {beacons.length} beacon{beacons.length === 1 ? '' : 's'} expiring within 7 days
        </p>
        {selected.size > 0 && (
          <Button size="sm" onClick={bulkVerify} loading={verify.isPending}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Verify Selected ({selected.size})
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-2.5 w-10">
                <input
                  type="checkbox"
                  checked={selected.size === beacons.length && beacons.length > 0}
                  onChange={toggleAll}
                  className="rounded border-zinc-300 dark:border-zinc-600"
                />
              </th>
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Expires</th>
              <th className="px-4 py-2.5">Owner</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {beacons.map((beacon) => (
              <AtRiskRow
                key={beacon.id}
                beacon={beacon}
                selected={selected.has(beacon.id)}
                onToggle={() => toggleSelect(beacon.id)}
                onVerify={() => verify.mutate(beacon.id)}
                onChallenge={() => challenge.mutate(beacon.id)}
                isPending={verify.isPending || challenge.isPending}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AtRiskRow({
  beacon,
  selected,
  onToggle,
  onVerify,
  onChallenge,
  isPending,
}: {
  beacon: Beacon;
  selected: boolean;
  onToggle: () => void;
  onVerify: () => void;
  onChallenge: () => void;
  isPending: boolean;
}) {
  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded border-zinc-300 dark:border-zinc-600"
        />
      </td>
      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{beacon.title}</td>
      <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
        {beacon.expires_at ? formatDate(beacon.expires_at) : '--'}
      </td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs">
        {beacon.owner_name ?? '--'}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={beacon.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="primary" onClick={onVerify} disabled={isPending}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Verify
          </Button>
          <Button size="sm" variant="secondary" onClick={onChallenge} disabled={isPending}>
            Challenge
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ── Archived Tab ─────────────────────────────────────────────────────

function ArchivedTab() {
  const { data: beacons, isLoading, error } = useArchivedBacklog();
  const restore = useRestoreBeacon();
  const retire = useRetireBeacon();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filter to beacons archived > 30 days
  const oldArchived = useMemo(() => {
    if (!beacons) return [];
    const cutoff = Date.now() - 30 * 86400000;
    return beacons.filter((b) => new Date(b.updated_at).getTime() < cutoff);
  }, [beacons]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message="Failed to load archived beacons" />;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === oldArchived.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(oldArchived.map((b) => b.id)));
    }
  };

  const bulkRetire = async () => {
    for (const id of selected) {
      await retire.mutateAsync(id);
    }
    setSelected(new Set());
  };

  if (oldArchived.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
        <Archive className="h-8 w-8 text-zinc-400 mx-auto mb-3" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No archived beacons older than 30 days. Nothing to clean up.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {oldArchived.length} beacon{oldArchived.length === 1 ? '' : 's'} archived for 30+ days
        </p>
        {selected.size > 0 && (
          <Button size="sm" variant="danger" onClick={bulkRetire} loading={retire.isPending}>
            <Trash2 className="h-3.5 w-3.5" />
            Retire Selected ({selected.size})
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-2.5 w-10">
                <input
                  type="checkbox"
                  checked={selected.size === oldArchived.length && oldArchived.length > 0}
                  onChange={toggleAll}
                  className="rounded border-zinc-300 dark:border-zinc-600"
                />
              </th>
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Archived Since</th>
              <th className="px-4 py-2.5">Owner</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {oldArchived.map((beacon) => (
              <tr
                key={beacon.id}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(beacon.id)}
                    onChange={() => toggleSelect(beacon.id)}
                    className="rounded border-zinc-300 dark:border-zinc-600"
                  />
                </td>
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                  {beacon.title}
                </td>
                <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                  {formatDate(beacon.updated_at)}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs">
                  {beacon.owner_name ?? '--'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => restore.mutate(beacon.id)}
                      disabled={restore.isPending || retire.isPending}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => retire.mutate(beacon.id)}
                      disabled={restore.isPending || retire.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Retire
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Agent Activity Tab ───────────────────────────────────────────────

function AgentActivityTab() {
  const { data: verifications, isLoading, error } = useRecentVerifications();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message="Failed to load verification activity" />;

  if (!verifications || verifications.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
        <Bot className="h-8 w-8 text-zinc-400 mx-auto mb-3" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No recent verification activity to display.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Recent verification events across all beacons
      </p>

      <div className="flex flex-col gap-3">
        {verifications.map((beacon) => (
          <div
            key={beacon.id}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center gap-4"
          >
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
              <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {beacon.title}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Verified by {beacon.owner_name ?? 'unknown'} {' '}
                {formatRelativeTime(beacon.last_verified_at)}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-zinc-500 tabular-nums">
                v{beacon.verification_count}
              </span>
              <StatusBadge status={beacon.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
