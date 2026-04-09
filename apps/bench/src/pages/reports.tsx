import { useState } from 'react';
import { Plus, Play, Trash2, Clock, Mail, MessageCircle, FileText, X } from 'lucide-react';
import { useReports, useCreateReport, useDeleteReport, useSendReportNow } from '@/hooks/use-reports';
import { useDashboards } from '@/hooks/use-dashboards';
import { formatRelativeTime, formatDate } from '@/lib/utils';

interface ReportsPageProps {
  onNavigate: (path: string) => void;
}

const deliveryIcons: Record<string, typeof Mail> = {
  email: Mail,
  banter_channel: MessageCircle,
  brief_document: FileText,
};

const CRON_PRESETS = [
  { label: 'Every day at 9 AM', value: '0 9 * * *' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
  { label: 'First of every month at 9 AM', value: '0 9 1 * *' },
  { label: 'Every Friday at 5 PM', value: '0 17 * * 5' },
  { label: 'Custom', value: '' },
];

interface CreateReportFormData {
  dashboard_id: string;
  name: string;
  cron_expression: string;
  cron_timezone: string;
  delivery_method: 'email' | 'banter_channel' | 'brief_document';
  delivery_target: string;
  export_format: 'pdf' | 'png' | 'csv';
  enabled: boolean;
}

const INITIAL_FORM: CreateReportFormData = {
  dashboard_id: '',
  name: '',
  cron_expression: '0 9 * * 1',
  cron_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  delivery_method: 'email',
  delivery_target: '',
  export_format: 'pdf',
  enabled: true,
};

function CreateReportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CreateReportFormData>({ ...INITIAL_FORM });
  const [cronPreset, setCronPreset] = useState('0 9 * * 1');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createMutation = useCreateReport();
  const { data: dashboardsData } = useDashboards();
  const dashboards = dashboardsData?.data ?? [];

  function updateField<K extends keyof CreateReportFormData>(
    key: K,
    value: CreateReportFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.dashboard_id) errs.dashboard_id = 'Select a dashboard';
    if (!form.cron_expression.trim()) errs.cron_expression = 'Schedule is required';
    if (!form.delivery_target.trim()) {
      if (form.delivery_method === 'email') errs.delivery_target = 'Email address is required';
      else if (form.delivery_method === 'banter_channel') errs.delivery_target = 'Channel name is required';
      else errs.delivery_target = 'Target is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await createMutation.mutateAsync({
        dashboard_id: form.dashboard_id,
        name: form.name.trim(),
        cron_expression: form.cron_expression.trim(),
        cron_timezone: form.cron_timezone,
        delivery_method: form.delivery_method,
        delivery_target: form.delivery_target.trim(),
        export_format: form.export_format,
        enabled: form.enabled,
      });
      setForm({ ...INITIAL_FORM });
      setCronPreset('0 9 * * 1');
      onClose();
    } catch {
      // Error is handled by TanStack Query
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">New Scheduled Report</h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Report Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Weekly sprint summary"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Dashboard */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Dashboard</label>
            <select
              value={form.dashboard_id}
              onChange={(e) => updateField('dashboard_id', e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a dashboard...</option>
              {dashboards.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {errors.dashboard_id && <p className="text-xs text-red-500 mt-1">{errors.dashboard_id}</p>}
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Schedule</label>
            <select
              value={cronPreset}
              onChange={(e) => {
                setCronPreset(e.target.value);
                if (e.target.value) updateField('cron_expression', e.target.value);
              }}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
            >
              {CRON_PRESETS.map((p) => (
                <option key={p.value || 'custom'} value={p.value}>{p.label}</option>
              ))}
            </select>
            {cronPreset === '' && (
              <input
                type="text"
                value={form.cron_expression}
                onChange={(e) => updateField('cron_expression', e.target.value)}
                placeholder="0 9 * * 1 (cron expression)"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            )}
            {errors.cron_expression && <p className="text-xs text-red-500 mt-1">{errors.cron_expression}</p>}
            <p className="text-xs text-zinc-400 mt-1">Timezone: {form.cron_timezone}</p>
          </div>

          {/* Delivery method + target */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Delivery Method</label>
              <select
                value={form.delivery_method}
                onChange={(e) => updateField('delivery_method', e.target.value as CreateReportFormData['delivery_method'])}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="email">Email</option>
                <option value="banter_channel">Banter Channel</option>
                <option value="brief_document">Brief Document</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {form.delivery_method === 'email' ? 'Email Address' : form.delivery_method === 'banter_channel' ? 'Channel' : 'Document'}
              </label>
              <input
                type={form.delivery_method === 'email' ? 'email' : 'text'}
                value={form.delivery_target}
                onChange={(e) => updateField('delivery_target', e.target.value)}
                placeholder={form.delivery_method === 'email' ? 'team@example.com' : form.delivery_method === 'banter_channel' ? '#general' : 'Report title'}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.delivery_target && <p className="text-xs text-red-500 mt-1">{errors.delivery_target}</p>}
            </div>
          </div>

          {/* Export format */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Export Format</label>
            <div className="flex gap-4">
              {(['pdf', 'png', 'csv'] as const).map((fmt) => (
                <label key={fmt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="export_format"
                    value={fmt}
                    checked={form.export_format === fmt}
                    onChange={() => updateField('export_format', fmt)}
                    className="accent-primary-600"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 uppercase">{fmt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Enabled toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => updateField('enabled', e.target.checked)}
              className="h-4 w-4 rounded accent-primary-600"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Enable immediately</span>
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReportsPage({ onNavigate }: ReportsPageProps) {
  const { data, isLoading } = useReports();
  const deleteMutation = useDeleteReport();
  const sendNowMutation = useSendReportNow();
  const reports = data?.data ?? [];
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Scheduled Reports</h1>
          <p className="text-sm text-zinc-500 mt-1">Automated dashboard snapshots delivered on a schedule.</p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
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

      <CreateReportDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  );
}
