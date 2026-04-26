import { Archive, Loader2 } from 'lucide-react';
import { BoardCard } from '@/components/list/board-card';
import { useBoardList } from '@/hooks/use-boards';

interface ArchivedBoardsPageProps {
  onNavigate: (path: string) => void;
}

export function ArchivedBoardsPage({ onNavigate }: ArchivedBoardsPageProps) {
  // Reuse the main list endpoint with the archived=true filter the backend
  // already supports. Card menu items branch on board.archived_at, so each
  // card here renders Restore + Delete-permanently instead of Archive +
  // Delete (and the click-to-canvas affordance is suppressed).
  const { data, isLoading } = useBoardList({ archived: true });
  const boards = data?.data ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Archive</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Boards you've archived. Restore one to bring it back to All Boards, or delete
          permanently to free up the name and remove all elements, history, and stars.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4">
            <Archive className="h-8 w-8 text-zinc-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Archive is empty
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
            When you archive a board it lands here. Restore from this page or delete
            permanently to remove it for good.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => (
            <BoardCard key={board.id} board={board} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}
