import { TrendingUp, DollarSign, Clock, AlertTriangle, Trophy } from 'lucide-react';
import { Badge } from '@/components/common/badge';
import {
  usePipelineSummary,
  useConversionRates,
  useDealVelocity,
  useWinLossStats,
  useForecast,
  useStaleDeals,
} from '@/hooks/use-analytics';
import { usePipelineStore } from '@/stores/pipeline.store';
import { formatCurrencyCompact, cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface AnalyticsPageProps {
  onNavigate: (path: string) => void;
}

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex items-center justify-center h-9 w-9 rounded-lg"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <span className="text-sm text-zinc-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      {subValue && <p className="text-sm text-zinc-500 mt-1">{subValue}</p>}
    </div>
  );
}

export function AnalyticsPage({ onNavigate }: AnalyticsPageProps) {
  const activePipelineId = usePipelineStore((s) => s.activePipelineId);

  const { data: summaryData, isLoading: summaryLoading } = usePipelineSummary(activePipelineId ?? undefined);
  const summary = summaryData?.data;

  const { data: velocityData } = useDealVelocity(activePipelineId ?? undefined);
  const velocity = velocityData?.data ?? [];

  const { data: winLossData } = useWinLossStats(activePipelineId ?? undefined);
  const winLoss = winLossData?.data;

  const { data: forecastData } = useForecast(activePipelineId ?? undefined);
  const forecast = forecastData?.data ?? [];

  const { data: staleData } = useStaleDeals(activePipelineId ?? undefined);
  const staleDeals = staleData?.data ?? [];

  const { data: conversionData } = useConversionRates(activePipelineId ?? undefined);
  const conversions = conversionData?.data ?? [];

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Analytics</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          {summary?.pipeline_name ?? 'Pipeline'} overview
        </p>
      </div>

      <div className="flex-1 p-6 space-y-8">
        {/* Top-level stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Pipeline"
            value={formatCurrencyCompact(summary?.total_value ?? 0)}
            subValue={`${summary?.total_deals ?? 0} deals`}
            icon={DollarSign}
            color="#16a34a"
          />
          <StatCard
            label="Weighted Forecast"
            value={formatCurrencyCompact(summary?.weighted_value ?? 0)}
            icon={TrendingUp}
            color="#0891b2"
          />
          <StatCard
            label="Win Rate"
            value={winLoss ? `${winLoss.win_rate_pct}%` : '-'}
            subValue={winLoss ? `${winLoss.total_won} won / ${winLoss.total_lost} lost` : undefined}
            icon={Trophy}
            color="#f59e0b"
          />
          <StatCard
            label="Stale Deals"
            value={String(staleDeals.length)}
            subValue={staleDeals.length > 0 ? 'Needs attention' : 'All healthy'}
            icon={AlertTriangle}
            color={staleDeals.length > 0 ? '#dc2626' : '#16a34a'}
          />
        </div>

        {/* Pipeline funnel */}
        {summary && summary.stages.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Pipeline Stages</h3>
            <div className="grid grid-cols-1 gap-3">
              {summary.stages
                .filter((s) => s.stage_type === 'active')
                .map((stage) => {
                  const pct = summary.total_value > 0 ? (stage.total_value / summary.total_value) * 100 : 0;
                  return (
                    <div key={stage.stage_id} className="flex items-center gap-4">
                      <div className="w-32 text-sm text-zinc-700 dark:text-zinc-300 truncate">
                        {stage.stage_name}
                      </div>
                      <div className="flex-1 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full rounded-lg transition-all duration-500"
                          style={{
                            width: `${Math.max(pct, 2)}%`,
                            backgroundColor: stage.color ?? '#0891b2',
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-between px-3">
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            {stage.deal_count} deals
                          </span>
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {formatCurrencyCompact(stage.total_value)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Deal Velocity */}
        {velocity.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Average Deal Velocity (days per stage)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {velocity.map((v) => (
                <div
                  key={v.stage_name}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 text-center"
                >
                  <p className="text-sm text-zinc-500 mb-1">{v.stage_name}</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-1">
                    <Clock className="h-4 w-4 text-primary-500" />
                    {v.avg_days.toFixed(1)}d
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">median: {v.median_days.toFixed(1)}d</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conversion rates */}
        {conversions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Stage Conversion Rates</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {conversions.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{c.from_stage}</span>
                  <span className={cn(
                    'text-sm font-bold',
                    c.rate_pct >= 50 ? 'text-green-600' : c.rate_pct >= 25 ? 'text-yellow-600' : 'text-red-600',
                  )}>
                    {c.rate_pct}%
                  </span>
                  <span className="text-zinc-400">→</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue forecast */}
        {forecast.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Revenue Forecast</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {forecast.map((bucket) => (
                <div
                  key={bucket.period}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4"
                >
                  <p className="text-sm text-zinc-500 mb-2">{bucket.period}</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {formatCurrencyCompact(bucket.weighted_value)}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {bucket.deal_count} deals, total: {formatCurrencyCompact(bucket.total_value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stale deals */}
        {staleDeals.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Stale Deals ({staleDeals.length})
            </h3>
            <div className="space-y-2">
              {staleDeals.map((deal) => (
                <div
                  key={deal.deal_id}
                  onClick={() => onNavigate(`/deals/${deal.deal_id}`)}
                  className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{deal.deal_name}</p>
                    <p className="text-xs text-zinc-500">
                      {deal.stage_name} · {deal.company_name ?? 'No company'} · {deal.owner_name ?? 'Unassigned'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="danger">
                      {deal.days_in_stage}d / {deal.rotting_days_threshold}d
                    </Badge>
                    {deal.value != null && (
                      <p className="text-xs text-zinc-500 mt-1">{formatCurrencyCompact(deal.value)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Win/Loss details */}
        {winLoss && (winLoss.top_loss_reasons.length > 0 || winLoss.top_competitors.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {winLoss.top_loss_reasons.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Top Loss Reasons</h3>
                <div className="space-y-2">
                  {winLoss.top_loss_reasons.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">{r.reason}</span>
                      <Badge variant="danger">{r.count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {winLoss.top_competitors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Top Competitors</h3>
                <div className="space-y-2">
                  {winLoss.top_competitors.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">{c.name}</span>
                      <Badge>{c.count} losses</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
