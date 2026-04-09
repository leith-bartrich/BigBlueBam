import { useState } from 'react';
import { ArrowLeft, RotateCcw, Plus, History, Loader2 } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { Dialog } from '@/components/common/dialog';
import { Avatar } from '@/components/common/avatar';
import { useBoard } from '@/hooks/use-boards';
import { useVersions, useCreateVersion, useRestoreVersion } from '@/hooks/use-versions';

interface VersionHistoryPageProps {
  boardId: string;
  onNavigate: (path: string) => void;
}

export function VersionHistoryPage({ boardId, onNavigate }: VersionHistoryPageProps) {
  const { data: boardData } = useBoard(boardId);
  const { data: versionsData, isLoading } = useVersions(boardId);
  const createVersion = useCreateVersion(boardId);
  const restoreVersion = useRestoreVersion(boardId);

  const board = boardData?.data;
  const versions = versionsData?.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [versionDescription, setVersionDescription] = useState('');

  const handleCreate = () => {
    if (!versionName.trim()) return;
    createVersion.mutate(
      { name: versionName.trim(), description: versionDescription.trim() || undefined },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setVersionName('');
          setVersionDescription('');
        },
      },
    );
  };

  const handleRestore = (versionId: string) => {
    if (!window.confirm('Restore this version? The current board state will be saved as a new version first.')) return;
    restoreVersion.mutate(versionId, {
      onSuccess: () => {
        onNavigate(`/${boardId}`);
      },
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(`/${boardId}`)}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Version History</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{board?.name ?? 'Board'}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
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
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-primary-50 dark:bg-primary-900/20 mb-4">
            <History className="h-8 w-8 text-primary-500" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">No versions saved</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mb-4">
            Save snapshots of your board to track changes over time
          </p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Save First Version
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version, idx) => (
            <div
              key={version.id}
              className={cn(
                'flex items-center gap-4 rounded-xl border bg-white dark:bg-zinc-900 px-4 py-3',
                idx === 0
                  ? 'border-primary-200 dark:border-primary-800'
                  : 'border-zinc-200 dark:border-zinc-800',
              )}
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 shrink-0">
                <History className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {version.name}
                  </h3>
                  {idx === 0 && (
                    <span className="text-[10px] font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded">
                      Latest
                    </span>
                  )}
                  <span className="text-xs text-zinc-400">{version.element_count} elements</span>
                </div>
                {version.description && (
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">{version.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Avatar name={version.creator_name} size="sm" />
                  <span className="text-xs text-zinc-500">{version.creator_name}</span>
                  <span className="text-xs text-zinc-400">{formatRelativeTime(version.created_at)}</span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRestore(version.id)}
                className="shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create version dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="Save Version">
        <div className="space-y-4">
          <Input
            label="Version name"
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder="e.g., After brainstorm session"
            autoFocus
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Description (optional)
            </label>
            <textarea
              value={versionDescription}
              onChange={(e) => setVersionDescription(e.target.value)}
              placeholder="What changed since the last version?"
              rows={3}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleCreate} loading={createVersion.isPending} disabled={!versionName.trim()}>
              Save Version
            </Button>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
