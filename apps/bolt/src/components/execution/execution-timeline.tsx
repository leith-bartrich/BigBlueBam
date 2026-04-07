import type { BoltExecutionStep } from '@/hooks/use-executions';
import { cn, formatDuration } from '@/lib/utils';
import { CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface ExecutionTimelineProps {
  steps: BoltExecutionStep[];
}

const stepStatusConfig: Record<BoltExecutionStep['status'], { icon: typeof CheckCircle2; color: string; dotColor: string }> = {
  success: { icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', dotColor: 'bg-green-500' },
  failed: { icon: XCircle, color: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500' },
  skipped: { icon: MinusCircle, color: 'text-zinc-400', dotColor: 'bg-zinc-400' },
};

function StepItem({ step }: { step: BoltExecutionStep }) {
  const [expanded, setExpanded] = useState(false);
  const config = stepStatusConfig[step.status];
  const Icon = config.icon;

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-zinc-200 dark:bg-zinc-700 last:hidden" />

      {/* Dot */}
      <div className={cn('relative z-10 flex items-center justify-center h-6 w-6 rounded-full shrink-0', config.dotColor)}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full text-left group"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-mono text-zinc-400 shrink-0">
              #{step.step_index + 1}
            </span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {step.mcp_tool}
            </span>
            <Icon className={cn('h-4 w-4 shrink-0', config.color)} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-500">{formatDuration(step.duration_ms)}</span>
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
            )}
          </div>
        </button>

        {step.error_message && !expanded && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400 truncate">
            {step.error_message}
          </p>
        )}

        {expanded && (
          <div className="mt-3 space-y-3">
            {/* Parameters */}
            <div>
              <h4 className="text-xs font-medium text-zinc-500 mb-1.5">Parameters</h4>
              <pre className="text-xs bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 overflow-x-auto text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                {JSON.stringify(step.parameters_resolved, null, 2)}
              </pre>
            </div>

            {/* Response */}
            {step.response != null && (
              <div>
                <h4 className="text-xs font-medium text-zinc-500 mb-1.5">Response</h4>
                <pre className="text-xs bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 overflow-x-auto text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                  {JSON.stringify(step.response, null, 2)}
                </pre>
              </div>
            )}

            {/* Error */}
            {step.error_message && (
              <div>
                <h4 className="text-xs font-medium text-zinc-500 mb-1.5">Error</h4>
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                  {step.error_message}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ExecutionTimeline({ steps }: ExecutionTimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        No steps recorded for this execution.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {steps
        .sort((a, b) => a.step_index - b.step_index)
        .map((step) => (
          <StepItem key={step.id} step={step} />
        ))}
    </div>
  );
}
