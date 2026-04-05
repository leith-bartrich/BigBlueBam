import { useMemo } from 'react';

export interface CfdPhase {
  id: string;
  name: string;
  order: number;
  color: string | null;
}

export interface CfdDay {
  date: string;
  counts: Record<string, number>;
}

interface CfdChartProps {
  phases: CfdPhase[];
  days: CfdDay[];
  height?: number;
}

// Fallback palette for phases that don't have a color set. Ordered so stacks
// remain visually distinct even on typical 3-5 phase pipelines.
const FALLBACK_PALETTE = [
  '#94a3b8', // slate-400
  '#60a5fa', // blue-400
  '#a78bfa', // violet-400
  '#fbbf24', // amber-400
  '#34d399', // emerald-400
  '#f472b6', // pink-400
  '#fb923c', // orange-400
];

/**
 * Cumulative Flow Diagram — stacked area per phase over time. The stacks are
 * drawn in phase `order`, so bottom-of-pipeline phases anchor the chart.
 */
export function CfdChart({ phases, days, height = 260 }: CfdChartProps) {
  const { width, areas, xLabels, yTicks, legend } = useMemo(() => {
    if (days.length === 0 || phases.length === 0) {
      return { width: 0, areas: [], xLabels: [], yTicks: [], legend: [] };
    }
    const w = 720;
    const padL = 40;
    const padR = 16;
    const padT = 12;
    const padB = 28;
    const innerW = w - padL - padR;
    const innerH = height - padT - padB;

    const ordered = [...phases].sort((a, b) => a.order - b.order);
    const totals = days.map((d) =>
      ordered.reduce((sum, p) => sum + (d.counts[p.id] ?? 0), 0),
    );
    const max = Math.max(...totals, 1) * 1.05;

    const xAt = (i: number) =>
      padL + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
    const yAt = (v: number) => padT + innerH - (v / max) * innerH;

    // Build cumulative stack: each phase's upper boundary is sum so far.
    const stackedUppers: number[][] = [];
    for (let di = 0; di < days.length; di++) {
      let acc = 0;
      const col: number[] = [];
      for (const p of ordered) {
        acc += days[di]!.counts[p.id] ?? 0;
        col.push(acc);
      }
      stackedUppers.push(col);
    }

    const areasOut = ordered.map((p, pi) => {
      const color = p.color ?? FALLBACK_PALETTE[pi % FALLBACK_PALETTE.length]!;
      // Top boundary (this phase's cumulative)
      const top = days.map((_, di) => `${xAt(di)},${yAt(stackedUppers[di]![pi]!)}`);
      // Bottom boundary (previous phase's cumulative, or zero)
      const bottom = days
        .map((_, di) => {
          const lower = pi === 0 ? 0 : stackedUppers[di]![pi - 1]!;
          return `${xAt(di)},${yAt(lower)}`;
        })
        .reverse();
      return {
        id: p.id,
        name: p.name,
        color,
        points: [...top, ...bottom].join(' '),
      };
    });

    const labelStride = Math.max(1, Math.ceil(days.length / 6));
    const xl = days
      .map((d, i) => ({ i, date: d.date }))
      .filter(({ i }) => i % labelStride === 0 || i === days.length - 1)
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

    const leg = ordered.map((p, pi) => ({
      id: p.id,
      name: p.name,
      color: p.color ?? FALLBACK_PALETTE[pi % FALLBACK_PALETTE.length]!,
    }));

    return {
      width: w,
      areas: areasOut,
      xLabels: xl,
      yTicks: ticks,
      legend: leg,
    };
  }, [phases, days, height]);

  if (days.length === 0 || phases.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-zinc-500 dark:text-zinc-400">
        Not enough data to build a CFD yet.
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
        {areas.map((a) => (
          <polygon
            key={a.id}
            points={a.points}
            fill={a.color}
            fillOpacity={0.85}
            stroke={a.color}
            strokeWidth={1}
          />
        ))}
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {legend.map((l) => (
          <span key={l.id} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: l.color }}
            />
            {l.name}
          </span>
        ))}
      </div>
    </div>
  );
}
