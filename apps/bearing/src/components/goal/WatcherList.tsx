import { useState } from 'react';
import { Plus, X, Loader2, UserPlus } from 'lucide-react';
import { Avatar } from '@/components/common/avatar';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { useGoalWatchers, useAddWatcher, useRemoveWatcher, type GoalWatcher } from '@/hooks/useGoals';

interface WatcherListProps {
  goalId: string;
}

export function WatcherList({ goalId }: WatcherListProps) {
  const { data, isLoading } = useGoalWatchers(goalId);
  const watchers = data?.data ?? [];
  const addMutation = useAddWatcher();
  const removeMutation = useRemoveWatcher();
  const [showAdd, setShowAdd] = useState(false);
  const [userId, setUserId] = useState('');

  const handleAdd = () => {
    if (!userId.trim()) return;
    addMutation.mutate(
      { goalId, userId: userId.trim() },
      { onSuccess: () => { setUserId(''); setShowAdd(false); } },
    );
  };

  const handleRemove = (watcher: GoalWatcher) => {
    removeMutation.mutate({ goalId, userId: watcher.user_id });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Watchers ({watchers.length})
        </h4>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Add watcher"
        >
          <UserPlus className="h-4 w-4" />
        </button>
      </div>

      {/* Add watcher form */}
      {showAdd && (
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="User ID or email"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          <Button size="sm" onClick={handleAdd} loading={addMutation.isPending}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Watcher avatars */}
      {watchers.length === 0 ? (
        <p className="text-xs text-zinc-400">No watchers</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {watchers.map((watcher) => (
            <div
              key={watcher.id}
              className="group relative flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-1"
              title={watcher.display_name}
            >
              <Avatar src={watcher.avatar_url} name={watcher.display_name} size="sm" />
              <span className="text-xs text-zinc-600 dark:text-zinc-400 max-w-[80px] truncate">
                {watcher.display_name}
              </span>
              <button
                onClick={() => handleRemove(watcher)}
                className="hidden group-hover:flex items-center justify-center h-4 w-4 rounded-full bg-zinc-300 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-red-400 hover:text-white transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
