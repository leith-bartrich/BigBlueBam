import type { BriefComment } from '@/hooks/use-documents';
import { Avatar } from '@/components/common/avatar';
import { Button } from '@/components/common/button';
import { formatRelativeTime } from '@/lib/utils';
import { CheckCircle, Trash2 } from 'lucide-react';

interface CommentThreadProps {
  comment: BriefComment;
  onResolve: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  isResolving?: boolean;
  isDeleting?: boolean;
}

export function CommentThread({ comment, onResolve, onDelete, isResolving, isDeleting }: CommentThreadProps) {
  return (
    <div className={`rounded-lg border p-3 ${comment.is_resolved ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-900/10' : 'border-zinc-200 dark:border-zinc-700'}`}>
      <div className="flex items-start gap-2.5">
        <Avatar
          src={comment.creator_avatar_url}
          name={comment.creator_name}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {comment.creator_name ?? 'Unknown'}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatRelativeTime(comment.created_at)}
            </span>
            {comment.is_resolved && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle className="h-3 w-3" />
                Resolved
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
            {comment.body}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {!comment.is_resolved && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResolve(comment.id)}
                loading={isResolving}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Resolve
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(comment.id)}
              loading={isDeleting}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
