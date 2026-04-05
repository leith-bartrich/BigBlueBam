import { useMemo } from 'react';

export interface BurndownPoint {
  date: string;
  remaining_points: number;
  ideal_points: number;
}

interface BurndownChartProps {
  data: BurndownPoint[];
  height?: number;
}

/**
 * Sprint burndown line chart. Renders the ideal descent as a dashed line and
 * the actual remaining points as a solid line. Pure SVG, no external charting
 * library so we stay inside the existing dependency budget.
 */
export function BurndownChart({ data, height = 240 }: BurndownChartProps) {
  const { width, paths, xLabels, yTicks, maxVal } = useMemo(() => {
    if (data.length === 0) {
      return { width: 0, paths: null, xLabels: [], yTicks: [], maxVal: 0 };
    }
    const w = 720;
    const padL = 40;
    const padR = 16;
    const padT = 12;
    const padB = 28;
    const innerW = w - padL - padR;
    const innerH = height - padT - padB;
    const max =
      Math.max(
        ...data.map((d) => Math.max(d.remaining_points, d.ideal_points)),
        1,
      ) * 1.05;

    const xAt = (i: number) =>
      padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW);
    const yAt = (v: number) => padT + innerH - (v / max) * innerH;

    const toPath = (key: 'remaining_points' | 'ideal_points') =>
      data
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(d[key])}`)
        .join(' ');

    const labelStride = Math.max(1, Math.ceil(data.length / 6));
    const xl = data
      .map((d, i) => ({ i, date: d.date }))
      .filter(({ i }) => i % labelStride === 0 || i === data.length - 1)
      .map(({ i, date }) => ({
        x: xAt(i),
        label: new Date(date).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
      }));

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
      y: padT + innerH - frac * innerH,
      value: Math.round(max * frac),
    }));

    return {
      width: w,
      paths: { actual: toPath('remaining_points'), ideal: toPath('ideal_points') },
      xLabels: xl,
      yTicks: ticks,
      maxVal: max,
    };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-zinc-500 dark:text-zinc-400">
        No burndown data for this sprint yet.
      </div>
    );
  }

  void maxVal;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
      >
        {/* Y-axis grid lines + labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={40}
              x2={width - 16}
              y1={t.y}
              y2={t.y}
              className="stroke-zinc-200 dark:stroke-zinc-700"
              strokeWidth={1}
            />
            <text
              x={36}
              y={t.y + 4}
              textAnchor="end"
              className="fill-zinc-400 text-[10px]"
            >
              {t.value}
            </text>
          </g>
        ))}
        {/* Ideal (dashed) */}
        {paths && (
          <path
            d={paths.ideal}
            fill="none"
            strokeWidth={2}
            strokeDasharray="6 4"
            className="stroke-zinc-400 dark:stroke-zinc-500"
          />
        )}
        {/* Actual (solid) */}
        {paths && (
          <path
            d={paths.actual}
            fill="none"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-primary-500"
          />
        )}
        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={height - 8}
            textAnchor="middle"
            className="fill-zinc-400 text-[10px]"
          >
            {l.label}
          </text>
        ))}
      </svg>
      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-primary-500 rounded" />
          Actual
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 h-0 border-t-2 border-dashed border-zinc-400 dark:border-zinc-500"
          />
          Ideal
        </span>
      </div>
    </div>
  );
}
