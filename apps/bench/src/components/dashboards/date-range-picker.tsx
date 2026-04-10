import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

export interface DateRange {
  preset?: string;
  from?: string;
  to?: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'last_7_days', label: 'Last 7 days' },
  { key: 'last_30_days', label: 'Last 30 days' },
  { key: 'last_90_days', label: 'Last 90 days' },
  { key: 'this_month', label: 'This month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'this_year', label: 'This year' },
];

function formatDateForDisplay(range: DateRange): string {
  if (range.preset) {
    const p = PRESETS.find((pr) => pr.key === range.preset);
    return p?.label ?? range.preset;
  }
  if (range.from && range.to) {
    return `${range.from} - ${range.to}`;
  }
  if (range.from) return `From ${range.from}`;
  if (range.to) return `Until ${range.to}`;
  return 'All time';
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'presets' | 'custom'>('presets');
  const [customFrom, setCustomFrom] = useState(value.from ?? '');
  const [customTo, setCustomTo] = useState(value.to ?? '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasValue = value.preset || value.from || value.to;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-300"
      >
        <Calendar className="h-3.5 w-3.5" />
        <span>{formatDateForDisplay(value)}</span>
        {hasValue ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange({});
            }}
            className="ml-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <ChevronDown className="h-3 w-3 text-zinc-400" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 z-50 w-72 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl overflow-hidden">
          {/* Mode tabs */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setMode('presets')}
              className={`flex-1 text-xs font-medium px-3 py-2 transition-colors ${
                mode === 'presets'
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Presets
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`flex-1 text-xs font-medium px-3 py-2 transition-colors ${
                mode === 'custom'
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Custom Range
            </button>
          </div>

          {mode === 'presets' ? (
            <div className="p-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => {
                    onChange({ preset: preset.key });
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                    value.preset === preset.key
                      ? 'bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 font-medium'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <button
                onClick={() => {
                  if (customFrom || customTo) {
                    onChange({ from: customFrom || undefined, to: customTo || undefined });
                    setIsOpen(false);
                  }
                }}
                disabled={!customFrom && !customTo}
                className="w-full px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
