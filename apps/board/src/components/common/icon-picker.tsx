import { useState, useRef, useEffect } from 'react';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Curated emoji set for Board icons. Covers the most common visual
 * categories a team would want to label a whiteboard with: retrospectives,
 * planning, architecture, design, research, brainstorms, standups, and
 * product/roadmap work. Not exhaustive by design: a long list becomes
 * a search problem; a short list keeps picking snappy.
 */
const ICON_CHOICES = [
  '\u{1F4CB}', // clipboard
  '\u{1F4CA}', // chart
  '\u{1F4C8}', // trend-up
  '\u{1F4C9}', // trend-down
  '\u{1F5FA}', // map
  '\u{1F3AF}', // target
  '\u{1F3A8}', // artist palette
  '\u{1F3DB}', // classical building
  '\u{1F3D7}', // construction
  '\u{1F9E9}', // puzzle
  '\u{1F4A1}', // lightbulb
  '\u{1F680}', // rocket
  '\u{1F504}', // arrows circle
  '\u{1F500}', // shuffle
  '\u{1F501}', // repeat
  '\u{1F4DD}', // memo
  '\u{1F4D1}', // bookmark tabs
  '\u{1F4C5}', // calendar
  '\u{1F5D3}', // spiral calendar
  '\u{1F9ED}', // compass
  '\u{1F52E}', // crystal ball
  '\u{1F6E0}', // hammer and wrench
  '\u{2699}\u{FE0F}', // gear
  '\u{1F6A7}', // construction sign
  '\u{26A1}', // high voltage
  '\u{1F525}', // fire
  '\u{2B50}', // star
  '\u{1F389}', // party popper
  '\u{1F4AC}', // speech balloon
  '\u{1F5E3}\u{FE0F}', // speaking head
  '\u{1F464}', // bust
  '\u{1F465}', // busts
  '\u{1F4BC}', // briefcase
  '\u{1F4E6}', // package
  '\u{1F4CD}', // round pushpin
];

interface IconPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  /** Size of the trigger button in Tailwind units (default h-10 w-10). */
  triggerSize?: 'sm' | 'md';
  /** Background color applied to the trigger when an icon is set. */
  tone?: 'blue' | 'zinc';
}

export function IconPicker({
  value,
  onChange,
  className,
  triggerSize = 'md',
  tone = 'zinc',
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sizeClasses =
    triggerSize === 'sm'
      ? 'h-8 w-8 text-base'
      : 'h-10 w-10 text-lg';

  const toneClasses = value
    ? tone === 'blue'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-center rounded-lg transition-colors',
          sizeClasses,
          toneClasses,
          'hover:brightness-105',
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Choose an icon"
      >
        {value ? (
          <span>{value}</span>
        ) : (
          <LayoutGrid className="h-5 w-5" />
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute z-[400] mt-2 left-0 w-72 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-3"
          role="dialog"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Icon</span>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {ICON_CHOICES.map((icon) => {
              const active = icon === value;
              return (
                <button
                  type="button"
                  key={icon}
                  onClick={() => {
                    onChange(icon);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex items-center justify-center h-9 w-9 rounded-md text-lg transition-colors',
                    active
                      ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500/40'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                  )}
                >
                  {icon}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
