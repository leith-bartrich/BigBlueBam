import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { usePeriodReport } from '@/hooks/useProgress';
import { format, parseISO } from 'date-fns';

interface ProgressChartProps {
  periodId: string;
}

export function ProgressChart({ periodId }: ProgressChartProps) {
  const { data, isLoading } = usePeriodReport(periodId);
  const chartData = data?.data?.progress_over_time ?? [];

  if (isLoading) {
    return (
      <div className="h-64 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 animate-pulse" />
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-64 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 flex items-center justify-center">
        <p className="text-sm text-zinc-400">No progress data yet</p>
      </div>
    );
  }

  const formattedData = chartData.map((point) => ({
    ...point,
    dateLabel: formatDateLabel(point.date),
  }));

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-4">
      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Progress Over Time</h4>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11, fill: '#a1a1aa' }}
            axisLine={{ stroke: '#e4e4e7' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#a1a1aa' }}
            axisLine={{ stroke: '#e4e4e7' }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#fafafa',
            }}
            formatter={(value: number, name: string) => [`${Math.round(value)}%`, name === 'actual' ? 'Actual' : 'Expected']}
          />
          <Legend
            formatter={(value: string) => (value === 'actual' ? 'Actual' : 'Expected')}
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Line
            type="monotone"
            dataKey="expected"
            stroke="#a1a1aa"
            strokeDasharray="6 4"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#4f46e5"
            strokeWidth={2.5}
            dot={{ fill: '#4f46e5', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDateLabel(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d');
  } catch {
    return dateStr;
  }
}
