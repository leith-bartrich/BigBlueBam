import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEvents, type BookEvent } from '@/hooks/use-events';
import { cn, format, getMonthDays, addMonths, isSameDay, isSameMonth, startOfMonth, endOfMonth } from '@/lib/utils';

interface CalendarMonthPageProps {
  onNavigate: (path: string) => void;
  month?: string;
}

export function CalendarMonthPage({ onNavigate, month }: CalendarMonthPageProps) {
  const [currentDate, setCurrentDate] = useState(() =>
    month ? new Date(month + '-01') : new Date(),
  );

  const monthDays = useMemo(() => getMonthDays(currentDate), [currentDate]);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const startAfter = monthDays[0]!.toISOString();
  const startBefore = new Date(monthDays[monthDays.length - 1]!.getTime() + 86400000).toISOString();

  const { data } = useEvents({ start_after: startAfter, start_before: startBefore });
  const events = data?.data ?? [];

  const eventsForDay = (day: Date): BookEvent[] =>
    events.filter((e) => isSameDay(new Date(e.start_at), day));

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentDate((d) => addMonths(d, -1))}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-xs font-medium rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate((d) => addMonths(d, 1))}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <button
          onClick={() => onNavigate('/events/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New Event
        </button>
      </div>

      {/* Month grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-800 rounded-lg overflow-hidden">
          {/* Day name headers */}
          {dayNames.map((name) => (
            <div
              key={name}
              className="bg-zinc-100 dark:bg-zinc-900 px-2 py-2 text-xs font-medium text-zinc-500 text-center"
            >
              {name}
            </div>
          ))}

          {/* Day cells */}
          {monthDays.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            const dayEvents = eventsForDay(day);

            return (
              <div
                key={i}
                className={cn(
                  'bg-white dark:bg-zinc-900 min-h-[100px] p-1',
                  !isCurrentMonth && 'opacity-40',
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <span
                    className={cn(
                      'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                      isToday
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-700 dark:text-zinc-300',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      key={event.id}
                      onClick={() => onNavigate(`/events/${event.id}`)}
                      className="w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate hover:opacity-80 text-white"
                      style={{ backgroundColor: '#3b82f6' }}
                    >
                      {format(new Date(event.start_at), 'h:mm')} {event.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-zinc-400 px-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
