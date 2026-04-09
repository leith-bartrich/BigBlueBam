import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEvents, type BookEvent } from '@/hooks/use-events';
import { cn, format, getWeekDays, addWeeks, HOURS, isSameDay } from '@/lib/utils';

interface CalendarWeekPageProps {
  onNavigate: (path: string) => void;
}

export function CalendarWeekPage({ onNavigate }: CalendarWeekPageProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const startAfter = weekDays[0]!.toISOString();
  const startBefore = new Date(weekDays[6]!.getTime() + 86400000).toISOString();

  const { data, isLoading } = useEvents({ start_after: startAfter, start_before: startBefore });
  const events = data?.data ?? [];

  const eventsForDay = (day: Date): BookEvent[] =>
    events.filter((e) => isSameDay(new Date(e.start_at), day));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {format(weekDays[0]!, 'MMM d')} - {format(weekDays[6]!, 'MMM d, yyyy')}
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentDate((d) => addWeeks(d, -1))}
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
              onClick={() => setCurrentDate((d) => addWeeks(d, 1))}
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

      {/* Week grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-8 min-h-full">
          {/* Time gutter */}
          <div className="col-span-1 border-r border-zinc-200 dark:border-zinc-800">
            <div className="h-10 border-b border-zinc-200 dark:border-zinc-800" />
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-14 border-b border-zinc-100 dark:border-zinc-800/50 px-2 text-[10px] text-zinc-400 pt-0.5"
              >
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, new Date());
            const dayEvents = eventsForDay(day);
            return (
              <div key={i} className="col-span-1 border-r border-zinc-200 dark:border-zinc-800 last:border-r-0">
                {/* Day header */}
                <div
                  className={cn(
                    'h-10 flex flex-col items-center justify-center border-b border-zinc-200 dark:border-zinc-800',
                    isToday && 'bg-blue-50 dark:bg-blue-950/30',
                  )}
                >
                  <span className="text-[10px] uppercase text-zinc-500">{format(day, 'EEE')}</span>
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      isToday ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-100',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Hour slots */}
                <div className="relative">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="h-14 border-b border-zinc-100 dark:border-zinc-800/50"
                    />
                  ))}
                  {/* Event blocks */}
                  {dayEvents.map((event) => {
                    const startHour = new Date(event.start_at).getHours();
                    const startMin = new Date(event.start_at).getMinutes();
                    const endHour = new Date(event.end_at).getHours();
                    const endMin = new Date(event.end_at).getMinutes();
                    const top = (startHour + startMin / 60) * 56; // 56px = h-14
                    const height = Math.max(((endHour + endMin / 60) - (startHour + startMin / 60)) * 56, 14);
                    return (
                      <button
                        key={event.id}
                        onClick={() => onNavigate(`/events/${event.id}`)}
                        className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] leading-tight text-white overflow-hidden cursor-pointer hover:opacity-90"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: '#3b82f6',
                        }}
                        title={event.title}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="opacity-80 truncate">
                          {format(new Date(event.start_at), 'h:mm a')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
