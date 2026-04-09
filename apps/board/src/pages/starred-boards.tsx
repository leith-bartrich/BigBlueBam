import { Star, Loader2 } from 'lucide-react';
import { BoardCard } from '@/components/list/board-card';
import { useStarredBoards } from '@/hooks/use-boards';

interface StarredBoardsPageProps {
  onNavigate: (path: string) => void;
}

export function StarredBoardsPage({ onNavigate }: StarredBoardsPageProps) {
  const { data, isLoading } = useStarredBoards();
  const boards = data?.data ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Starred Boards</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Your favorite boards for quick access
        </p>
      </div>

      {/* Board grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-yellow-50 dark:bg-yellow-900/20 mb-4">
            <Star className="h-8 w-8 text-yellow-500" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            No starred boards
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
            Star a board from the board list to pin it here for quick access.
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
