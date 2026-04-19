import { useState } from 'react';
import { ArrowLeft, Activity, Loader2 } from 'lucide-react';
import { useAutomation, type ExecutionStatus } from '@/hooks/use-automations';
import { useExecutions } from '@/hooks/use-executions';
import { StatusBadge } from '@/components/execution/status-badge';
import { formatRelativeTime, formatDuration } from '@/lib/utils';

interface AutomationExecutionsPageProps {
  automationId: string;
  onNavigate: (path: string) => void;
}

const statusOptions: { value: ExecutionStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'partial', label: 'Partial' },
  { value: 'running', label: 'Running' },
  { value: 'skipped', label: 'Skipped' },
];

export function AutomationExecutionsPage({ automationId, onNavigate }: AutomationExecutionsPageProps) {
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | undefined>(undefined);

  const { data: automationResponse } = useAutomation(automationId);
  const { data: executionsResponse, isLoading } = useExecutions(automationId, { status: statusFilter });

  const automation = automationResponse?.data;
  const executions = executionsResponse?.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <button
        onClick={() => onNavigate(`/automations/${automationId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {automation?.name ?? 'Automation'}
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {automation?.name ?? 'Automation'} — Executions
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Execution history for this automation.
        </p>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1">
        {statusOptions.map((opt) => (
          <button
            key={opt.label}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusFilter === opt.value
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : executions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <Activity className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No executions yet</p>
          <p className="text-sm mt-1">This automation hasn't run yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Conditions Met</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Error</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {executions.map((execution) => (
                <tr
                  key={execution.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                  onClick={() => onNavigate(`/executions/${execution.id}`)}
                >
                  <td className="px-4 py-3">
                    <StatusBadge status={execution.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {formatDuration(execution.duration_ms)}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {execution.conditions_met ? 'Yes' : 'No'}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-500 truncate max-w-xs">
                    {execution.error_message ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {formatRelativeTime(execution.started_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
