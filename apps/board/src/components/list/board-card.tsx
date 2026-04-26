import { useState } from 'react';
import { Star, Lock, MoreHorizontal, Copy, Trash2, History, ArchiveRestore, Archive, AlertTriangle } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/common/badge';
import { Button } from '@/components/common/button';
import { Dialog } from '@/components/common/dialog';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/common/dropdown-menu';
import {
  type Board,
  useToggleStar,
  useDuplicateBoard,
  useArchiveBoard,
  useRestoreBoard,
  useDeleteBoard,
} from '@/hooks/use-boards';

interface BoardCardProps {
  board: Board;
  onNavigate: (path: string) => void;
}

export function BoardCard({ board, onNavigate }: BoardCardProps) {
  const toggleStar = useToggleStar();
  const duplicateBoard = useDuplicateBoard();
  const archiveBoard = useArchiveBoard();
  const restoreBoard = useRestoreBoard();
  const deleteBoard = useDeleteBoard();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Whether the board is in the archive bin. Drives the "..." menu items
  // (active boards get Archive; archived boards get Restore + Delete) and
  // suppresses the click-to-canvas navigation since you can't open an
  // archived board for editing.
  const isArchived = board.archived_at !== null;

  const handleClick = () => {
    if (isArchived) return;
    onNavigate(`/${board.id}`);
  };

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleStar.mutate(board.id);
  };

  return (
    <>
      <div
        className={cn(
          'group relative flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800',
          'bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-all',
          'hover:border-zinc-300 dark:hover:border-zinc-700',
          isArchived ? 'opacity-75 cursor-default' : 'cursor-pointer',
        )}
        onClick={handleClick}
      >
        {/* Thumbnail area */}
        <div className="relative h-40 rounded-t-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {board.thumbnail_url ? (
            <img
              src={board.thumbnail_url}
              alt={board.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <span className="text-3xl">{board.icon ?? ''}</span>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  {board.element_count > 0 ? `${board.element_count} elements` : 'Empty board'}
                </p>
              </div>
            </div>
          )}

          {/* Archived badge — only on the archive page so it's always clear */}
          {isArchived && (
            <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium uppercase tracking-wider bg-zinc-900/80 text-zinc-200">
              <Archive className="h-3 w-3" />
              Archived
            </div>
          )}

          {/* Star button overlay (active boards only — starring an archived
              board is a UX dead-end) */}
          {!isArchived && (
            <button
              onClick={handleStarClick}
              className={cn(
                'absolute top-2 right-2 rounded-lg p-1.5 transition-all',
                board.starred
                  ? 'text-yellow-500 bg-yellow-50/90 dark:bg-yellow-900/40'
                  : 'text-zinc-400 bg-white/80 dark:bg-zinc-900/80 opacity-0 group-hover:opacity-100',
              )}
              title={board.starred ? 'Unstar' : 'Star'}
            >
              <Star className={cn('h-4 w-4', board.starred && 'fill-current')} />
            </button>
          )}

          {/* Lock indicator */}
          {board.locked && !isArchived && (
            <div className="absolute top-2 left-2 rounded-lg p-1.5 text-zinc-500 bg-white/80 dark:bg-zinc-900/80">
              <Lock className="h-3.5 w-3.5" />
            </div>
          )}

          {/* Integrity-issue indicator. Pin to top-left for active boards
              (next to / replacing the lock icon position) and bottom-left
              for archived boards so it doesn't fight with the Archived
              badge. Click target propagates to handleClick which routes to
              the canvas; the canvas's banner exposes the actual fix UI. */}
          {board.integrity_issue_count > 0 && (
            <div
              className={cn(
                'absolute rounded-lg p-1.5 bg-amber-100/95 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shadow-sm',
                isArchived ? 'bottom-2 left-2' : board.locked ? 'top-2 left-12' : 'top-2 left-2',
              )}
              title={`${board.integrity_issue_count} integrity issue${board.integrity_issue_count > 1 ? 's' : ''}. Open the board to fix.`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          )}

          {/* Actions menu */}
          <div className={cn(
            'absolute top-2 transition-opacity',
            isArchived ? 'right-2' : 'right-10',
            'opacity-0 group-hover:opacity-100',
          )}>
            <DropdownMenu
              trigger={
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-lg p-1.5 bg-white/80 dark:bg-zinc-900/80 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              }
            >
              {isArchived ? (
                <>
                  <DropdownMenuItem onSelect={() => restoreBoard.mutate(board.id)}>
                    <ArchiveRestore className="h-4 w-4" />
                    Restore
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setConfirmDelete(true)} destructive>
                    <Trash2 className="h-4 w-4" />
                    Delete permanently
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => onNavigate(`/${board.id}/versions`)}>
                    <History className="h-4 w-4" />
                    Version history
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => duplicateBoard.mutate(board.id)}>
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => archiveBoard.mutate(board.id)}>
                    <Archive className="h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setConfirmDelete(true)} destructive>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenu>
          </div>
        </div>

        {/* Card body */}
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {board.icon && <span className="text-lg shrink-0">{board.icon}</span>}
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {board.name}
              </h3>
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isArchived
              ? `Archived ${board.archived_at ? formatRelativeTime(board.archived_at) : 'recently'}`
              : `Updated ${formatRelativeTime(board.updated_at)}`}
          </p>

          <div className="flex items-center justify-between mt-1">
            {/* Collaborator avatars */}
            <div className="flex items-center -space-x-1.5">
              {board.collaborator_count > 0 && (
                <div className="flex items-center gap-1">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-700 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                    {board.collaborator_count}
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {board.collaborator_count === 1 ? 'collaborator' : 'collaborators'}
                  </span>
                </div>
              )}
            </div>

            {/* Project badge */}
            {board.project_name && (
              <Badge variant="custom" color={board.project_name ? '#6366f1' : undefined} className="text-[10px]">
                {board.project_name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete board?"
        description={
          isArchived
            ? `"${board.name}" will be permanently deleted along with its elements, history, and stars. This cannot be undone.`
            : `"${board.name}" will be permanently deleted along with its elements, history, and stars. This cannot be undone — use Archive instead if you might want it back.`
        }
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleteBoard.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              deleteBoard.mutate(board.id, {
                onSuccess: () => setConfirmDelete(false),
              });
            }}
            loading={deleteBoard.isPending}
          >
            <Trash2 className="h-4 w-4" />
            Delete permanently
          </Button>
        </div>
      </Dialog>
    </>
  );
}
