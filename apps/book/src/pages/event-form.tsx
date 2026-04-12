import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useEvent, useCreateEvent, useUpdateEvent } from '@/hooks/use-events';
import { useCalendars } from '@/hooks/use-calendars';
import { cn } from '@/lib/utils';

interface EventFormPageProps {
  eventId?: string;
  onNavigate: (path: string) => void;
}

const RECURRENCE_OPTIONS = [
  { value: '', label: 'No repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
];

function toLocalDatetimeString(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStartTime(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return toLocalDatetimeString(now.toISOString());
}

function defaultEndTime(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 2);
  return toLocalDatetimeString(now.toISOString());
}

export function EventFormPage({ eventId, onNavigate }: EventFormPageProps) {
  const isEdit = !!eventId;
  const { data: eventData, isLoading: eventLoading } = useEvent(eventId);
  const { data: calData, isLoading: calLoading } = useCalendars();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent(eventId ?? '');

  const calendars = calData?.data ?? [];
  const event = eventData?.data;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [startAt, setStartAt] = useState(defaultStartTime);
  const [endAt, setEndAt] = useState(defaultEndTime);
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [visibility, setVisibility] = useState('busy');

  // Populate form when editing an existing event
  const [populated, setPopulated] = useState(false);
  useEffect(() => {
    if (isEdit && event && !populated) {
      setTitle(event.title);
      setDescription(event.description ?? '');
      setCalendarId(event.calendar_id);
      setStartAt(toLocalDatetimeString(event.start_at));
      setEndAt(toLocalDatetimeString(event.end_at));
      setAllDay(event.all_day);
      setLocation(event.location ?? '');
      setRecurrence(event.recurrence_rule ?? '');
      setVisibility(event.visibility);
      setPopulated(true);
    }
  }, [isEdit, event, populated]);

  // Default to first calendar when creating
  useEffect(() => {
    if (!isEdit && calendars.length > 0 && !calendarId) {
      const defaultCal = calendars.find((c) => c.is_default) ?? calendars[0];
      if (defaultCal) setCalendarId(defaultCal.id);
    }
  }, [isEdit, calendars, calendarId]);

  // Validation
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (!calendarId) e.calendarId = 'Select a calendar';
    if (!allDay && startAt && endAt && new Date(endAt) <= new Date(startAt)) {
      e.endAt = 'End must be after start';
    }
    return e;
  }, [title, calendarId, allDay, startAt, endAt]);

  const canSubmit = Object.keys(errors).length === 0 && !createEvent.isPending && !updateEvent.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const payload = {
      calendar_id: calendarId,
      title: title.trim(),
      description: description.trim() || undefined,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      all_day: allDay,
      location: location.trim() || undefined,
      visibility,
      ...(recurrence ? { recurrence_rule: recurrence } : {}),
    };

    if (isEdit) {
      await updateEvent.mutateAsync(payload as any);
      onNavigate(`/events/${eventId}`);
    } else {
      const result = await createEvent.mutateAsync(payload as any);
      onNavigate('/');
    }
  };

  if (isEdit && eventLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (isEdit && !eventLoading && !event) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Event not found</div>
      </div>
    );
  }

  const isPending = createEvent.isPending || updateEvent.isPending;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Back */}
      <button
        onClick={() => onNavigate(isEdit ? `/events/${eventId}` : '/')}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        {isEdit ? 'Back to Event' : 'Back to Calendar'}
      </button>

      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {isEdit ? 'Edit Event' : 'New Event'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="book-event-title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="book-event-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Team standup"
            autoFocus
            className={cn(
              'w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
              errors.title
                ? 'border-red-400 dark:border-red-600'
                : 'border-zinc-200 dark:border-zinc-700',
            )}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        {/* Calendar */}
        <div>
          <label htmlFor="book-event-calendar" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Calendar <span className="text-red-500">*</span>
          </label>
          {calLoading ? (
            <div className="text-xs text-zinc-400">Loading calendars...</div>
          ) : (
            <select
              id="book-event-calendar"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                errors.calendarId
                  ? 'border-red-400 dark:border-red-600'
                  : 'border-zinc-200 dark:border-zinc-700',
              )}
            >
              <option value="">Select a calendar</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </select>
          )}
          {errors.calendarId && <p className="text-xs text-red-500 mt-1">{errors.calendarId}</p>}
        </div>

        {/* All Day toggle */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-300 dark:bg-zinc-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
          </label>
          <span className="text-sm text-zinc-700 dark:text-zinc-300">All day</span>
        </div>

        {/* Start / End */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="book-event-start" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {allDay ? 'Start Date' : 'Start'}
            </label>
            <input
              id="book-event-start"
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? startAt.split('T')[0] : startAt}
              onChange={(e) => {
                if (allDay) {
                  setStartAt(`${e.target.value}T00:00`);
                } else {
                  setStartAt(e.target.value);
                }
              }}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="book-event-end" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {allDay ? 'End Date' : 'End'}
            </label>
            <input
              id="book-event-end"
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? endAt.split('T')[0] : endAt}
              onChange={(e) => {
                if (allDay) {
                  setEndAt(`${e.target.value}T23:59`);
                } else {
                  setEndAt(e.target.value);
                }
              }}
              className={cn(
                'w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                errors.endAt
                  ? 'border-red-400 dark:border-red-600'
                  : 'border-zinc-200 dark:border-zinc-700',
              )}
            />
            {errors.endAt && <p className="text-xs text-red-500 mt-1">{errors.endAt}</p>}
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="book-event-description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Description
          </label>
          <textarea
            id="book-event-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, agenda, or notes..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Location */}
        <div>
          <label htmlFor="book-event-location" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Location
          </label>
          <input
            id="book-event-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Conference room, address, or video URL"
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Recurrence + Visibility + Reminder row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="book-event-recurrence" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Repeat
            </label>
            <select
              id="book-event-recurrence"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RECURRENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="book-event-visibility" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Show as
            </label>
            <select
              id="book-event-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="busy">Busy</option>
              <option value="free">Free</option>
              <option value="tentative">Tentative</option>
              <option value="out_of_office">Out of Office</option>
            </select>
          </div>
          <div>
            <label htmlFor="book-event-reminder" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Reminder
            </label>
            <select
              id="book-event-reminder"
              value={reminderMinutes}
              onChange={(e) => setReminderMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {REMINDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Color */}
        <div>
          <label htmlFor="book-event-color" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Color
          </label>
          <div className="flex items-center gap-3">
            <input
              id="book-event-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-14 rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer"
            />
            <span className="text-xs text-zinc-400">{color}</span>
          </div>
        </div>

        {/* Error banner */}
        {(createEvent.isError || updateEvent.isError) && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {(createEvent.error as Error)?.message || (updateEvent.error as Error)?.message || 'Failed to save event'}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isPending ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate(isEdit ? `/events/${eventId}` : '/')}
            className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
