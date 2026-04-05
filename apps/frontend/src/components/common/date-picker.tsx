import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: string | null;
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  id?: string;
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return isNaN(d.getTime()) ? null : d;
}

export function DatePicker({ value, onChange, label, placeholder = 'Pick a date...', className, id }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedDate = parseDate(value ?? '');
  const today = new Date();
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());

  useEffect(() => {
    setInputValue(value ?? '');
    if (value) {
      const d = parseDate(value);
      if (d) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = parseDate(v);
      if (d) {
        onChange?.(v);
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    } else if (v === '') {
      onChange?.('');
    }
  };

  const handleDayClick = (day: number) => {
    const dateStr = formatDate(new Date(viewYear, viewMonth, day));
    setInputValue(dateStr);
    onChange?.(dateStr);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    const dateStr = formatDate(today);
    setInputValue(dateStr);
    onChange?.(dateStr);
    setOpen(false);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const todayStr = formatDate(today);
  const selectedStr = value ?? '';

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <div className="relative">
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="w-full rounded-lg border border-zinc-300 bg-white pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          />
          <Popover.Trigger asChild>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              aria-label="Open calendar"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </Popover.Trigger>
        </div>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:bg-zinc-900 dark:border-zinc-700 w-[280px] animate-fade-in"
          >
            {/* Month/Year navigation */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="rounded-md p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <ChevronLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
              </button>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="rounded-md p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <ChevronRight className="h-4 w-4 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-zinc-400 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                if (day === null) {
                  return <div key={`empty-${i}`} />;
                }
                const dateStr = formatDate(new Date(viewYear, viewMonth, day));
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedStr;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      'h-8 w-8 mx-auto rounded-md text-sm transition-colors flex items-center justify-center',
                      isSelected
                        ? 'bg-primary-600 text-white font-medium'
                        : isToday
                          ? 'bg-primary-100 text-primary-700 font-medium dark:bg-primary-900 dark:text-primary-300'
                          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Today button */}
            <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between">
              <button
                type="button"
                onClick={goToToday}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => { setInputValue(''); onChange?.(''); setOpen(false); }}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  Clear
                </button>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
