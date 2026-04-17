import { ArrowLeft, Phone, Video, Radio, Users, Clock, FileAudio } from 'lucide-react';
import {
  useCallDetail,
  useCallTranscript,
  type CallParticipant,
  type TranscriptSegment,
} from '@/hooks/use-call-history';
import {
  cn,
  formatAbsoluteTime,
  formatMessageTime,
  generateAvatarInitials,
} from '@/lib/utils';

interface CallPlaybackPageProps {
  callId: string;
  onNavigate: (path: string) => void;
}

function durationBetween(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return 'Live';
  try {
    const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    if (!Number.isFinite(ms) || ms < 0) return '-';
    const secs = Math.round(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins === 0) return `${remSecs}s`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs === 0) return `${mins}m ${remSecs.toString().padStart(2, '0')}s`;
    return `${hrs}h ${remMins.toString().padStart(2, '0')}m`;
  } catch {
    return '-';
  }
}

function CallIcon({ type, className }: { type: 'voice' | 'video' | 'huddle'; className?: string }) {
  if (type === 'video') return <Video className={className} />;
  if (type === 'huddle') return <Radio className={className} />;
  return <Phone className={className} />;
}

function ParticipantRow({ p }: { p: CallParticipant }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="h-7 w-7 rounded-lg bg-primary-600 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
        {p.avatar_url ? (
          <img src={p.avatar_url} alt={p.display_name} className="h-7 w-7 rounded-lg object-cover" />
        ) : (
          generateAvatarInitials(p.display_name)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-zinc-800 dark:text-zinc-200 truncate">
          {p.display_name}
          {p.is_bot && (
            <span className="ml-1 text-[10px] font-semibold uppercase text-primary-500">BOT</span>
          )}
        </div>
        <div className="text-[11px] text-zinc-500">
          {p.role} {p.left_at ? 'left' : 'in call'}
        </div>
      </div>
    </div>
  );
}

function SegmentRow({ seg }: { seg: TranscriptSegment }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center text-white text-[10px] font-semibold">
          {seg.speaker_avatar_url ? (
            <img
              src={seg.speaker_avatar_url}
              alt={seg.speaker_name}
              className="h-8 w-8 rounded-lg object-cover"
            />
          ) : (
            generateAvatarInitials(seg.speaker_name)
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
            {seg.speaker_name}
          </span>
          <span
            className="text-xs text-zinc-400"
            title={formatAbsoluteTime(seg.started_at)}
          >
            {formatMessageTime(seg.started_at)}
          </span>
          {typeof seg.confidence === 'number' && (
            <span className="text-[10px] text-zinc-400">
              {Math.round(seg.confidence * 100)}% conf.
            </span>
          )}
        </div>
        <p
          className={cn(
            'text-sm leading-relaxed mt-0.5',
            seg.is_final
              ? 'text-zinc-700 dark:text-zinc-300'
              : 'text-zinc-400 dark:text-zinc-500 italic',
          )}
        >
          {seg.content}
        </p>
      </div>
    </div>
  );
}

export function CallPlaybackPage({ callId, onNavigate }: CallPlaybackPageProps) {
  const { data: call, isLoading, error } = useCallDetail(callId);
  const { data: segments, isLoading: transcriptLoading } = useCallTranscript(callId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2 p-8">
        <FileAudio className="h-10 w-10 opacity-40" />
        <p className="text-sm">Call not found or you no longer have access.</p>
        <button
          onClick={() => onNavigate('/channels/general')}
          className="text-xs text-primary-500 hover:underline"
        >
          Back to Banter
        </button>
      </div>
    );
  }

  const duration = durationBetween(call.started_at, call.ended_at);
  const segmentRows = segments ?? [];
  const isLive = call.status === 'active';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 h-14 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
        <button
          onClick={() => onNavigate(`/channels/${call.channel_name || 'general'}`)}
          className="p-2 rounded-md text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <CallIcon type={call.type} className="h-5 w-5 text-zinc-400 flex-shrink-0" />
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          Call in #{call.channel_name}
        </h2>
        {isLive && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            <Radio className="h-3 w-3 animate-pulse" />
            Live
          </span>
        )}
      </header>

      {/* Body: 2-column layout, segments left / meta right */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Transcript column */}
        <section className="flex-1 min-w-0 overflow-y-auto custom-scrollbar px-6 py-5">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
            Transcript
          </h3>
          {transcriptLoading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : segmentRows.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">
              {isLive
                ? 'Transcript is being generated. Check back in a moment.'
                : 'No transcript captured for this call.'}
            </p>
          ) : (
            <div className="space-y-4">
              {segmentRows.map((seg) => (
                <SegmentRow key={seg.id} seg={seg} />
              ))}
            </div>
          )}
        </section>

        {/* Meta column */}
        <aside className="w-72 flex-shrink-0 border-l border-zinc-200 dark:border-zinc-700 px-5 py-5 overflow-y-auto custom-scrollbar">
          <div className="space-y-5">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Details
              </h4>
              <dl className="space-y-1 text-sm">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Clock className="h-3.5 w-3.5" />
                  <dt className="sr-only">Started</dt>
                  <dd>{formatAbsoluteTime(call.started_at)}</dd>
                </div>
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Radio className="h-3.5 w-3.5" />
                  <dt className="sr-only">Duration</dt>
                  <dd>{duration}</dd>
                </div>
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 capitalize">
                  <CallIcon type={call.type} className="h-3.5 w-3.5" />
                  <dt className="sr-only">Type</dt>
                  <dd>{call.type}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Participants ({call.participants.length})
              </h4>
              {call.participants.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No participants recorded.</p>
              ) : (
                <div className="space-y-0">
                  {call.participants.map((p) => (
                    <ParticipantRow key={p.id} p={p} />
                  ))}
                </div>
              )}
            </div>

            {call.recording_url && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  Recording
                </h4>
                <a
                  href={call.recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary-500 hover:underline"
                >
                  <FileAudio className="h-3.5 w-3.5" />
                  Download recording
                </a>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
