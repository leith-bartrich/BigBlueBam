import { useEvent, useDeleteEvent, useRsvpEvent } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth.store';
import { formatDateTime, eventStatusColor, visibilityLabel } from '@/lib/utils';
import { Clock, MapPin, Link2, Users, ArrowLeft, Trash2, Pencil, Check, X as XIcon, HelpCircle } from 'lucide-react';

interface EventDetailPageProps {
  eventId: string;
  onNavigate: (path: string) => void;
}

export function EventDetailPage({ eventId, onNavigate }: EventDetailPageProps) {
  const { data, isLoading } = useEvent(eventId);
  const deleteEvent = useDeleteEvent();
  const rsvpEvent = useRsvpEvent(eventId);
  const { user } = useAuthStore();
  const event = data?.data;

  const myAttendee = event?.attendees?.find(
    (a) => (a.user_id && user?.id && a.user_id === user.id) || (user?.email && a.email === user.email),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading event...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Event not found</div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!confirm('Cancel this event?')) return;
    await deleteEvent.mutateAsync(eventId);
    onNavigate('/');
  };

  const statusColor = eventStatusColor(event.status);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Back button */}
      <button
        onClick={() => onNavigate('/')}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Calendar
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{event.title}</h1>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
              {event.status}
            </span>
            <span className="text-sm text-zinc-500">
              {visibilityLabel(event.visibility)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate(`/events/${eventId}/edit`)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-zinc-400" />
          <div>
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {formatDateTime(event.start_at)} - {formatDateTime(event.end_at)}
            </div>
            <div className="text-xs text-zinc-500">{event.timezone}</div>
          </div>
        </div>

        {event.location && (
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-zinc-400" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">{event.location}</span>
          </div>
        )}

        {event.meeting_url && (
          <div className="flex items-center gap-3">
            <Link2 className="h-5 w-5 text-zinc-400" />
            <a
              href={event.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              {event.meeting_url}
            </a>
          </div>
        )}

        {event.description && (
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {event.description}
            </p>
          </div>
        )}
      </div>

      {/* RSVP */}
      {myAttendee && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Your response</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Current: <span className="font-medium capitalize">{myAttendee.response_status}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => rsvpEvent.mutate({ response_status: 'accepted' })}
              disabled={rsvpEvent.isPending || myAttendee.response_status === 'accepted'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Accept
            </button>
            <button
              onClick={() => rsvpEvent.mutate({ response_status: 'tentative' })}
              disabled={rsvpEvent.isPending || myAttendee.response_status === 'tentative'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              <HelpCircle className="h-4 w-4" />
              Maybe
            </button>
            <button
              onClick={() => rsvpEvent.mutate({ response_status: 'declined' })}
              disabled={rsvpEvent.isPending || myAttendee.response_status === 'declined'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
            >
              <XIcon className="h-4 w-4" />
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Attendees */}
      {event.attendees && event.attendees.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Users className="h-4 w-4" />
            Attendees ({event.attendees.length})
          </h3>
          <div className="space-y-2">
            {event.attendees.map((attendee) => (
              <div
                key={attendee.id}
                className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
              >
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {attendee.name || attendee.email}
                  </div>
                  {attendee.name && (
                    <div className="text-xs text-zinc-500">{attendee.email}</div>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                  {attendee.response_status}
                  {attendee.is_organizer && ' (organizer)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking info */}
      {event.booked_by_email && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Booked via scheduling link
          </div>
          <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            {event.booked_by_name} ({event.booked_by_email})
          </div>
        </div>
      )}
    </div>
  );
}
