import { useState, useMemo } from 'react';
import { Activity, Loader2, Filter, X } from 'lucide-react';
import { useOrgExecutions, type BoltExecution } from '@/hooks/use-executions';
import type { ExecutionStatus } from '@/hooks/use-automations';
import { StatusBadge } from '@/components/execution/status-badge';
import { formatRelativeTime, formatDuration } from '@/lib/utils';

interface ExecutionLogPageProps {
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

/** Pull source + event_type from the trigger_event JSON in priority order.
 *  Producers vary. Some write { source, event_type }, some write nested
 *  { payload: {...}, event_type }. Fall back gracefully so the cell is
 *  never blank when there's useful identifying info on the row. */
function summarizeTrigger(
  triggerEvent: Record<string, unknown> | null | undefined,
): { label: string; source: string | null } {
  if (!triggerEvent || typeof triggerEvent !== 'object') return { label: '-', source: null };
  const eventType = typeof triggerEvent.event_type === 'string' ? triggerEvent.event_type : null;
  const source = typeof triggerEvent.source === 'string' ? triggerEvent.source : null;
  if (eventType) return { label: eventType, source };
  const json = JSON.stringify(triggerEvent);
  return { label: json.length > 80 ? `${json.slice(0, 80)}...` : json, source };
}

function ExecutionRow({ execution, onNavigate }: { execution: BoltExecution; onNavigate: (path: string) => void }) {
  const trigger = summarizeTrigger(execution.trigger_event);
  return (
    <tr
      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
      onClick={() => onNavigate(`/executions/${execution.id}`)}
    >
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {execution.automation_name}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {trigger.source && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {trigger.source}
            </span>
          )}
          <span className="text-xs text-zinc-500 font-mono truncate max-w-xs">
            {trigger.label}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={execution.status} />
      </td>
      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {formatDuration(execution.duration_ms)}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {execution.conditions_met ? 'Yes' : 'No'}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-500">
        {formatRelativeTime(execution.started_at)}
      </td>
    </tr>
  );
}

export function ExecutionLogPage({ onNavigate }: ExecutionLogPageProps) {
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | undefined>(undefined);
  const [automationFilter, setAutomationFilter] = useState<string | undefined>(undefined);

  const { data: response, isLoading } = useOrgExecutions({ status: statusFilter });
  const rawExecutions = response?.data ?? [];

  // Distinct automations present in the current page of results, so the
  // filter chip list stays scoped to what the user can actually pick.
  const automationOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of rawExecutions) {
      if (!map.has(e.automation_id)) {
        map.set(e.automation_id, e.automation_name);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [rawExecutions]);

  const executions = automationFilter
    ? rawExecutions.filter((e) => e.automation_id === automationFilter)
    : rawExecutions;

  const activeAutomationName =
    automationFilter && automationOptions.find((a) => a.id === automationFilter)?.name;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Execution Log</h1>
        <p className="text-sm text-zinc-500 mt-1">History of all automation runs across your organization.</p>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1 flex-wrap">
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

        {automationOptions.length > 1 && (
          <div className="flex items-center gap-1 ml-auto">
            <Filter className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={automationFilter ?? ''}
              onChange={(e) => setAutomationFilter(e.target.value || undefined)}
              className="text-xs px-2 py-1.5 rounded-lg border border-zinc-200 bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All automations</option>
              {automationOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
            {automationFilter && (
              <button
                onClick={() => setAutomationFilter(undefined)}
                title={`Clear filter: ${activeAutomationName ?? ''}`}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : executions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <Activity className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No executions found</p>
          <p className="text-sm mt-1">Automations that run will show up here.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Automation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Conditions Met</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {executions.map((execution) => (
                <ExecutionRow key={execution.id} execution={execution} onNavigate={onNavigate} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
