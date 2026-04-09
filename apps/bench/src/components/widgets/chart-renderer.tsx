import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const COLORS = [
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
];

interface ChartRendererProps {
  widgetType: string;
  data: Record<string, unknown>[];
  vizConfig?: Record<string, unknown>;
  widgetName?: string;
  kpiConfig?: Record<string, unknown> | null;
}

export function ChartRenderer({ widgetType, data, vizConfig = {}, widgetName, kpiConfig }: ChartRendererProps) {
  if (!data || data.length === 0) {
    return <div className="text-sm text-zinc-400 text-center py-4">No data</div>;
  }

  const showLegend = vizConfig.show_legend !== false;
  const colors = (vizConfig.colors as string[] | undefined) ?? COLORS;
  const stacked = vizConfig.stacked === true;

  // Determine keys: first key is dimension (x-axis), rest are measures
  const allKeys = Object.keys(data[0]!);
  const dimensionKey = allKeys[0]!;
  const measureKeys = allKeys.slice(1);

  switch (widgetType) {
    case 'kpi_card':
      return <KpiCard data={data} widgetName={widgetName} kpiConfig={kpiConfig} />;

    case 'counter':
      return <CounterCard data={data} widgetName={widgetName} kpiConfig={kpiConfig} />;

    case 'bar_chart':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-200, #e4e4e7)" />
            <XAxis
              dataKey={dimensionKey}
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                fontSize: 12,
                color: '#fafafa',
              }}
            />
            {showLegend && measureKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {measureKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[i % colors.length]}
                stackId={stacked ? 'stack' : undefined}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );

    case 'line_chart':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-200, #e4e4e7)" />
            <XAxis
              dataKey={dimensionKey}
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                fontSize: 12,
                color: '#fafafa',
              }}
            />
            {showLegend && measureKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {measureKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: colors[i % colors.length] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );

    case 'area_chart':
      return (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-200, #e4e4e7)" />
            <XAxis
              dataKey={dimensionKey}
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                fontSize: 12,
                color: '#fafafa',
              }}
            />
            {showLegend && measureKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {measureKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[i % colors.length]}
                fill={colors[i % colors.length]}
                fillOpacity={0.15}
                strokeWidth={2}
                stackId={stacked ? 'stack' : undefined}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'pie_chart':
    case 'donut_chart': {
      // For pie, use first measure as value, dimension as name
      const valueKey = measureKeys[0] ?? dimensionKey;
      const innerRadius = widgetType === 'donut_chart' ? '55%' : 0;
      return (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={dimensionKey}
              cx="50%"
              cy="50%"
              outerRadius="80%"
              innerRadius={innerRadius}
              paddingAngle={2}
              label={({ name, percent }: { name: string; percent: number }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
              fontSize={10}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                fontSize: 12,
                color: '#fafafa',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    case 'table':
      return <DataTable data={data} />;

    default:
      // Fallback: render as table for unsupported types
      return <DataTable data={data} />;
  }
}

function KpiCard({
  data,
  widgetName,
  kpiConfig,
}: {
  data: Record<string, unknown>[];
  widgetName?: string;
  kpiConfig?: Record<string, unknown> | null;
}) {
  const row = data[0];
  if (!row) return null;

  const keys = Object.keys(row);
  const valueKey = keys.length > 1 ? keys[1]! : keys[0]!;
  const rawValue = row[valueKey];
  const numValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);

  const prefix = (kpiConfig?.prefix as string) ?? '';
  const suffix = (kpiConfig?.suffix as string) ?? '';
  const format = (kpiConfig?.format as string) ?? 'number';

  let display: string;
  if (format === 'currency') {
    display = `${prefix || '$'}${numValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (format === 'percentage') {
    display = `${numValue.toFixed(1)}%`;
  } else {
    display = `${prefix}${numValue.toLocaleString()}${suffix ? ` ${suffix}` : ''}`;
  }

  return (
    <div className="text-center py-2">
      <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{display}</div>
      {widgetName && <div className="text-xs text-zinc-500 mt-1">{widgetName}</div>}
    </div>
  );
}

function CounterCard({
  data,
  widgetName,
  kpiConfig,
}: {
  data: Record<string, unknown>[];
  widgetName?: string;
  kpiConfig?: Record<string, unknown> | null;
}) {
  const row = data[0];
  if (!row) return null;

  const keys = Object.keys(row);
  const valueKey = keys.length > 1 ? keys[1]! : keys[0]!;
  const rawValue = row[valueKey];
  const numValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);

  const prefix = (kpiConfig?.prefix as string) ?? '';
  const suffix = (kpiConfig?.suffix as string) ?? '';

  return (
    <div className="text-center py-2">
      <div className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
        {prefix}{numValue.toLocaleString()}{suffix ? ` ${suffix}` : ''}
      </div>
      {widgetName && <div className="text-xs text-zinc-500 mt-1.5">{widgetName}</div>}
    </div>
  );
}

function DataTable({ data }: { data: Record<string, unknown>[] }) {
  if (data.length === 0) return <div className="text-sm text-zinc-400 text-center">No data</div>;

  const keys = Object.keys(data[0]!);

  return (
    <div className="w-full overflow-auto max-h-[240px]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            {keys.map((k) => (
              <th
                key={k}
                className="px-2 py-1.5 text-left font-semibold text-zinc-600 dark:text-zinc-400 whitespace-nowrap"
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              {keys.map((k) => (
                <td key={k} className="px-2 py-1 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  {String(row[k] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
