import { useState } from 'react';
import { ChevronLeft, ChevronRight, GanttChart } from 'lucide-react';
import { useEvents } from '@/hooks/use-events';
import { cn, format, addWeeks, startOfWeek, endOfWeek, isSameDay } from '@/lib/utils';

interface TimelinePageProps {
  onNavigate: (path: string) => void;
}

export function TimelinePage({ onNavigate }: TimelinePageProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  const { data, isLoading } = useEvents({
    start_after: weekStart.toISOString(),
    start_before: new Date(weekEnd.getTime() + 86400000).toISOString(),
  });
  const events = data?.data ?? [];

  // Generate 7 day columns
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(weekStart.getTime() + i * 86400000));
  }

  const totalMs = 7 * 86400000;
  const getPosition = (date: Date): number => {
    const ms = date.getTime() - weekStart.getTime();
    return Math.max(0, Math.min(100, (ms / totalMs) * 100));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <GanttChart className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Timeline: {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
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
              This Week
            </button>
            <button
              onClick={() => setCurrentDate((d) => addWeeks(d, 1))}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto p-6">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px mb-2">
          {days.map((day, i) => (
            <div key={i} className="text-center">
              <div className="text-[10px] uppercase text-zinc-500">{format(day, 'EEE')}</div>
              <div className={cn(
                'text-sm font-semibold',
                isSameDay(day, new Date()) ? 'text-blue-600' : 'text-zinc-700 dark:text-zinc-300',
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Grid lines */}
        <div className="relative border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden min-h-[400px]">
          <div className="absolute inset-0 grid grid-cols-7">
            {days.map((_, i) => (
              <div key={i} className="border-r border-zinc-100 dark:border-zinc-800 last:border-r-0" />
            ))}
          </div>

          {/* Event bars */}
          <div className="relative py-2 space-y-1">
            {events.map((event) => {
              const left = getPosition(new Date(event.start_at));
              const right = getPosition(new Date(event.end_at));
              const width = Math.max(right - left, 1);
              return (
                <div key={event.id} className="relative h-8 px-1">
                  <button
                    onClick={() => onNavigate(`/events/${event.id}/edit`)}
                    className="absolute h-7 rounded-md px-2 text-xs text-white font-medium flex items-center truncate hover:opacity-90 shadow-sm"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: '#3b82f6',
                    }}
                    title={`${event.title} (${format(new Date(event.start_at), 'h:mm a')} - ${format(new Date(event.end_at), 'h:mm a')})`}
                  >
                    {event.title}
                  </button>
                </div>
              );
            })}

            {events.length === 0 && !isLoading && (
              <div className="flex items-center justify-center h-48 text-zinc-400 text-sm">
                No events this week
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-500" />
            Book Events
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-orange-500" />
            Bam Due Dates
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-teal-500" />
            Bearing Goals
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-cyan-500" />
            Bond Deals
          </div>
        </div>
      </div>
    </div>
  );
}
