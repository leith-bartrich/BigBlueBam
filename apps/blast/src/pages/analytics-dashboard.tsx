import { useAnalyticsOverview, useEngagementTrend } from '@/hooks/use-analytics';
import { formatNumber, formatPercentage } from '@/lib/utils';
import { BarChart3, Mail, MousePointerClick, Eye, AlertTriangle, UserMinus } from 'lucide-react';

interface AnalyticsDashboardPageProps {
  onNavigate: (path: string) => void;
}

function StatCard({ icon: Icon, label, value, subValue, color }: {
  icon: typeof Mail;
  label: string;
  value: string;
  subValue?: string;
  color: string;
}) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-zinc-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      {subValue && <p className="text-xs text-zinc-500 mt-1">{subValue}</p>}
    </div>
  );
}

export function AnalyticsDashboardPage({ onNavigate }: AnalyticsDashboardPageProps) {
  const { data: overviewData, isLoading } = useAnalyticsOverview();
  const { data: trendData } = useEngagementTrend('weekly');

  const overview = overviewData?.data;
  const trend = trendData?.data ?? [];

  if (isLoading) {
    return <div className="p-6 text-center text-zinc-500">Loading analytics...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Email Analytics</h1>
        <p className="text-sm text-zinc-500 mt-1">Overview of your email campaign performance</p>
      </div>

      {overview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard icon={Mail} label="Total Sent" value={formatNumber(overview.total_sent)} color="#3b82f6" />
            <StatCard icon={Mail} label="Delivered" value={formatNumber(overview.total_delivered)} color="#16a34a" />
            <StatCard
              icon={Eye}
              label="Avg Open Rate"
              value={formatPercentage(overview.avg_open_rate)}
              subValue={`${formatNumber(overview.total_opened)} opens`}
              color="#f59e0b"
            />
            <StatCard
              icon={MousePointerClick}
              label="Avg Click Rate"
              value={formatPercentage(overview.avg_click_rate)}
              subValue={`${formatNumber(overview.total_clicked)} clicks`}
              color="#8b5cf6"
            />
            <StatCard
              icon={AlertTriangle}
              label="Bounce Rate"
              value={formatPercentage(overview.avg_bounce_rate)}
              subValue={`${formatNumber(overview.total_bounced)} bounced`}
              color="#dc2626"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Campaigns Sent</h3>
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{formatNumber(overview.total_campaigns)}</p>
            </div>
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <UserMinus className="h-4 w-4 text-zinc-400" />
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Unsubscribes</h3>
              </div>
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{formatNumber(overview.total_unsubscribed)}</p>
            </div>
          </div>
        </>
      )}

      {/* Trend Table */}
      {trend.length > 0 && (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Weekly Engagement Trend</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50/50 dark:bg-zinc-800/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-zinc-500">Period</th>
                <th className="text-right px-4 py-2 font-medium text-zinc-500">Campaigns</th>
                <th className="text-right px-4 py-2 font-medium text-zinc-500">Sent</th>
                <th className="text-right px-4 py-2 font-medium text-zinc-500">Open Rate</th>
                <th className="text-right px-4 py-2 font-medium text-zinc-500">Click Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {trend.map((row, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{String(row.period)}</td>
                  <td className="px-4 py-2 text-right">{row.campaigns}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(row.total_sent)}</td>
                  <td className="px-4 py-2 text-right">{formatPercentage(row.open_rate)}</td>
                  <td className="px-4 py-2 text-right">{formatPercentage(row.click_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
