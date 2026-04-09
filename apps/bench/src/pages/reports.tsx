import { Plus, Play, Trash2, Clock, Mail, MessageCircle, FileText } from 'lucide-react';
import { useReports, useDeleteReport, useSendReportNow } from '@/hooks/use-reports';
import { formatRelativeTime, formatDate } from '@/lib/utils';

interface ReportsPageProps {
  onNavigate: (path: string) => void;
}

const deliveryIcons: Record<string, typeof Mail> = {
  email: Mail,
  banter_channel: MessageCircle,
  brief_document: FileText,
};

export function ReportsPage({ onNavigate }: ReportsPageProps) {
  const { data, isLoading } = useReports();
  const deleteMutation = useDeleteReport();
  const sendNowMutation = useSendReportNow();
  const reports = data?.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Scheduled Reports</h1>
          <p className="text-sm text-zinc-500 mt-1">Automated dashboard snapshots delivered on a schedule.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">
          <Plus className="h-4 w-4" />
          New Report
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Clock className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No scheduled reports</h3>
          <p className="text-sm mt-1">Set up automated dashboard exports delivered via email or Banter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => {
            const DeliveryIcon = deliveryIcons[report.delivery_method] ?? Mail;
            return (
              <div
                key={report.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50"
              >
                <DeliveryIcon className="h-5 w-5 text-zinc-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{report.name}</div>
                  <div className="text-xs text-zinc-500">
                    {report.cron_expression} ({report.cron_timezone}) - {report.export_format.toUpperCase()}
                  </div>
                </div>
                <div className="text-xs text-zinc-400 shrink-0">
                  {report.last_sent_at ? `Last sent ${formatRelativeTime(report.last_sent_at)}` : 'Never sent'}
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-semibold ${report.enabled ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700'}`}>
                  {report.enabled ? 'Active' : 'Paused'}
                </div>
                <button
                  onClick={() => sendNowMutation.mutate(report.id)}
                  disabled={sendNowMutation.isPending}
                  className="p-1.5 text-zinc-400 hover:text-primary-600 transition-colors"
                  title="Send now"
                >
                  <Play className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(report.id)}
                  className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
