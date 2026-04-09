import { useForm, useFormAnalytics } from '@/hooks/use-forms';
import { ChevronLeft } from 'lucide-react';

interface FormAnalyticsPageProps {
  formId: string;
  onNavigate: (path: string) => void;
}

export function FormAnalyticsPage({ formId, onNavigate }: FormAnalyticsPageProps) {
  const { data: formData } = useForm(formId);
  const { data: analyticsData, isLoading } = useFormAnalytics(formId);

  const form = formData?.data;
  const analytics = analyticsData?.data as {
    total_submissions: number;
    daily_trend: Array<{ day: string; count: number }>;
    field_analytics: Record<string, { type: string; data: unknown }>;
  } | undefined;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate(`/forms/${formId}/edit`)}
          className="p-1 text-zinc-400 hover:text-zinc-600"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {form?.name} — Analytics
          </h1>
          <p className="text-sm text-zinc-500">{analytics?.total_submissions ?? 0} total submissions</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-6">
              <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                {analytics?.total_submissions ?? 0}
              </div>
              <div className="text-sm text-zinc-500 mt-1">Total Submissions</div>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-6">
              <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                {form?.fields?.filter((f) => !['section_header', 'paragraph'].includes(f.field_type)).length ?? 0}
              </div>
              <div className="text-sm text-zinc-500 mt-1">Active Fields</div>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-6">
              <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                {form?.status === 'published' ? 'Active' : form?.status ?? 'Draft'}
              </div>
              <div className="text-sm text-zinc-500 mt-1">Form Status</div>
            </div>
          </div>

          {/* Daily trend */}
          {analytics?.daily_trend && analytics.daily_trend.length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Submissions (Last 30 Days)</h3>
              <div className="flex items-end gap-1 h-32">
                {analytics.daily_trend.map((d, i) => {
                  const maxCount = Math.max(...analytics.daily_trend.map((x) => x.count), 1);
                  const height = (d.count / maxCount) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-primary-500 rounded-t-sm min-h-[2px]"
                      style={{ height: `${height}%` }}
                      title={`${d.day}: ${d.count}`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-field analytics */}
          {analytics?.field_analytics && Object.keys(analytics.field_analytics).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Per-Field Breakdown</h3>
              {Object.entries(analytics.field_analytics).map(([key, info]) => {
                const field = form?.fields?.find((f) => f.field_key === key);
                return (
                  <div key={key} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-4">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">{field?.label ?? key}</div>
                    <div className="text-xs text-zinc-500">
                      Type: {info.type} | Data: {JSON.stringify(info.data).slice(0, 200)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
