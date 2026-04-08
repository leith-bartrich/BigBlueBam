import { motion } from 'motion/react';
import { cn, formatProgress, clamp } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  expected?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

function progressColor(value: number, expected?: number): string {
  if (expected != null) {
    const gap = value - expected;
    if (gap >= -5) return 'bg-green-500';
    if (gap >= -20) return 'bg-yellow-500';
    return 'bg-red-500';
  }
  if (value >= 100) return 'bg-green-500';
  if (value >= 60) return 'bg-primary-500';
  if (value >= 30) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function ProgressBar({ value, expected, size = 'md', showLabel = true, className }: ProgressBarProps) {
  const clamped = clamp(value, 0, 100);
  const clampedExpected = expected != null ? clamp(expected, 0, 100) : undefined;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden relative', sizeClasses[size])}>
        {/* Expected progress marker */}
        {clampedExpected != null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-zinc-400 dark:bg-zinc-500 z-10"
            style={{ left: `${clampedExpected}%` }}
          />
        )}

        {/* Actual progress fill */}
        <motion.div
          className={cn('h-full rounded-full', progressColor(clamped, clampedExpected))}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 min-w-[36px] text-right tabular-nums">
          {formatProgress(clamped)}
        </span>
      )}
    </div>
  );
}
