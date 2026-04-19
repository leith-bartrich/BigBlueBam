import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEvents } from '@/hooks/use-events';
import { format, addDays, HOURS } from '@/lib/utils';

interface CalendarDayPageProps {
  onNavigate: (path: string) => void;
  date?: string;
}

export function CalendarDayPage({ onNavigate, date }: CalendarDayPageProps) {
  const [currentDate, setCurrentDate] = useState(() =>
    date ? new Date(date) : new Date(),
  );

  const startAfter = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).toISOString();
  const startBefore = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1).toISOString();

  const { data } = useEvents({ start_after: startAfter, start_before: startBefore });
  const events = data?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentDate((d) => addDays(d, -1))}
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
              onClick={() => setCurrentDate((d) => addDays(d, 1))}
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

      {/* Day grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[80px_1fr]">
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="h-16 border-b border-zinc-100 dark:border-zinc-800/50 px-2 text-xs text-zinc-400 pt-1 text-right pr-3">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              <div className="h-16 border-b border-zinc-100 dark:border-zinc-800/50 relative">
                {events
                  .filter((e) => {
                    const h = new Date(e.start_at).getHours();
                    return h === hour;
                  })
                  .map((event) => {
                    const startMin = new Date(event.start_at).getMinutes();
                    const durationMin = (new Date(event.end_at).getTime() - new Date(event.start_at).getTime()) / 60000;
                    const top = (startMin / 60) * 64; // 64px = h-16
                    const height = Math.max((durationMin / 60) * 64, 20);
                    return (
                      <button
                        key={event.id}
                        onClick={() => onNavigate(`/events/${event.id}/edit`)}
                        className="absolute left-1 right-4 rounded-lg px-3 py-1 text-sm text-white overflow-hidden cursor-pointer hover:opacity-90 shadow-sm"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: '#3b82f6',
                        }}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="text-xs opacity-80">
                          {format(new Date(event.start_at), 'h:mm a')} - {format(new Date(event.end_at), 'h:mm a')}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
