import type { BoltAction } from '@/hooks/use-automations';
import { ActionEditor } from '@/components/builder/action-editor';
import { Plus, Play } from 'lucide-react';

interface ActionListProps {
  actions: BoltAction[];
  onChange: (actions: BoltAction[]) => void;
}

function makeId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

export function ActionList({ actions, onChange }: ActionListProps) {
  const addAction = () => {
    onChange([
      ...actions,
      {
        id: makeId(),
        mcp_tool: '',
        parameters: {},
        sort_order: actions.length,
        on_error: 'stop',
        retry_count: 0,
      },
    ]);
  };

  const updateAction = (index: number, updated: BoltAction) => {
    const next = [...actions];
    next[index] = updated;
    onChange(next);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-zinc-400">
          <Play className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Add at least one action to define what happens.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action, index) => (
            <ActionEditor
              key={action.id}
              action={action}
              index={index}
              onChange={(updated) => updateAction(index, updated)}
              onRemove={() => removeAction(index)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addAction}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add Action
      </button>
    </div>
  );
}
