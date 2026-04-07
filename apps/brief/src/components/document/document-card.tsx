import type { BriefDocument } from '@/hooks/use-documents';
import { StatusBadge } from '@/components/document/status-badge';
import { Avatar } from '@/components/common/avatar';
import { formatRelativeTime } from '@/lib/utils';
import { Star, FileText } from 'lucide-react';

interface DocumentCardProps {
  document: BriefDocument;
  onClick: () => void;
}

export function DocumentCard({ document, onClick }: DocumentCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 hover:border-primary-300 hover:bg-primary-50/30 dark:hover:border-primary-700 dark:hover:bg-primary-900/10 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-lg shrink-0">
            {document.icon ?? <FileText className="h-5 w-5 text-zinc-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {document.title}
              </h3>
              {document.pinned && (
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
              )}
            </div>
            {document.summary && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mb-2">
                {document.summary}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Avatar src={document.creator_avatar_url} name={document.creator_name} size="sm" />
                <span>{document.creator_name ?? 'Unknown'}</span>
              </div>
              <span>{formatRelativeTime(document.updated_at)}</span>
              {document.word_count > 0 && (
                <span>{document.word_count.toLocaleString()} words</span>
              )}
            </div>
          </div>
        </div>
        <StatusBadge status={document.status} />
      </div>
    </button>
  );
}
