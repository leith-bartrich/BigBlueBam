import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { format, parseISO } from 'date-fns';
import { useKrHistory } from '@/hooks/useKeyResults';

interface KeyResultSparklineProps {
  keyResultId: string;
  height?: number;
  showTooltip?: boolean;
}

/**
 * Tiny inline progress sparkline for a single key result. Plots `progress`
 * (0-100) across the snapshot history window. Silent when there is no history.
 * Backend returns `progress` as a stringified numeric; we coerce once so the
 * chart can draw. When fewer than two points exist we skip rendering since a
 * single-point line has no useful shape.
 */
export function KeyResultSparkline({
  keyResultId,
  height = 24,
  showTooltip = false,
}: KeyResultSparklineProps) {
  const { data, isLoading } = useKrHistory(keyResultId);
  const history = data?.data ?? [];

  if (isLoading) {
    return <div className="h-[24px] w-20 animate-pulse bg-zinc-200 dark:bg-zinc-800 rounded" />;
  }

  if (history.length < 2) {
    return null;
  }

  const chartData = history.map((s) => ({
    t: s.recorded_at,
    progress: Math.max(0, Math.min(100, Number(s.progress) || 0)),
  }));

  return (
    <div className="w-20 h-[24px]" aria-hidden>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 1, right: 0, bottom: 1, left: 0 }}>
          {showTooltip && (
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#fafafa',
                padding: '4px 8px',
              }}
              labelFormatter={(label: string) => {
                try {
                  return format(parseISO(label), 'MMM d');
                } catch {
                  return label;
                }
              }}
              formatter={(value: number) => [`${Math.round(value)}%`, 'Progress']}
            />
          )}
          <Line
            type="monotone"
            dataKey="progress"
            stroke="#4f46e5"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
