import { useMemo } from 'react';

export interface VelocityPoint {
  id: string;
  name: string;
  end_date: string | null;
  committed_points: number;
  completed_points: number;
}

interface VelocityChartProps {
  data: VelocityPoint[];
  height?: number;
}

/**
 * Grouped bar chart: committed vs completed story points per sprint.
 */
export function VelocityChart({ data, height = 260 }: VelocityChartProps) {
  const { width, bars, yTicks, xLabels } = useMemo(() => {
    if (data.length === 0) {
      return { width: 0, bars: [], yTicks: [], xLabels: [] };
    }
    const w = 720;
    const padL = 40;
    const padR = 16;
    const padT = 12;
    const padB = 40;
    const innerW = w - padL - padR;
    const innerH = height - padT - padB;
    const max =
      Math.max(
        ...data.map((d) => Math.max(d.committed_points, d.completed_points)),
        1,
      ) * 1.05;

    const groupW = innerW / data.length;
    const barW = Math.min(24, (groupW - 8) / 2);

    const yAt = (v: number) => padT + innerH - (v / max) * innerH;

    const barsOut = data.map((d, i) => {
      const groupX = padL + groupW * i + groupW / 2;
      return {
        id: d.id,
        committed: {
          x: groupX - barW - 2,
          y: yAt(d.committed_points),
          h: padT + innerH - yAt(d.committed_points),
          value: d.committed_points,
        },
        completed: {
          x: groupX + 2,
          y: yAt(d.completed_points),
          h: padT + innerH - yAt(d.completed_points),
          value: d.completed_points,
        },
        barW,
        labelX: groupX,
      };
    });

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
      y: padT + innerH - frac * innerH,
      value: Math.round(max * frac),
    }));

    const xl = data.map((d, i) => ({
      x: padL + groupW * i + groupW / 2,
      label: d.name.length > 12 ? d.name.slice(0, 11) + '…' : d.name,
    }));

    return { width: w, bars: barsOut, yTicks: ticks, xLabels: xl };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-zinc-500 dark:text-zinc-400">
        No completed sprints yet.
      </div>
    );
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
      >
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
        {bars.map((b) => (
          <g key={b.id}>
            <rect
              x={b.committed.x}
              y={b.committed.y}
              width={b.barW}
              height={Math.max(1, b.committed.h)}
              className="fill-zinc-400 dark:fill-zinc-500"
              rx={2}
            />
            <rect
              x={b.completed.x}
              y={b.completed.y}
              width={b.barW}
              height={Math.max(1, b.completed.h)}
              className="fill-primary-500"
              rx={2}
            />
          </g>
        ))}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={height - 22}
            textAnchor="middle"
            className="fill-zinc-500 dark:fill-zinc-400 text-[10px]"
          >
            {l.label}
          </text>
        ))}
      </svg>
      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 bg-zinc-400 dark:bg-zinc-500 rounded-sm" />
          Committed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 bg-primary-500 rounded-sm" />
          Completed
        </span>
      </div>
    </div>
  );
}
