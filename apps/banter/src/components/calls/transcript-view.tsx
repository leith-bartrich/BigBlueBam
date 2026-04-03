import { useRef, useEffect } from 'react';
import { Copy, Radio } from 'lucide-react';
import { cn, generateAvatarInitials, formatMessageTime } from '@/lib/utils';

interface TranscriptSegment {
  id: string;
  speakerName: string;
  speakerAvatarUrl: string | null;
  text: string;
  timestamp: string;
  isFinal: boolean; // false = interim result, true = finalized
}

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  isLive: boolean;
  onCopyTranscript: () => void;
}

export function TranscriptView({
  segments,
  isLive,
  onCopyTranscript,
}: TranscriptViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new segments
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [segments]);

  return (
    <div className="flex flex-col h-full border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Transcript
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          )}
        </div>

        <button
          onClick={onCopyTranscript}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Copy transcript"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>

      {/* Segments list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {segments.length === 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-8">
            {isLive
              ? 'Waiting for speech...'
              : 'No transcript segments yet.'}
          </p>
        )}

        {segments.map((seg) => (
          <div key={seg.id} className="flex gap-2">
            {/* Speaker avatar */}
            <div className="flex-shrink-0 mt-0.5">
              <div className="h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center text-white text-[10px] font-semibold">
                {seg.speakerAvatarUrl ? (
                  <img
                    src={seg.speakerAvatarUrl}
                    alt={seg.speakerName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  generateAvatarInitials(seg.speakerName)
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {/* Speaker name + timestamp */}
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {seg.speakerName}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                  {formatMessageTime(seg.timestamp)}
                </span>
              </div>

              {/* Transcript text */}
              <p
                className={cn(
                  'text-sm leading-relaxed mt-0.5',
                  seg.isFinal
                    ? 'text-zinc-700 dark:text-zinc-300'
                    : 'text-zinc-400 dark:text-zinc-500 italic',
                )}
              >
                {seg.text}
                {!seg.isFinal && (
                  <span className="inline-block ml-1 h-3 w-0.5 bg-zinc-400 animate-pulse align-middle" />
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
