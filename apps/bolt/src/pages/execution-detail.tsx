import { Loader2, ArrowLeft, RotateCcw } from 'lucide-react';
import { useExecution, useRetryExecution } from '@/hooks/use-executions';
import { StatusBadge } from '@/components/execution/status-badge';
import { ExecutionTimeline } from '@/components/execution/execution-timeline';
import { Button } from '@/components/common/button';
import { formatRelativeTime, formatDuration } from '@/lib/utils';

interface ExecutionDetailPageProps {
  id: string;
  onNavigate: (path: string) => void;
}

export function ExecutionDetailPage({ id, onNavigate }: ExecutionDetailPageProps) {
  const { data: response, isLoading } = useExecution(id);
  const retryMutation = useRetryExecution();

  const execution = response?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-zinc-400">
        <p className="text-lg font-medium">Execution not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => onNavigate('/executions')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Executions
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <button
        onClick={() => onNavigate('/executions')}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Executions
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {execution.automation_name}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Execution {execution.id.slice(0, 8)}... started {formatRelativeTime(execution.started_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={execution.status} />
          {(execution.status === 'failed' || execution.status === 'partial') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => retryMutation.mutate(execution.id)}
              loading={retryMutation.isPending}
            >
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-xs text-zinc-500 mb-1">Duration</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {formatDuration(execution.duration_ms)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-xs text-zinc-500 mb-1">Conditions Met</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {execution.conditions_met ? 'Yes' : 'No'}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-xs text-zinc-500 mb-1">Steps</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {execution.steps.length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-xs text-zinc-500 mb-1">Completed</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {execution.completed_at ? formatRelativeTime(execution.completed_at) : 'In progress'}
          </p>
        </div>
      </div>

      {/* Error message */}
      {execution.error_message && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Error</h3>
          <p className="text-sm text-red-600 dark:text-red-400">
            {execution.error_message}
            {execution.error_step != null && (
              <span className="ml-2 text-xs text-red-500">(at step #{execution.error_step + 1})</span>
            )}
          </p>
        </div>
      )}

      {/* Trigger event */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Trigger Event</h2>
        </div>
        <div className="p-5">
          <pre className="text-xs bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 overflow-x-auto text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            {JSON.stringify(execution.trigger_event, null, 2)}
          </pre>
        </div>
      </div>

      {/* Condition log */}
      {execution.condition_log != null && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Condition Evaluation</h2>
          </div>
          <div className="p-5">
            <pre className="text-xs bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 overflow-x-auto text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              {JSON.stringify(execution.condition_log, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Step timeline */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Execution Steps</h2>
        </div>
        <div className="p-5">
          <ExecutionTimeline steps={execution.steps} />
        </div>
      </div>
    </div>
  );
}
