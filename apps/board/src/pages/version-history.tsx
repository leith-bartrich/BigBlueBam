import { useState } from 'react';
import { ArrowLeft, RotateCcw, Plus, History, Loader2 } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Avatar } from '@/components/common/avatar';
import { Button } from '@/components/common/button';
import { Dialog } from '@/components/common/dialog';
import { Input } from '@/components/common/input';
import { useBoard } from '@/hooks/use-boards';
import { useVersions, useCreateVersion, useRestoreVersion, type BoardVersion } from '@/hooks/use-versions';

interface VersionHistoryPageProps {
  boardId: string;
  onNavigate: (path: string) => void;
}

export function VersionHistoryPage({ boardId, onNavigate }: VersionHistoryPageProps) {
  const { data: boardData } = useBoard(boardId);
  const board = boardData?.data;

  const { data: versionsData, isLoading } = useVersions(boardId);
  const versions = versionsData?.data ?? [];

  const createVersion = useCreateVersion(boardId);
  const restoreVersion = useRestoreVersion(boardId);

  const [createOpen, setCreateOpen] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [confirmRestore, setConfirmRestore] = useState<BoardVersion | null>(null);

  const handleCreate = () => {
    createVersion.mutate(
      { name: newVersionName || `Version ${versions.length + 1}` },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setNewVersionName('');
        },
      },
    );
  };

  const handleRestore = (version: BoardVersion) => {
    restoreVersion.mutate(version.id, {
      onSuccess: () => {
        setConfirmRestore(null);
      },
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/')}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Version History</h1>
            {board && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                {board.icon ? `${board.icon} ` : ''}{board.name}
              </p>
            )}
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Save Version
        </Button>
      </div>

      {/* Version list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      ) : versions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4">
            <History className="h-8 w-8 text-zinc-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            No saved versions
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
            Save a named version to create a snapshot you can restore later.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Save First Version
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version, index) => (
            <div
              key={version.id}
              className={cn(
                'flex items-center gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800',
                'bg-white dark:bg-zinc-900 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors',
              )}
            >
              {/* Thumbnail */}
              <div className="h-16 w-24 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0">
                {version.snapshot_url ? (
                  <img
                    src={version.snapshot_url}
                    alt={version.name ?? `Version ${versions.length - index}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <History className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {version.name || `Untitled version`}
                  </h3>
                  <span className="text-xs text-zinc-400 shrink-0">
                    v{versions.length - index}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <Avatar name={version.creator_name} size="sm" />
                    <span className="text-xs text-zinc-500">{version.creator_name}</span>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {formatRelativeTime(version.created_at)}
                  </span>
                  {version.element_count > 0 && (
                    <span className="text-xs text-zinc-400">
                      {version.element_count} element{version.element_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Restore button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmRestore(version)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create version dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Save Version"
        description="Create a named snapshot of the current board state."
      >
        <div className="space-y-4">
          <Input
            label="Version name"
            placeholder="e.g. Before restructuring"
            value={newVersionName}
            onChange={(e) => setNewVersionName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={createVersion.isPending}>
              Save Version
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Confirm restore dialog */}
      <Dialog
        open={!!confirmRestore}
        onOpenChange={() => setConfirmRestore(null)}
        title="Restore Version"
        description={`This will replace the current board content with "${confirmRestore?.name || 'this version'}". This action cannot be undone.`}
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setConfirmRestore(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => confirmRestore && handleRestore(confirmRestore)}
            loading={restoreVersion.isPending}
          >
            <RotateCcw className="h-4 w-4" />
            Restore
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
