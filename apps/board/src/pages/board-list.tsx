import { useState } from 'react';
import { Plus, Search, LayoutGrid, Clock, Star, Archive, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/button';
import { BoardCard } from '@/components/list/board-card';
import { useBoardList, useBoardStats } from '@/hooks/use-boards';

interface BoardListPageProps {
  onNavigate: (path: string) => void;
}

export function BoardListPage({ onNavigate }: BoardListPageProps) {
  const [search, setSearch] = useState('');
  const { data: boardsData, isLoading } = useBoardList({ search: search || undefined });
  const { data: statsData } = useBoardStats();

  const boards = boardsData?.data ?? [];
  const stats = statsData?.data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Boards</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Visual collaboration whiteboards for your team
          </p>
        </div>
        <Button onClick={() => onNavigate('/new')}>
          <Plus className="h-4 w-4" />
          New Board
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={LayoutGrid} label="Total Boards" value={stats.total} />
          <StatCard icon={Clock} label="Recent" value={stats.recent} />
          <StatCard icon={Star} label="Starred" value={stats.starred} />
          <StatCard icon={Archive} label="Archived" value={stats.archived} />
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search boards..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Board grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4">
            <LayoutGrid className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
            {search ? 'No boards match your search' : 'No boards yet'}
          </h3>
          <p className="text-sm text-zinc-500 mt-1 mb-4">
            {search ? 'Try a different search term' : 'Create your first visual collaboration board'}
          </p>
          {!search && (
            <Button onClick={() => onNavigate('/new')}>
              <Plus className="h-4 w-4" />
              Create Board
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {boards.map((board) => (
            <BoardCard key={board.id} board={board} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ icon: Icon, label, value }: { icon: typeof LayoutGrid; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
    </div>
  );
}
