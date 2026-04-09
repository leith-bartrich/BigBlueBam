import { useState, useEffect } from 'react';
import { Edit2, RefreshCw, Maximize2, Copy, Download, Clock } from 'lucide-react';
import { useDashboard } from '@/hooks/use-dashboards';
import { useWidgetQuery } from '@/hooks/use-widgets';
import { formatRelativeTime } from '@/lib/utils';

interface DashboardViewPageProps {
  dashboardId: string;
  onNavigate: (path: string) => void;
}

function WidgetCard({ widget }: { widget: any }) {
  const { data, isLoading } = useWidgetQuery(widget.id);
  const queryResult = data?.data;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{widget.name}</h4>
        <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-700 rounded px-1.5 py-0.5">{widget.widget_type.replace('_', ' ')}</span>
      </div>
      <div className="flex-1 flex items-center justify-center min-h-[120px]">
        {isLoading ? (
          <div className="text-sm text-zinc-400">Loading...</div>
        ) : widget.widget_type === 'kpi_card' || widget.widget_type === 'counter' ? (
          <div className="text-center">
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {queryResult?.rows?.[0] ? Object.values(queryResult.rows[0])[0] as string : '0'}
            </div>
            <div className="text-xs text-zinc-500 mt-1">{widget.name}</div>
          </div>
        ) : (
          <div className="w-full">
            {queryResult?.rows && queryResult.rows.length > 0 ? (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {queryResult.rows.slice(0, 10).map((row: Record<string, unknown>, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-700/50">
                    {Object.entries(row).map(([key, val]) => (
                      <span key={key} className="text-zinc-600 dark:text-zinc-300 truncate">{String(val)}</span>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-400 text-center">No data</div>
            )}
          </div>
        )}
      </div>
      {queryResult?.duration_ms != null && (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-zinc-400">
          <Clock className="h-3 w-3" />
          {queryResult.duration_ms}ms
        </div>
      )}
    </div>
  );
}

export function DashboardViewPage({ dashboardId, onNavigate }: DashboardViewPageProps) {
  const { data, isLoading, refetch } = useDashboard(dashboardId);
  const dashboard = data?.data;
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-refresh
  useEffect(() => {
    if (!dashboard?.auto_refresh_seconds) return;
    const interval = setInterval(() => refetch(), dashboard.auto_refresh_seconds * 1000);
    return () => clearInterval(interval);
  }, [dashboard?.auto_refresh_seconds, refetch]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-6 text-center text-zinc-500">Dashboard not found.</div>
    );
  }

  return (
    <div className={`p-6 ${isFullscreen ? 'fixed inset-0 z-40 bg-white dark:bg-zinc-900 overflow-auto' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{dashboard.name}</h1>
          {dashboard.description && (
            <p className="text-sm text-zinc-500 mt-0.5">{dashboard.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onNavigate(`/dashboards/${dashboardId}/edit`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>

      {dashboard.widgets && dashboard.widgets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboard.widgets.map((widget: any) => (
            <WidgetCard key={widget.id} widget={widget} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-500">
          <p>This dashboard has no widgets yet.</p>
          <button
            onClick={() => onNavigate(`/dashboards/${dashboardId}/edit`)}
            className="mt-3 text-sm text-primary-600 hover:text-primary-700"
          >
            Add widgets
          </button>
        </div>
      )}
    </div>
  );
}
