import { useState } from 'react';
import { Plus, Search, Send, Clock, FileEdit, MoreHorizontal } from 'lucide-react';
import { useCampaigns, type Campaign } from '@/hooks/use-campaigns';
import { cn, campaignStatusLabel, campaignStatusColor, formatDate, formatPercentage, formatNumber } from '@/lib/utils';

interface CampaignListPageProps {
  onNavigate: (path: string) => void;
}

function StatusBadge({ status }: { status: string }) {
  const color = campaignStatusColor(status);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}15`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {campaignStatusLabel(status)}
    </span>
  );
}

export function CampaignListPage({ onNavigate }: CampaignListPageProps) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useCampaigns({ status: statusFilter });
  const campaigns = data?.data ?? [];

  const statuses = ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Campaigns</h1>
          <p className="text-sm text-zinc-500 mt-1">Create and manage email campaigns</p>
        </div>
        <button
          onClick={() => onNavigate('/campaigns/new')}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setStatusFilter(undefined)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              !statusFilter ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
            )}
          >
            All
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? undefined : s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                statusFilter === s ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-20 text-zinc-500">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20">
          <Send className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No campaigns yet</h3>
          <p className="text-sm text-zinc-500 mt-1">Create your first email campaign to get started.</p>
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Campaign</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Sent</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Open Rate</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Click Rate</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {campaigns
                .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
                .map((campaign) => {
                  const openRate = campaign.total_sent > 0 ? (campaign.total_opened / campaign.total_sent) * 100 : 0;
                  const clickRate = campaign.total_sent > 0 ? (campaign.total_clicked / campaign.total_sent) * 100 : 0;
                  return (
                    <tr
                      key={campaign.id}
                      onClick={() => onNavigate(`/campaigns/${campaign.id}`)}
                      className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{campaign.name}</div>
                        <div className="text-xs text-zinc-500 truncate max-w-[300px]">{campaign.subject}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={campaign.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
                        {formatNumber(campaign.total_sent)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
                        {campaign.total_sent > 0 ? formatPercentage(openRate) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
                        {campaign.total_sent > 0 ? formatPercentage(clickRate) : '-'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {formatDate(campaign.sent_at ?? campaign.scheduled_at ?? campaign.created_at)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
