import { ArrowLeft, Send, Pause, XCircle, BarChart3 } from 'lucide-react';
import { useCampaign, useCampaignAnalytics, useSendCampaign } from '@/hooks/use-campaigns';
import { campaignStatusLabel, campaignStatusColor, formatDate, formatNumber, formatPercentage } from '@/lib/utils';

interface CampaignDetailPageProps {
  campaignId: string;
  onNavigate: (path: string) => void;
}

function MetricCard({ label, value, subValue }: { label: string; value: string | number; subValue?: string }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{value}</p>
      {subValue && <p className="text-xs text-zinc-500 mt-0.5">{subValue}</p>}
    </div>
  );
}

export function CampaignDetailPage({ campaignId, onNavigate }: CampaignDetailPageProps) {
  const { data: campaignData, isLoading } = useCampaign(campaignId);
  const { data: analyticsData } = useCampaignAnalytics(campaignId);
  const sendCampaign = useSendCampaign();

  const campaign = campaignData?.data;
  const analytics = analyticsData?.data;

  if (isLoading) {
    return <div className="p-6 text-center text-zinc-500">Loading campaign...</div>;
  }

  if (!campaign) {
    return <div className="p-6 text-center text-zinc-500">Campaign not found</div>;
  }

  const statusColor = campaignStatusColor(campaign.status);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/')}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{campaign.name}</h1>
            <p className="text-sm text-zinc-500">{campaign.subject}</p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
            {campaignStatusLabel(campaign.status)}
          </span>
        </div>

        {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
          <button
            onClick={() => sendCampaign.mutate(campaign.id)}
            disabled={sendCampaign.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            <Send className="h-4 w-4" />
            {sendCampaign.isPending ? 'Sending...' : 'Send Now'}
          </button>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Sent" value={formatNumber(campaign.total_sent)} />
        <MetricCard label="Delivered" value={formatNumber(campaign.total_delivered)} />
        <MetricCard
          label="Opened"
          value={formatNumber(campaign.total_opened)}
          subValue={analytics ? `${formatPercentage(analytics.open_rate)} open rate` : undefined}
        />
        <MetricCard
          label="Clicked"
          value={formatNumber(campaign.total_clicked)}
          subValue={analytics ? `${formatPercentage(analytics.click_rate)} click rate` : undefined}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Bounced" value={formatNumber(campaign.total_bounced)} />
        <MetricCard label="Unsubscribed" value={formatNumber(campaign.total_unsubscribed)} />
        <MetricCard label="Complaints" value={formatNumber(campaign.total_complained)} />
      </div>

      {/* Click URLs */}
      {analytics && analytics.click_urls.length > 0 && (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Top Clicked Links</h3>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {analytics.click_urls.map((link, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400 truncate max-w-[400px]">
                    {link.url ?? '(unknown)'}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">
                    {formatNumber(link.count)} clicks
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Campaign Details */}
      <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Campaign Details</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <dt className="text-zinc-500">From</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{campaign.from_name} &lt;{campaign.from_email}&gt;</dd>
          <dt className="text-zinc-500">Sent Date</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{formatDate(campaign.sent_at) || '-'}</dd>
          <dt className="text-zinc-500">Scheduled</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{formatDate(campaign.scheduled_at) || '-'}</dd>
          <dt className="text-zinc-500">Recipients</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{campaign.recipient_count ?? '-'}</dd>
          <dt className="text-zinc-500">Created</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{formatDate(campaign.created_at)}</dd>
        </dl>
      </div>
    </div>
  );
}
